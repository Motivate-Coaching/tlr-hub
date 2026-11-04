-- Moving from V1 to V2 never loses anything: the first time someone signs in to V2, if their account has V1 plans
-- and nothing in V2 yet, their V1 plans, show-ups, notes and settings are copied into V2's tables.
-- Copy only: V1's own data is left exactly as it is. Runs for the signed-in person only.
create or replace function public.lg_import_v1()
returns int language plpgsql security definer set search_path to '' as $$
declare uid uuid := auth.uid(); n int := 0;
begin
  if uid is null then return 0; end if;
  if exists (select 1 from public.lg_focuses where user_id = uid) then return 0; end if;
  if not exists (select 1 from public.showup_habits where user_id = uid) then return 0; end if;

  insert into public.lg_focuses (id, user_id, title, mode, towards, start_date, length_days, status, extra, created_at, updated_at)
  select h.id, h.user_id, h.what, coalesce(h.mode, 'more'), coalesce(h.own_feel, ''), h.start_date, h.length_days,
    case when h.id = (select h2.id from public.showup_habits h2 where h2.user_id = uid and h2.status <> 'archived' order by h2.created_at desc limit 1) then 'active' else 'archived' end,
    coalesce(h.extra, '{}'::jsonb) || jsonb_build_object('feel', to_jsonb(coalesce(h.feelings, '{}'::text[])), 'gives', to_jsonb(coalesce(h.gives, '{}'::text[])), 'from_v1', true),
    h.created_at, now()
  from public.showup_habits h where h.user_id = uid
  on conflict (id) do nothing;
  get diagnostics n = row_count;

  -- One action per V1 habit, keeping the habit's id, on the days V1 nudged them (every day if not set).
  insert into public.lg_actions (id, focus_id, user_id, text, small, cue, schedules, sort, extra, created_at, updated_at)
  select h.id, h.id, h.user_id,
    case when h.mode = 'less' then coalesce(nullif(trim(h.instead), ''), 'Cut back on ' || lower(h.what)) else h.what end,
    coalesce(h.dimmer, ''), coalesce(h.extra->>'anchor', ''),
    jsonb_build_array(jsonb_build_object('from', h.start_date::text, 'type', 'days', 'days',
      coalesce((select to_jsonb(p.reminder_days) from public.showup_profiles p where p.user_id = uid and cardinality(p.reminder_days) > 0), '[0,1,2,3,4,5,6]'::jsonb))),
    0, '{}'::jsonb, h.created_at, now()
  from public.showup_habits h where h.user_id = uid
  on conflict (id) do nothing;

  insert into public.lg_checkins (action_id, user_id, day, kind, note, felt, updated_at)
  select e.habit_id, e.user_id, h.start_date + (e.day - 1), case when e.kind = 'dimmer' then 'small' else 'full' end, coalesce(e.note, ''), coalesce(e.felt, ''), e.logged_at
  from public.showup_entries e join public.showup_habits h on h.id = e.habit_id where h.user_id = uid
  on conflict do nothing;

  -- Settings come across too, with V2 nudges off until they switch them on (so nobody gets two).
  insert into public.lg_profiles (user_id, timezone, reminder_time, remind_email, remind_push, marketing_opt_in, settings, updated_at)
  select p.user_id, p.timezone, p.reminder_time, false, false, p.marketing_opt_in,
    jsonb_build_object('view', p.view_mode, 'text', p.text_size, 'calm', p.reduce_motion, 'buzz', p.buzz, 'v1EmailWasOn', p.remind_email), now()
  from public.showup_profiles p where p.user_id = uid
  on conflict (user_id) do nothing;
  return n;
end $$;
revoke all on function public.lg_import_v1() from public, anon;
grant execute on function public.lg_import_v1() to authenticated;
