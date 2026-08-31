-- Day-type classification for habits + opt-in temporary hold.
--
-- day_type semantics (a habit is shown on a day when its own tier is at least
-- as demanding as the day):
--   'hard'   -> required on hard, medium and easy days
--   'medium' -> skipped on hard days, required on medium and easy days
--   'easy'   -> required only on easy days
alter table public.habits
add column if not exists day_type text not null default 'hard';

alter table public.habits
drop constraint if exists habits_day_type_check;

alter table public.habits
add constraint habits_day_type_check check (day_type in ('hard', 'medium', 'easy'));

-- Whether this habit is even allowed to be put on temporary hold from the
-- Daily Entries page. The hold toggle is only rendered when this is true.
alter table public.habits
add column if not exists allow_temporary_hold boolean not null default false;

-- The day type chosen for a given daily entry.
alter table public.daily_entries
add column if not exists day_type text;

alter table public.daily_entries
drop constraint if exists daily_entries_day_type_check;

alter table public.daily_entries
add constraint daily_entries_day_type_check check (day_type is null or day_type in ('hard', 'medium', 'easy'));
