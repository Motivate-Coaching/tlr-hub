-- Stuart's view (admin.html): pilot measures, and Your list items no longer counted as actions.
-- Tasks are lg_actions rows with extra.task; they never carry habit check-ins, so they are left out of both the action count and the check-in join.
-- New columns: last_day (the plan day of their latest show-up, day 1 = start date) and comebacks (show-ups after 3 or more days with none).
drop function if exists public.lg_pilot_summary();
create function public.lg_pilot_summary()
returns table(email text, focus text, mode text, actions bigint, length_days int, start_date date, show_ups bigint, lighter bigint, last_tick timestamptz, nudges text, last_day int, comebacks bigint)
language sql security definer set search_path to '' as $$
  with acts as (
    select a.id, a.focus_id from public.lg_actions a
    where not coalesce((a.extra->>'retired')::boolean, false) and coalesce(a.extra->>'task', '') in ('', 'false')
  ),
  days as (
    select a.focus_id, c.day, bool_or(c.kind = 'small') as small, max(c.updated_at) as at
    from acts a join public.lg_checkins c on c.action_id = a.id
    where c.kind in ('full', 'small')
    group by a.focus_id, c.day
  ),
  gaps as (
    select focus_id, day, day - lag(day) over (partition by focus_id order by day) as gap from days
  )
  select u.email::text, f.title, f.mode,
    (select count(*) from public.lg_actions a join acts x on x.id = a.id where a.focus_id = f.id and (a.until is null or a.until >= current_date)),
    f.length_days, f.start_date,
    (select count(*) from public.lg_checkins c join acts x on x.id = c.action_id where x.focus_id = f.id and c.kind in ('full', 'small')),
    (select count(*) from public.lg_checkins c join acts x on x.id = c.action_id where x.focus_id = f.id and c.kind = 'small'),
    (select max(d.at) from days d where d.focus_id = f.id),
    case when p.remind_push then 'phone' when p.remind_email then 'email' else 'off' end,
    (select max(d.day) - f.start_date + 1 from days d where d.focus_id = f.id),
    (select count(*) from gaps g where g.focus_id = f.id and g.gap > 3)
  from public.lg_focuses f
  join auth.users u on u.id = f.user_id
  left join public.lg_profiles p on p.user_id = f.user_id
  where (auth.jwt() ->> 'email') = 'stuart.fairbairns@gmail.com' and f.status = 'active' and not coalesce(u.is_anonymous, false)
  order by f.start_date desc;
$$;
revoke all on function public.lg_pilot_summary() from public, anon;
grant execute on function public.lg_pilot_summary() to authenticated;
