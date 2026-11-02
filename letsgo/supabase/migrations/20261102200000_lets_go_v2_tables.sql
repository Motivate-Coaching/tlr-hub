-- Let's Go! V2: one focus with several actions, each on its own schedule, and per-day check-ins.
-- Additive only: V1's showup_* tables are untouched. Stuart approved this on 2 Nov 2026.
-- Ids are made on the phone (uuid), so plans work offline and sync later without duplicates.
-- Check-ins are never hard-deleted by the app: an undo sets deleted = true (a tombstone), so an
-- older phone syncing later can't bring an undone day back, and a newer change always wins (updated_at).

create table if not exists public.lg_focuses (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  intent text not null default '',
  towards text not null default '',
  outcome text not null default '',
  matters text not null default '',
  later jsonb not null default '[]',
  start_date date not null,
  length_days int not null default 30 check (length_days between 1 and 3650),
  pauses jsonb not null default '[]',
  tasks jsonb not null default '[]',
  extra jsonb not null default '{}',
  status text not null default 'active' check (status in ('active', 'archived')),
  finished_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lg_focuses_user on public.lg_focuses (user_id, status);

create table if not exists public.lg_actions (
  id uuid primary key,
  focus_id uuid not null references public.lg_focuses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null default '',
  small text not null default '',
  up text not null default '',
  cue text not null default '',
  schedules jsonb not null default '[]',
  sort int not null default 0,
  active_from date,
  until date,
  extra jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lg_actions_focus on public.lg_actions (focus_id);
create index if not exists lg_actions_user on public.lg_actions (user_id);

create table if not exists public.lg_checkins (
  action_id uuid not null references public.lg_actions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('full', 'small', 'skip')),
  up boolean not null default false,
  note text not null default '',
  late boolean not null default false,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (action_id, day)
);
create index if not exists lg_checkins_user_day on public.lg_checkins (user_id, day);

alter table public.lg_focuses enable row level security;
alter table public.lg_actions enable row level security;
alter table public.lg_checkins enable row level security;

-- Own rows only.
create policy lg_focuses_own on public.lg_focuses for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy lg_actions_own on public.lg_actions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy lg_checkins_own on public.lg_checkins for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.lg_focuses, public.lg_actions, public.lg_checkins to authenticated;
grant select, insert, update, delete on public.lg_focuses, public.lg_actions, public.lg_checkins to service_role;
