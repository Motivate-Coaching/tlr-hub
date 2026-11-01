-- New starters for Stu's view: everyone who has added their email,
-- newest first, with their habit if they have one. Only Stu can read it.
create or replace function public.showup_new_starters(since_days int default 30)
returns table(email text, joined_at timestamptz, mode text, habit text, start_date date, show_ups bigint)
language sql
security definer
set search_path to ''
as $$
  select u.email::text, u.created_at, h.mode, h.what, h.start_date,
    (select count(*) from public.showup_entries e where e.habit_id = h.id)
  from auth.users u
  left join lateral (
    select * from public.showup_habits x
    where x.user_id = u.id and x.status <> 'archived'
    order by x.created_at desc limit 1
  ) h on true
  where (auth.jwt() ->> 'email') = 'stuart.fairbairns@gmail.com'
    and u.email is not null and u.email <> ''
    and u.created_at > now() - make_interval(days => since_days)
  order by u.created_at desc;
$$;

revoke all on function public.showup_new_starters(int) from public, anon;
grant execute on function public.showup_new_starters(int) to authenticated;
