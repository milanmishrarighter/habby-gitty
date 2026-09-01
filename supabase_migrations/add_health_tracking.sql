-- Daily calorie and weight tracking.

-- A reusable food name with its calorie range. The name is the identity: typing
-- it again on a later day pulls these calories back without retyping them.
create table if not exists public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  food_name text not null unique,
  min_calorie numeric not null default 0,
  max_calorie numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per day. meals is an array of
--   { foodName: text, minCalorie: number, maxCalorie: number }
-- captured as entered, so editing a saved meal's calories later never rewrites
-- what was actually eaten on a past day.
create table if not exists public.daily_health (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  meals jsonb not null default '[]'::jsonb,
  calories_burned numeric not null default 0,
  is_cheat_day boolean not null default false,
  weight_checked boolean not null default false,
  weight numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daily_health_date_idx on public.daily_health (date);

alter table public.saved_meals enable row level security;
alter table public.daily_health enable row level security;

drop policy if exists "saved_meals_all" on public.saved_meals;
create policy "saved_meals_all" on public.saved_meals
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "daily_health_all" on public.daily_health;
create policy "daily_health_all" on public.daily_health
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
