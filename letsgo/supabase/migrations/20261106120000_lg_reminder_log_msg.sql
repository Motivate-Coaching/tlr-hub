-- Let's Go! V2 nudges: remember which message each person was sent, so wording never repeats within a fortnight
-- and their own why is used at most once a week. Additive only (Stu approved the nudge design, 6 Nov 2026).
alter table public.lg_reminder_log add column if not exists msg text;
