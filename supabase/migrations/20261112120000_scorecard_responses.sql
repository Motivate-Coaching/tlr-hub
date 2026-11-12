-- Clarity Scorecard results (onboarding quiz at https://the-living-room.com/scorecard/).
-- Rows are written only by the scorecard-submit edge function (service role).
-- Only the admin email can read them.
create table if not exists public.scorecard_responses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  first_name text not null check (char_length(first_name) between 1 and 60),
  email text not null check (char_length(email) <= 200),
  answers jsonb not null,
  scores jsonb not null,
  source text not null default 'welcome'
);
create index if not exists scorecard_responses_email_created_idx on public.scorecard_responses (email, created_at desc);
alter table public.scorecard_responses enable row level security;
revoke all on public.scorecard_responses from anon, authenticated;
grant select on public.scorecard_responses to authenticated;
grant all on public.scorecard_responses to service_role;
create policy "Admin can read scorecard responses" on public.scorecard_responses
  for select to authenticated
  using ((select auth.jwt() ->> 'email') = 'stuart.fairbairns@gmail.com');
