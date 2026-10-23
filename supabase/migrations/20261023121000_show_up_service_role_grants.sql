-- The morning-nudge service needs to read settings, habits and ticks, and write its send log.
grant select, insert, update, delete on public.showup_profiles, public.showup_habits, public.showup_entries,
  public.showup_push_subscriptions, public.showup_feedback, public.showup_reminder_log to service_role;
