-- Show Up (habit tracker) pilot: tables, privacy rules and the morning reminder schedule.
-- Plain English: each person gets their own settings, habits and daily ticks.
-- Nobody can see anyone else's data. Notes are only ever visible to their author.
-- Stuart can read pilot feedback and a summary of how often people show up (no notes).

-- ── Settings, one row per person ─────────────────────────────────────────────
create table if not exists public.showup_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'Europe/London',
  reminder_time time not null default '07:00',
  reminder_days smallint[] not null default '{0,1,2,3,4,5,6}', -- 0 = Sunday
  remind_email boolean not null default true,
  remind_push boolean not null default false,
  paused_until date,
  view_mode text not null default 'full' check (view_mode in ('full', 'focus')),
  text_size text not null default 'standard' check (text_size in ('standard', 'large', 'larger')),
  reduce_motion boolean not null default false,
  buzz boolean not null default true,
  marketing_opt_in boolean not null default false,
  stage text not null default 'started',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Habits ───────────────────────────────────────────────────────────────────
create table if not exists public.showup_habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'more' check (mode in ('more', 'less')),
  what text not null,
  gives text[] not null default '{}',
  instead text not null default '',
  feelings text[] not null default '{}',
  own_feel text not null default '',
  dimmer text not null default '',
  length_days smallint not null default 30 check (length_days in (10, 30, 60, 90)),
  start_date date not null,
  status text not null default 'active' check (status in ('active', 'complete', 'archived')),
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_showup_habits_user on public.showup_habits (user_id, status);

-- ── Daily ticks (one per habit per day) ─────────────────────────────────────
create table if not exists public.showup_entries (
  habit_id uuid not null references public.showup_habits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  day smallint not null check (day >= 1),
  kind text not null check (kind in ('full', 'dimmer')),
  comeback boolean not null default false,
  felt text,
  note text,
  logged_at timestamptz not null default now(),
  primary key (habit_id, day)
);
create index if not exists idx_showup_entries_user on public.showup_entries (user_id);

-- ── Phone notification subscriptions ────────────────────────────────────────
create table if not exists public.showup_push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_showup_push_user on public.showup_push_subscriptions (user_id);

-- ── Pilot feedback ──────────────────────────────────────────────────────────
create table if not exists public.showup_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid references public.showup_habits(id) on delete set null,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now()
);

-- ── Reminder log (stops the same nudge going twice in a day) ─────────────────
create table if not exists public.showup_reminder_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  channel text not null check (channel in ('email', 'push')),
  sent_at timestamptz not null default now(),
  primary key (user_id, local_date, channel)
);

-- ── Privacy rules ───────────────────────────────────────────────────────────
alter table public.showup_profiles enable row level security;
alter table public.showup_habits enable row level security;
alter table public.showup_entries enable row level security;
alter table public.showup_push_subscriptions enable row level security;
alter table public.showup_feedback enable row level security;
alter table public.showup_reminder_log enable row level security;

create policy "Own settings" on public.showup_profiles for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own habits" on public.showup_habits for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own ticks" on public.showup_entries for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (
    select 1 from public.showup_habits h where h.id = habit_id and h.user_id = auth.uid()));
create policy "Own phone subscriptions" on public.showup_push_subscriptions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own feedback" on public.showup_feedback for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Admin reads feedback" on public.showup_feedback for select to authenticated
  using ((auth.jwt() ->> 'email') = 'stuart.fairbairns@gmail.com');
-- showup_reminder_log: no policies, so only the reminder service (service role) can use it.

revoke all on public.showup_profiles, public.showup_habits, public.showup_entries,
  public.showup_push_subscriptions, public.showup_feedback, public.showup_reminder_log from anon;
grant select, insert, update, delete on public.showup_profiles, public.showup_habits,
  public.showup_entries, public.showup_push_subscriptions to authenticated;
grant select, insert on public.showup_feedback to authenticated;
revoke all on public.showup_reminder_log from authenticated;

-- ── Stuart's pilot summary: who is showing up, without anyone's notes ───────
create or replace function public.showup_pilot_summary()
returns table (
  email text, habit text, length_days smallint, start_date date,
  show_ups bigint, dimmer_days bigint, comebacks bigint, last_tick timestamptz, stage text
)
language sql
security definer
set search_path = ''
as $$
  select u.email::text, h.what, h.length_days, h.start_date,
    count(e.day), count(e.day) filter (where e.kind = 'dimmer'),
    count(e.day) filter (where e.comeback), max(e.logged_at), p.stage
  from public.showup_habits h
  join auth.users u on u.id = h.user_id
  left join public.showup_entries e on e.habit_id = h.id
  left join public.showup_profiles p on p.user_id = h.user_id
  where (auth.jwt() ->> 'email') = 'stuart.fairbairns@gmail.com'
    and h.status <> 'archived'
  group by u.email, h.id, p.stage
  order by h.start_date desc;
$$;
revoke all on function public.showup_pilot_summary() from public, anon;
grant execute on function public.showup_pilot_summary() to authenticated;

-- ── Morning nudges: check every 15 minutes who is due ───────────────────────
select cron.schedule(
  'showup-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := 'https://tsusrzkpzevpiuvsppls.supabase.co/functions/v1/showup-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzdXNyemtwemV2cGl1dnNwcGxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NDAzMzUsImV4cCI6MjEwMTMxNjMzNX0.UQD9BaOjYWNOEVeV3QCF2sdlNc9SYJ2PrcZgpCtlQ8s'
    ),
    body    := '{}'::jsonb
  ) as request_id;
  $$
);
