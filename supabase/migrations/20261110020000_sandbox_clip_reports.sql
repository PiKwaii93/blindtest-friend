create table public.sandbox_clip_reports (
  game_id uuid not null,
  round integer not null check (round >= 0),
  reporter_id uuid not null,
  work_id uuid not null references public.works(id) on delete cascade,
  clip_id uuid not null,
  media_path text not null,
  reason text not null check (reason in ('version','timing','volume','media')),
  created_at timestamptz not null default now(),
  primary key (game_id, round, reporter_id)
);

create index sandbox_clip_reports_work_recent
on public.sandbox_clip_reports (work_id, created_at desc);

alter table public.sandbox_clip_reports enable row level security;
revoke all on public.sandbox_clip_reports from public, anon, authenticated;
grant select, insert on public.sandbox_clip_reports to service_role;
