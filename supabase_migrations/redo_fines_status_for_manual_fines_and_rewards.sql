-- Convert fines_status from an auto-calculated fines table into a manual
-- fines-and-rewards ledger. Additive/backfill only, existing rows are preserved.

ALTER TABLE public.fines_status
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'fine',
  ADD COLUMN IF NOT EXISTS entry_date date;

ALTER TABLE public.fines_status
  DROP CONSTRAINT IF EXISTS fines_status_type_check;
ALTER TABLE public.fines_status
  ADD CONSTRAINT fines_status_type_check CHECK (type IN ('fine', 'reward'));

-- Backfill entry_date for any pre-existing rows using their created_at date
UPDATE public.fines_status
SET entry_date = created_at::date
WHERE entry_date IS NULL;
