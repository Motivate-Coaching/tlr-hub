-- The daily tidy removes accounts unused for 12 months. It only looked at V1's tables, so someone using
-- only V2 every day could have been treated as inactive. It now counts V2 activity too.
create or replace function public.showup_daily_tidy()
returns void language sql security definer set search_path to '' as $function$
  delete from public.showup_login_codes where expires_at < now() - interval '1 day';
  delete from public.showup_events where created_at < now() - interval '12 months';
  delete from auth.users u
  where greatest(
    coalesce(u.last_sign_in_at, u.created_at),
    coalesce((select p.updated_at from public.showup_profiles p where p.user_id = u.id), u.created_at),
    coalesce((select max(h.updated_at) from public.showup_habits h where h.user_id = u.id), u.created_at),
    coalesce((select max(e.logged_at) from public.showup_entries e where e.user_id = u.id), u.created_at),
    coalesce((select p.updated_at from public.lg_profiles p where p.user_id = u.id), u.created_at),
    coalesce((select max(f.updated_at) from public.lg_focuses f where f.user_id = u.id), u.created_at),
    coalesce((select max(c.updated_at) from public.lg_checkins c where c.user_id = u.id), u.created_at)
  ) < now() - interval '12 months';
$function$;
