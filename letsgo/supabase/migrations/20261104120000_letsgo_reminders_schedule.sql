-- Run V2's own nudges (letsgo-reminders) every 15 minutes, alongside V1's showup-reminders.
-- The bearer is the public anon key, as for V1's job; the function itself uses the service role from its environment.
select cron.schedule('letsgo-reminders', '*/15 * * * *', $$
  select net.http_post(
    url     := 'https://ycxmhilwaixfwiedkkzj.supabase.co/functions/v1/letsgo-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljeG1oaWx3YWl4ZndpZWRra3pqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5ODY1MjUsImV4cCI6MjEwODU2MjUyNX0.XRe4jBt4RYwwnAxwnSmVVGf_DtEiHn7yasgk6Rfb3tU'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$$);
