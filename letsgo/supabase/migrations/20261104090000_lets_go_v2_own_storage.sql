-- Let's Go! V2: its own storage for settings, reminders and phone notifications, so V2 never writes to V1's showup_* tables.
-- Stuart approved separate V2 storage on 4 Nov 2026. Additive only: nothing in V1 is changed or removed.

-- Settings and preferences per person (V1 keeps showup_profiles).
create table if not exists public.lg_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  timezone text not null default 'Europe/London',
  reminder_time time not null default '07:00',
  remind_email boolean not null default false,
  remind_push boolean not null default false,
  paused_until date,
  marketing_opt_in boolean not null default false,
  consent_at timestamptz,
  settings jsonb not null default '{}',
  wins jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

-- Phone notification subscriptions for the V2 app (its own install, so its own endpoints).
create table if not exists public.lg_push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists lg_push_user on public.lg_push_subscriptions (user_id);

-- One reminder per person, per local day, per channel. Written only by the reminders function.
create table if not exists public.lg_reminder_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  channel text not null check (channel in ('email', 'push')),
  sent_at timestamptz not null default now(),
  primary key (user_id, local_date, channel)
);

-- A focus is either building something or cutting back on something.
alter table public.lg_focuses add column if not exists mode text not null default 'more';
do $$ begin
  alter table public.lg_focuses add constraint lg_focuses_mode_check check (mode in ('more', 'less'));
exception when duplicate_object then null; end $$;

-- Check-ins: 'none' keeps a note (or an undone day) without counting it, so notes survive an undo.
alter table public.lg_checkins drop constraint if exists lg_checkins_kind_check;
alter table public.lg_checkins add constraint lg_checkins_kind_check check (kind in ('full', 'small', 'skip', 'none'));
alter table public.lg_checkins add column if not exists felt text not null default '';

alter table public.lg_profiles enable row level security;
alter table public.lg_push_subscriptions enable row level security;
alter table public.lg_reminder_log enable row level security;

create policy lg_profiles_own on public.lg_profiles for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy lg_push_own on public.lg_push_subscriptions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- lg_reminder_log: no policies, so only the server (service role) can read or write it.

grant select, insert, update, delete on public.lg_profiles, public.lg_push_subscriptions to authenticated;
grant select, insert, update, delete on public.lg_profiles, public.lg_push_subscriptions, public.lg_reminder_log to service_role;
