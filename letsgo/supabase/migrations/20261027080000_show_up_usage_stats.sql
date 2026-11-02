-- Show Up: usage stats. Which screens people visit and which buttons they tap,
-- how long on each screen, device type, time of day and day of the challenge,
-- never anything they write. Kept 12 months. Only Stuart can read it.
-- People can switch it off in Settings ("Help improve Show Up").

create table if not exists public.showup_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  session_id text not null check (char_length(session_id) <= 40),
  event text not null check (char_length(event) <= 40),
  screen text check (char_length(screen) <= 30),
  detail text check (char_length(detail) <= 60),
  view_mode text check (view_mode in ('full', 'focus')),
  platform text check (platform in ('ios', 'android', 'desktop', 'other')),
  installed boolean,
  local_hour smallint check (local_hour between 0 and 23),
  day_num smallint,
  ms integer check (ms >= 0),
  created_at timestamptz not null default now()
);
create index if not exists idx_showup_events_time on public.showup_events (created_at);
create index if not exists idx_showup_events_user on public.showup_events (user_id);

alter table public.showup_events enable row level security;

-- Anyone using the app can add a row, but only for themselves (or with no account).
create policy "Add own usage" on public.showup_events for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
-- Only Stuart can read it.
create policy "Admin reads usage" on public.showup_events for select to authenticated
  using ((auth.jwt() ->> 'email') = 'stuart.fairbairns@gmail.com');

revoke all on public.showup_events from anon, authenticated;
grant insert on public.showup_events to anon, authenticated;
grant select on public.showup_events to authenticated;
grant select, insert, delete on public.showup_events to service_role;

-- Stuart's summary: how often each screen and button is used, and by how many people.
create or replace function public.showup_usage_summary(since_days int default 30)
returns table (event text, detail text, view_mode text, times bigint, people bigint)
language sql
security definer
set search_path = ''
as $$
  select e.event, e.detail, e.view_mode, count(*), count(distinct coalesce(e.user_id::text, e.session_id))
  from public.showup_events e
  where (auth.jwt() ->> 'email') = 'stuart.fairbairns@gmail.com'
    and e.created_at > now() - make_interval(days => since_days)
  group by e.event, e.detail, e.view_mode
  order by count(*) desc;
$$;
revoke all on function public.showup_usage_summary(int) from public, anon;
grant execute on function public.showup_usage_summary(int) to authenticated;

-- Daily tidy now also clears usage older than 12 months.
create or replace function public.showup_daily_tidy()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.showup_login_codes where expires_at < now() - interval '1 day';
  delete from public.showup_events where created_at < now() - interval '12 months';
  delete from auth.users u
  where greatest(
    coalesce(u.last_sign_in_at, u.created_at),
    coalesce((select p.updated_at from public.showup_profiles p where p.user_id = u.id), u.created_at),
    coalesce((select max(h.updated_at) from public.showup_habits h where h.user_id = u.id), u.created_at),
    coalesce((select max(e.logged_at) from public.showup_entries e where e.user_id = u.id), u.created_at)
  ) < now() - interval '12 months';
$$;
revoke all on function public.showup_daily_tidy() from public, anon, authenticated;
