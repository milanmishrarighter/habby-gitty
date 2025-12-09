-- Remove the column that enabled free-text habit entries in daily tracking
BEGIN;

ALTER TABLE public.daily_habit_tracking
  DROP COLUMN IF EXISTS text_value;

COMMIT;