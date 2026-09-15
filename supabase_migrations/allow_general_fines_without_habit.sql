-- Fines and rewards that aren't about any one habit (calorie rewards, the
-- learning reward, missed-day fines, late-entry fines, manual general entries)
-- store no habit. habit_id is a uuid, so the old text placeholders like
-- '___general___' were rejected outright; they are recorded as null instead.
alter table public.fines_status
alter column habit_id drop not null;
