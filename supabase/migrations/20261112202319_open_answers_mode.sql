create or replace function public.accept_room_buzz(p_code text, p_user uuid, p_round integer)
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

  if game#>>'{settings,mode}' = 'open' then
    return 'Le mode Réponses libres fonctionne sans buzz.';
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

