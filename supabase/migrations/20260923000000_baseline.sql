-- Baseline record of the live database on 23 Sept 2026. ALREADY APPLIED. Do not run again.
-- Future changes go in new, later-dated files in this folder.

create table if not exists public.member_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_id text not null,
  completed boolean default false,
  data jsonb default '{}'::jsonb,
  last_updated timestamptz default now(),
  unique (user_id, tool_id)
);
alter table public.member_progress enable row level security;
create policy "Members can read own progress" on public.member_progress for select using (auth.uid() = user_id);
create policy "Members can upsert own progress" on public.member_progress for insert with check (auth.uid() = user_id);
create policy "Members can update own progress" on public.member_progress for update using (auth.uid() = user_id);
create policy "Users can delete own progress" on public.member_progress for delete using (auth.uid() = user_id);
grant select, insert, update on public.member_progress to authenticated;

create table if not exists public.tool_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_key text not null,
  label text,
  data jsonb,
  completed boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_tool_snapshots_user_tool on public.tool_snapshots (user_id, tool_key, created_at desc);
alter table public.tool_snapshots enable row level security;
create policy "Users can manage own snapshots" on public.tool_snapshots for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.tool_snapshots to authenticated;
grant select on public.tool_snapshots to anon; -- unneeded, flagged for removal

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  user_email text,
  event_type text not null,
  page text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_activity_log_user_id on public.activity_log (user_id);
create index if not exists idx_activity_log_created_at on public.activity_log (created_at desc);
alter table public.activity_log enable row level security;
create policy "Users can read own activity" on public.activity_log for select using (auth.uid() = user_id);
create policy "Users can insert own activity" on public.activity_log for insert with check (auth.uid() = user_id);
create policy "Users can delete own activity" on public.activity_log for delete using (auth.uid() = user_id);
create policy "Admin can read all activity" on public.activity_log for select using ((auth.jwt() ->> 'email') = 'stuart.fairbairns@gmail.com');
grant select, insert on public.activity_log to anon, authenticated;

-- KNOWN ISSUE: no insert/update/select grants, so Values Discovery saves currently fail. See CLAUDE.md.
create table if not exists public.values_responses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  first_name text,
  email text unique,
  ev_decision text, ev_sacrifice text, ev_anger text, ev_pride text,
  pattern_reflection text,
  selected_families text[],
  v1_name text, v1_defn text, v1_score integer,
  v2_name text, v2_defn text, v2_score integer,
  v3_name text, v4_name text, v5_name text,
  time_to_complete integer,
  step_reached integer default 1,
  gdpr_consent boolean default false,
  mailchimp_subscribed boolean default false,
  portrait_viewed boolean default false,
  utm_source text, utm_medium text, utm_campaign text
);
alter table public.values_responses enable row level security;
create policy "Anyone can insert values responses" on public.values_responses for insert with check (true);
create policy "Anyone can upsert on email" on public.values_responses for update using (true) with check (true);
create policy "Authenticated users can read values responses" on public.values_responses for select to authenticated using (true);
