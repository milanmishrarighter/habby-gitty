-- A cheat day records how it went instead of a meal log:
--   'under' — kept below 3500 kcal (earns a reward)
--   'over'  — went above 3500 kcal (fined past the second time in a month)
alter table public.daily_health
add column if not exists cheat_day_outcome text;

alter table public.daily_health
drop constraint if exists daily_health_cheat_day_outcome_check;

alter table public.daily_health
add constraint daily_health_cheat_day_outcome_check
  check (cheat_day_outcome is null or cheat_day_outcome in ('under', 'over'));
