-- The 5 Ways We Get Lost quiz: track every interaction, not just view/start/result.
-- Additive only: existing rows and Angus's view/start/result/guide counts are unchanged.
-- q = question number (1-based) the event relates to; detail = small extra label
-- (answer index, screen left on, device). Still no names or emails in this table.
alter table public.quiz_events
  add column if not exists q smallint check (q is null or q between 0 and 50),
  add column if not exists detail text check (detail is null or char_length(detail) <= 40);
alter table public.quiz_events drop constraint if exists quiz_events_event_check;
alter table public.quiz_events add constraint quiz_events_event_check check (event in (
  'view','start','answer','back','skip','email_view','email_submit','result',
  'guide','pdf','video_play','join_click','exit'
));
create index if not exists quiz_events_session_idx on public.quiz_events (session, created_at);
