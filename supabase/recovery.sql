-- Run after deployment. Store recovery_url and recovery_secret in Supabase Vault first.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.schedule('blindtest-recovery','5 seconds',$job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='blindtest_recovery_url'),
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='blindtest_recovery_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 4000
  );
$job$);
-- Retain completed game history; only remove empty, unused lobbies.
select cron.schedule('blindtest-cleanup','17 * * * *',$job$
 delete from public.rooms where updated_at<now()-interval '24 hours' and state->'game'='null'::jsonb and jsonb_array_length(state->'players')=0 and not exists(select 1 from public.games where room_id=rooms.id);
 delete from public.rate_limits where bucket<now()-interval '1 day';
 delete from public.game_events where created_at<now()-interval '7 days';
$job$);
