-- Let's Go! V2 sync: the app sends what changed, and the newest change always wins.
-- An older phone can never overwrite a newer change, and nothing is ever deleted by syncing
-- (an undone day is kept as kind 'none', so it can't come back from another phone).
-- Runs as the signed-in person (security invoker), so row level security still applies.
create or replace function public.lg_push(focuses jsonb default '[]', actions jsonb default '[]', checkins jsonb default '[]')
returns void language plpgsql security invoker set search_path = public as $$
begin
  insert into lg_focuses as t select * from jsonb_populate_recordset(null::lg_focuses, focuses)
  on conflict (id) do update set (title, intent, towards, outcome, matters, later, start_date, length_days, pauses, tasks, extra, status, finished_on, mode, updated_at)
    = (excluded.title, excluded.intent, excluded.towards, excluded.outcome, excluded.matters, excluded.later, excluded.start_date, excluded.length_days, excluded.pauses, excluded.tasks, excluded.extra, excluded.status, excluded.finished_on, excluded.mode, excluded.updated_at)
  where t.updated_at < excluded.updated_at;

  insert into lg_actions as t select * from jsonb_populate_recordset(null::lg_actions, actions)
  on conflict (id) do update set (text, small, up, cue, schedules, sort, active_from, until, extra, updated_at)
    = (excluded.text, excluded.small, excluded.up, excluded.cue, excluded.schedules, excluded.sort, excluded.active_from, excluded.until, excluded.extra, excluded.updated_at)
  where t.updated_at < excluded.updated_at;

  insert into lg_checkins as t select * from jsonb_populate_recordset(null::lg_checkins, checkins)
  on conflict (action_id, day) do update set (kind, up, note, late, deleted, felt, updated_at)
    = (excluded.kind, excluded.up, excluded.note, excluded.late, excluded.deleted, excluded.felt, excluded.updated_at)
  where t.updated_at < excluded.updated_at;
end $$;
revoke all on function public.lg_push(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.lg_push(jsonb, jsonb, jsonb) to authenticated;
