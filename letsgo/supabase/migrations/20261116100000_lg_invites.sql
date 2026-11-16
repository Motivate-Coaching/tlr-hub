-- Let's Go! invite list (Stu, 16 Nov 2026).
-- Founding members (the TLR members in the pilot) and testers. Only the server reads the list directly.
-- Names and emails are added with SQL, never committed to this public repo.

create table if not exists public.lg_invites (
  email text primary key check (email = lower(email)),
  name text,
  kind text not null default 'founder' check (kind in ('founder', 'tester')),
  free_until date,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.lg_invites enable row level security;
grant select, insert, update, delete on public.lg_invites to service_role;

-- Small settings table. invite_only = true makes the sign-in code server refuse every email not on the list,
-- whichever version of the app asks. The new app always asks for the invite check itself.
create table if not exists public.lg_config (
  key text primary key,
  value jsonb not null
);
alter table public.lg_config enable row level security;
grant select, insert, update, delete on public.lg_config to service_role;
insert into public.lg_config (key, value) values ('invite_only', 'false'::jsonb) on conflict (key) do nothing;
revoke all on public.lg_invites, public.lg_config from anon, authenticated;

-- The signed-in person's own access: are they on the list, and as what.
create or replace function public.lg_my_access()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object('ok', true, 'kind', i.kind, 'free_until', i.free_until, 'name', i.name)
       from public.lg_invites i
      where i.email = lower(coalesce(auth.jwt() ->> 'email', ''))),
    jsonb_build_object('ok', false)
  )
$$;
revoke all on function public.lg_my_access() from public, anon;
grant execute on function public.lg_my_access() to authenticated;

-- A personal invite link carries a long random token. The link fills in that person's email and first name.
create or replace function public.lg_invite_lookup(t uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('email', i.email, 'name', split_part(coalesce(i.name, ''), ' ', 1))
    from public.lg_invites i
   where i.token = t
$$;
revoke all on function public.lg_invite_lookup(uuid) from public;
grant execute on function public.lg_invite_lookup(uuid) to anon, authenticated;
