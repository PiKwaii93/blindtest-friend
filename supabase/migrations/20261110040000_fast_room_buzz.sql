create or replace function public.commit_room(p_id uuid,p_version bigint,p_state jsonb,p_observed_at numeric,p_event text) returns boolean language plpgsql security invoker set search_path='' as $$
declare old_state jsonb; current_version bigint; current_ms numeric; player jsonb; clip jsonb; event_id uuid; game_id uuid; attempt_index text; consumed numeric; buzz_pause jsonb;
begin
  select state,version into old_state,current_version from public.rooms where id=p_id for update;
  if not found or current_version<>p_version then return false; end if;
  current_ms:=floor(extract(epoch from clock_timestamp())*1000);
  -- Reject stale calculations, including commands crossing a persisted deadline.
  if current_ms-p_observed_at>3000 or p_observed_at>current_ms then return false; end if;
  if p_event in ('BUZZ','ANSWER') and p_observed_at < (old_state->'game'->>'deadline')::numeric and current_ms >= (old_state->'game'->>'deadline')::numeric then return false; end if;
  if p_event='BUZZ' and old_state->'game'->>'phase'='PLAYING' and p_state->'game'->>'phase'='ANSWERING' then
    consumed:=(old_state->'game'->>'consumedMs')::numeric+current_ms-(old_state->'game'->>'startedAt')::numeric;
    attempt_index:=(jsonb_array_length(p_state->'game'->'attempts')-1)::text;
    p_state:=jsonb_set(p_state,'{game,consumedMs}',to_jsonb(consumed));
    p_state:=jsonb_set(p_state,'{game,deadline}',to_jsonb(current_ms+(p_state->'game'->'settings'->>'answerSeconds')::numeric*1000));
    p_state:=jsonb_set(p_state,array['game','attempts',attempt_index,'acceptedAt'],to_jsonb(current_ms));
    p_state:=jsonb_set(p_state,array['game','attempts',attempt_index,'remainingMs'],to_jsonb((old_state#>>'{game,deadline}')::numeric-current_ms));
    -- Send only the public pause data, using the timestamps committed under the room lock.
    buzz_pause:=jsonb_build_object(
      'gameId',p_state->>'gameId',
      'round',p_state#>'{game,round}',
      'consumedMs',p_state#>'{game,consumedMs}',
      'deadline',p_state#>'{game,deadline}',
      'attempt',jsonb_build_object(
        'playerId',p_state#>array['game','attempts',attempt_index,'playerId'],
        'acceptedAt',to_jsonb(current_ms),
        'remainingMs',p_state#>array['game','attempts',attempt_index,'remainingMs']
      )
    );
  end if;
  update public.rooms set state=p_state,owner_id=(p_state->>'ownerId')::uuid,version=version+1,updated_at=clock_timestamp() where id=p_id;
  insert into public.game_events(room_id,sequence_number,event_type) values(p_id,p_version+1,p_event) returning id into event_id;
  perform realtime.send(jsonb_build_object('id',event_id,'version',p_version+1,'buzzPause',buzz_pause),'STATE_CHANGED','room:'||p_id,true);
  if p_state->'game'->>'phase'='FINISHED' and old_state->'game'->>'phase' is distinct from 'FINISHED' then
    game_id:=(p_state->>'gameId')::uuid;
    insert into public.games(id,room_id,state) values(game_id,p_id,p_state->'game');
    for player in select value from jsonb_array_elements(p_state->'game'->'players') loop
      insert into public.game_players values(game_id,(player->>'id')::uuid,player->>'team',(player->>'score')::integer,(player->>'correct')::integer,(player->>'winningMs')::integer);
      for clip in select value from jsonb_array_elements(p_state->'game'->'playlist') with ordinality as c(value,n) where n <= (p_state->'game'->>'round')::integer+1 loop
        insert into public.user_work_history(user_id,work_id,last_played_at) values((player->>'id')::uuid,(clip->>'workId')::uuid,now()) on conflict(user_id,work_id) do update set last_played_at=excluded.last_played_at,play_count=public.user_work_history.play_count+1;
      end loop;
    end loop;
  end if;
  return true;
end $$;


-- Keep the rate limit, validation and atomic commit within one database request.
create function public.accept_room_buzz(p_code text, p_user uuid, p_round integer)
returns text language plpgsql security invoker set search_path='' as $$
declare
  room public.rooms%rowtype;
  game jsonb;
  observed_ms numeric;
  listen_deadline numeric;
begin
  if not public.take_rate_limit(p_user,180) then
    return 'Trop de requêtes. Patientez une minute.';
  end if;

  select * into room from public.rooms where code=p_code for update;
  if not found then return 'Salon introuvable.'; end if;
  game:=room.state->'game';
  if not (room.state->'players' @> jsonb_build_array(jsonb_build_object('id',p_user))
      or coalesce(game->'players' @> jsonb_build_array(jsonb_build_object('id',p_user)),false)) then
    return 'Accès refusé.';
  end if;
  if (game->>'round')::integer is distinct from p_round then
    return 'La manche a changé.';
  end if;

  observed_ms:=floor(extract(epoch from clock_timestamp())*1000);
  listen_deadline:=(game->>'deadline')::numeric;
  if game->>'phase' is distinct from 'PLAYING' or listen_deadline is null
      or observed_ms >= listen_deadline or observed_ms < (game->>'startedAt')::numeric
      or game->'excluded' @> jsonb_build_array(p_user) then
    return 'Buzz indisponible.';
  end if;

  game:=jsonb_set(game,'{phase}','"ANSWERING"'::jsonb);
  game:=jsonb_set(game,'{attempts}',game->'attempts' || jsonb_build_array(jsonb_build_object('playerId',p_user)));
  if not public.commit_room(room.id,room.version,jsonb_set(room.state,'{game}',game),observed_ms,'BUZZ') then
    return 'Buzz indisponible.';
  end if;
  return null;
end $$;

revoke all on function public.accept_room_buzz(text,uuid,integer) from public,anon,authenticated;
grant execute on function public.accept_room_buzz(text,uuid,integer) to service_role;
