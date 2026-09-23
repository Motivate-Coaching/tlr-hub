-- Fix Values Discovery saves and tidy tool_snapshots permissions.
-- Values Discovery: the public can submit answers (insert only), nobody can
-- change or read other people's answers, and only Stuart can read them.

-- values_responses: remove the too-open policies
drop policy if exists "Anyone can upsert on email" on public.values_responses;
drop policy if exists "Authenticated users can read values responses" on public.values_responses;

-- Retakes with the same email now add a new row instead of overwriting
alter table public.values_responses drop constraint if exists values_responses_email_key;

-- Start from no access, then grant only what is needed
revoke all on public.values_responses from anon, authenticated;
grant insert on public.values_responses to anon, authenticated;
grant select on public.values_responses to authenticated;

-- Existing "Anyone can insert values responses" policy (insert, check true) stays.
create policy "Admin can read values responses" on public.values_responses
  for select to authenticated
  using ((auth.jwt() ->> 'email') = 'stuart.fairbairns@gmail.com');

-- tool_snapshots: signed-out visitors need no access at all
revoke all on public.tool_snapshots from anon;
