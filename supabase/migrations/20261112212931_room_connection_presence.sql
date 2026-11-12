create table public.room_connections (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_seen timestamptz not null default clock_timestamp(),
  primary key (room_id,user_id)
);
create index room_connections_user_id on public.room_connections(user_id);
alter table public.room_connections enable row level security;
revoke all on public.room_connections from public,anon,authenticated;
grant all on public.room_connections to service_role;

-- The server supplies the verified user ID; browsers cannot call this function.
create function public.read_room_for_player(p_code text,p_user uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.rooms%rowtype; seen jsonb; current_ms numeric;
begin
  select * into r from public.rooms where code=p_code;
  if not found then return null; end if;
  if not (r.state->'players' @> jsonb_build_array(jsonb_build_object('id',p_user))
      or coalesce(r.state->'game'->'players' @> jsonb_build_array(jsonb_build_object('id',p_user)),false)) then
    raise exception 'Accès refusé.';
  end if;
  insert into public.room_connections(room_id,user_id,last_seen)
    values(r.id,p_user,clock_timestamp())
    on conflict(room_id,user_id) do update set last_seen=excluded.last_seen
    where public.room_connections.last_seen < excluded.last_seen - interval '2 seconds';
  select coalesce(jsonb_object_agg(user_id::text,floor(extract(epoch from last_seen)*1000)), '{}'::jsonb)
    into seen from public.room_connections where room_id=r.id;
  current_ms:=floor(extract(epoch from clock_timestamp())*1000);
  return jsonb_build_object('state',r.state,'version',r.version,'now',current_ms,'lastSeen',seen);
end $$;
revoke all on function public.read_room_for_player(text,uuid) from public,anon,authenticated;
grant execute on function public.read_room_for_player(text,uuid) to service_role;
