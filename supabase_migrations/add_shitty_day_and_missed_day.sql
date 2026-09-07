-- Two more per-day health fields.

-- A subjective grade for the day, stored and charted like weight.
alter table public.daily_health
add column if not exists shitty_day text;

alter table public.daily_health
drop constraint if exists daily_health_shitty_day_check;

alter table public.daily_health
add constraint daily_health_shitty_day_check
  check (shitty_day is null or shitty_day in ('A', 'B', 'C', 'D'));

-- Days where the food wasn't logged at all. The eating grade stands in for the
-- missing detail, and carries its own automatic fine.
alter table public.daily_health
add column if not exists missed_day boolean not null default false;

alter table public.daily_health
add column if not exists missed_day_eating text;

alter table public.daily_health
drop constraint if exists daily_health_missed_day_eating_check;

alter table public.daily_health
add constraint daily_health_missed_day_eating_check
  check (missed_day_eating is null or missed_day_eating in ('good', 'average', 'bad'));
