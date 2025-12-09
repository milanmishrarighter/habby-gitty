-- Add misc_text_tracking column to daily_entries to store additional text
alter table public.daily_entries
add column if not exists misc_text_tracking text;