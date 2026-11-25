-- Loser Tracker: waist measurements, stored next to weight on the same
-- per-day row. Everything else the app needs already exists.
alter table public.daily_health
add column if not exists waist numeric;
