-- Stuart's view of V2 plans (admin.html): one row per current V2 focus. Only his email can read it.
create or replace function public.lg_pilot_summary()
returns table(email text, focus text, mode text, actions bigint, length_days int, start_date date, show_ups bigint, lighter bigint, last_tick timestamptz, nudges text)
language sql security definer set search_path to '' as $$
  select u.email::text, f.title, f.mode,
    (select count(*) from public.lg_actions a where a.focus_id = f.id and not coalesce((a.extra->>'retired')::boolean, false) and (a.until is null or a.until >= current_date)),
    f.length_days, f.start_date,
    count(c.day) filter (where c.kind in ('full', 'small')), count(c.day) filter (where c.kind = 'small'),
    max(c.updated_at) filter (where c.kind in ('full', 'small')),
    case when p.remind_push then 'phone' when p.remind_email then 'email' else 'off' end
  from public.lg_focuses f
  join auth.users u on u.id = f.user_id
  left join public.lg_actions a2 on a2.focus_id = f.id and not coalesce((a2.extra->>'retired')::boolean, false)
  left join public.lg_checkins c on c.action_id = a2.id
  left join public.lg_profiles p on p.user_id = f.user_id
  where (auth.jwt() ->> 'email') = 'stuart.fairbairns@gmail.com' and f.status = 'active' and not coalesce(u.is_anonymous, false)
  group by u.email, f.id, p.remind_push, p.remind_email
  order by f.start_date desc;
$$;
revoke all on function public.lg_pilot_summary() from public, anon;
grant execute on function public.lg_pilot_summary() to authenticated;
