-- Show Up: let Stuart see who sent each check-in and piece of feedback (name via email).
-- Read-only, and only works for Stuart's email. Nothing else changes.
create or replace function public.showup_feedback_admin(since_days int default 90)
returns table (email text, question text, answer text, created_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select u.email::text, f.question, f.answer, f.created_at
  from public.showup_feedback f
  join auth.users u on u.id = f.user_id
  where (auth.jwt() ->> 'email') = 'stuart.fairbairns@gmail.com'
    and f.created_at > now() - make_interval(days => since_days)
  order by f.created_at desc;
$$;
revoke all on function public.showup_feedback_admin(int) from public, anon;
grant execute on function public.showup_feedback_admin(int) to authenticated;
