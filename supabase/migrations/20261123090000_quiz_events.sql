-- The 5 Ways We Get Lost quiz (tlr-5states.html): anonymous funnel counts for Angus.
-- No names or emails are stored. Anyone can add an event; nobody can read them except
-- Stuart's account and the service role (used by Angus's morning refresh).
create table if not exists public.quiz_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  session text not null check (char_length(session) between 8 and 40),
  event text not null check (event in ('view','start','result','guide')),
  state text check (state is null or state in ('The Drift','The Noise','The Carry','The Replay','The Whisper')),
  source text check (source is null or char_length(source) <= 40)
);
create index if not exists quiz_events_created_idx on public.quiz_events (created_at desc);
alter table public.quiz_events enable row level security;
revoke all on public.quiz_events from anon, authenticated;
grant insert on public.quiz_events to anon, authenticated;
grant usage, select on sequence public.quiz_events_id_seq to anon, authenticated;
grant select on public.quiz_events to authenticated;
grant all on public.quiz_events to service_role;
create policy "Anyone can add a quiz event" on public.quiz_events for insert to anon, authenticated with check (true);
create policy "Admin can read quiz events" on public.quiz_events for select to authenticated
  using ((select auth.jwt() ->> 'email') = 'stuart.fairbairns@gmail.com');
