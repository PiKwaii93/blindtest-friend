-- Private game documents are intentionally accessible only through authenticated server routes.
create table public.profiles (id uuid primary key references auth.users on delete cascade, username text not null check(length(username) between 2 and 30), avatar_url text, created_at timestamptz not null default now());
create unique index profiles_username_unique on public.profiles(lower(username));
create table public.administrators (user_id uuid primary key references auth.users on delete cascade);
create table public.categories (id uuid primary key default gen_random_uuid(),name text not null unique,slug text not null unique,is_active boolean not null default true);
create table public.works (id uuid primary key default gen_random_uuid(),title text not null,image_path text,release_year integer,is_active boolean not null default true,important_words text[] not null default '{}',rights_source text not null,created_at timestamptz not null default now());
create unique index works_title_unique on public.works(lower(title));
create table public.work_aliases (id uuid primary key default gen_random_uuid(),work_id uuid not null references public.works on delete cascade,alias text not null,normalized_alias text not null,unique(work_id,normalized_alias));
create table public.work_categories (work_id uuid references public.works on delete cascade,category_id uuid references public.categories on delete cascade,primary key(work_id,category_id));
create index on public.work_categories(category_id);
create table public.audio_clips (id uuid primary key default gen_random_uuid(),work_id uuid not null references public.works on delete cascade,audio_path text not null,difficulty text not null check(difficulty in ('easy','normal','hard')),start_ms integer not null default 0 check(start_ms>=0),usable_duration_ms integer not null check(usable_duration_ms>=5000),is_active boolean not null default true,rights_status text not null check(rights_status in ('authorized','pending','denied')));
create index on public.audio_clips(work_id);
create table public.rooms (id uuid primary key,code text not null unique,owner_id uuid not null references auth.users,state jsonb not null,version bigint not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index on public.rooms(owner_id);
create index rooms_deadline on public.rooms (((state->'game'->>'deadline')::numeric)) where state->'game'->>'deadline' is not null;
create table public.games (id uuid primary key,room_id uuid not null references public.rooms on delete cascade,state jsonb not null,ended_at timestamptz not null default now());
create index on public.games(room_id);
create table public.game_players (game_id uuid references public.games on delete cascade,user_id uuid references auth.users on delete cascade,team_id text,score integer not null,correct integer not null,winning_ms integer not null,primary key(game_id,user_id));
create index on public.game_players(user_id);
create table public.user_work_history (user_id uuid references auth.users on delete cascade,work_id uuid references public.works on delete cascade,last_played_at timestamptz not null,play_count integer not null default 1,primary key(user_id,work_id));
create index on public.user_work_history(work_id);
create table public.game_events (id uuid primary key default gen_random_uuid(),room_id uuid references public.rooms on delete cascade,sequence_number bigint not null,event_type text not null,payload jsonb not null default '{}',created_at timestamptz not null default now(),unique(room_id,sequence_number));
create table public.rate_limits (user_id uuid primary key references auth.users on delete cascade,bucket timestamptz not null,total integer not null);

do $$ declare t text; begin
  foreach t in array array['profiles','administrators','categories','works','work_aliases','work_categories','audio_clips','rooms','games','game_players','user_work_history','game_events','rate_limits'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
grant select,insert,update on public.profiles to authenticated;
create policy profile_read on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy profile_insert on public.profiles for insert to authenticated with check(id=(select auth.uid()));
create policy profile_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));

create function public.read_room_clock(p_code text) returns jsonb language sql volatile security invoker set search_path='' as $$
  select jsonb_build_object('state',state,'version',version,'now',floor(extract(epoch from clock_timestamp())*1000)) from public.rooms where code=p_code;
$$;
create function public.commit_room(p_id uuid,p_version bigint,p_state jsonb,p_observed_at numeric,p_event text) returns boolean language plpgsql security invoker set search_path='' as $$
declare old_state jsonb; current_version bigint; current_ms numeric; player jsonb; clip jsonb; event_id uuid; game_id uuid;
begin
  select state,version into old_state,current_version from public.rooms where id=p_id for update;
  if not found or current_version<>p_version then return false; end if;
  current_ms:=floor(extract(epoch from clock_timestamp())*1000);
  -- Reject stale calculations, including commands crossing a persisted deadline.
  if current_ms-p_observed_at>3000 or p_observed_at>current_ms then return false; end if;
  if p_event in ('BUZZ','ANSWER') and current_ms >= (old_state->'game'->>'deadline')::numeric then return false; end if;
  update public.rooms set state=p_state,owner_id=(p_state->>'ownerId')::uuid,version=version+1,updated_at=clock_timestamp() where id=p_id;
  insert into public.game_events(room_id,sequence_number,event_type) values(p_id,p_version+1,p_event) returning id into event_id;
  perform realtime.send(jsonb_build_object('id',event_id,'version',p_version+1),'STATE_CHANGED','room:'||p_id,true);
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
create function public.take_rate_limit(p_user uuid,p_limit integer) returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer; begin
  insert into public.rate_limits values(p_user,date_trunc('minute',clock_timestamp()),1)
  on conflict(user_id) do update set bucket=date_trunc('minute',clock_timestamp()), total=case when public.rate_limits.bucket=date_trunc('minute',clock_timestamp()) then public.rate_limits.total+1 else 1 end returning total into n;
  return n<=p_limit;
end $$;
create function public.expired_rooms() returns table(code text) language sql security invoker set search_path='' as $$
  select code from public.rooms where (state->'game'->>'deadline')::numeric <= extract(epoch from clock_timestamp())*1000 order by updated_at limit 100;
$$;
revoke all on function public.read_room_clock(text),public.commit_room(uuid,bigint,jsonb,numeric,text),public.take_rate_limit(uuid,integer),public.expired_rooms() from public,anon,authenticated;
grant execute on function public.read_room_clock(text),public.commit_room(uuid,bigint,jsonb,numeric,text),public.take_rate_limit(uuid,integer),public.expired_rooms() to service_role;

create schema if not exists private;
create function private.can_read_room(topic text) returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.rooms r where topic='room:'||r.id and r.state->'players' @> jsonb_build_array(jsonb_build_object('id',auth.uid()::text)));
$$;
revoke all on function private.can_read_room(text) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.can_read_room(text) to authenticated;
create policy room_broadcast_read on realtime.messages for select to authenticated using(extension='broadcast' and private.can_read_room((select realtime.topic())));

insert into public.categories(name,slug) values ('Jeux vidéo','jeux-video'),('Films','films'),('Séries','series'),('Dessins animés','dessins-animes'),('Animés japonais','animes'),('Musiques populaires','musiques'),('Génériques TV','generiques');
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('audio','audio',false,20971520,array['audio/mpeg','audio/wav','audio/ogg']),('images','images',true,5242880,array['image/jpeg','image/png','image/webp']);
