-- Lets a habit be retired without deleting it or its history.
--
-- A deactivated habit disappears from the Daily Entries page and is never
-- required on new entries, but it keeps all of its past tracking data and
-- still shows up on the Recorded Entries page.
alter table public.habits
add column if not exists is_deactivated boolean not null default false;
