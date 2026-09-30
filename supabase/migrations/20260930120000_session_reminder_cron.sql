-- Schedule the session-reminders edge function every 30 minutes via pg_cron + pg_net.
-- This checks whether any TLR session is ~1h or ~24h away and emails all members.

select cron.schedule(
  'tlr-session-reminders',   -- job name (unique)
  '0,30 * * * *',            -- every 30 minutes, on the hour and half-hour
  $$
  select
    net.http_post(
      url     := 'https://tsusrzkpzevpiuvsppls.supabase.co/functions/v1/session-reminders',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzdXNyemtwemV2cGl1dnNwcGxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NDAzMzUsImV4cCI6MjEwMTMxNjMzNX0.UQD9BaOjYWNOEVeV3QCF2sdlNc9SYJ2PrcZgpCtlQ8s'
      ),
      body    := '{}'::jsonb
    ) as request_id;
  $$
);
