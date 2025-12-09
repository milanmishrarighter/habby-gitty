-- Remove the column that distinguished free-text habits from tracking habits
BEGIN;

ALTER TABLE public.habits
  DROP COLUMN IF EXISTS type;

COMMIT;