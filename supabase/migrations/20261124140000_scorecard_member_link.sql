-- Clarity Scorecard inside the TLR Hub: link a result to the member who took it,
-- and let members read their own results (for the dashboard and the Balance Wheel prompts).
-- Public submissions (no sign-in) keep user_id null. Rows are still written only by the
-- scorecard-submit edge function (service role). Stuart's admin read policy is unchanged.
alter table public.scorecard_responses
  add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists scorecard_responses_user_idx on public.scorecard_responses (user_id, created_at desc);
drop policy if exists "Members can read their own scorecards" on public.scorecard_responses;
create policy "Members can read their own scorecards" on public.scorecard_responses
  for select to authenticated
  using (user_id = (select auth.uid()));
