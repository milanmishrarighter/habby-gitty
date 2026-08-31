-- Three additions to habits:
--
-- 1. Out-of-control misses can now carry their own fine and trigger the same
--    accountability email as a failed condition.
-- 2. "Tracker only" habits are recorded but never judged — no conditions, no
--    fines, no rewards, no out-of-control misses.
-- 3. Tracking values can be archived instead of removed, so old values stay
--    resolvable in past entries but are no longer offered for new ones.

alter table public.habits
add column if not exists ooc_miss_triggers_email boolean not null default false;

alter table public.habits
add column if not exists ooc_miss_fine_amount numeric not null default 0;

alter table public.habits
add column if not exists is_tracker_only boolean not null default false;

-- A subset of tracking_values. Entries stay in tracking_values so historical
-- records still render; listing one here hides it from new entries.
alter table public.habits
add column if not exists archived_tracking_values jsonb not null default '[]'::jsonb;
