-- Date-based reminders, plus a way for the app to read its own database size.

-- A reminder on a date. repeats_yearly makes it recur on the same day and month
-- every year, which is what birthdays and anniversaries need.
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  reminder_date date not null,
  text text not null,
  repeats_yearly boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.reminders enable row level security;

drop policy if exists "reminders_all" on public.reminders;
create policy "reminders_all" on public.reminders
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Returns the size of this database in bytes. Runs with the definer's rights
-- because pg_database_size isn't callable by the API roles directly; it exposes
-- a single number and nothing else, and only to signed-in users.
create or replace function public.get_database_size_bytes()
returns bigint
language sql
security definer
set search_path = public
as $$
  select pg_database_size(current_database());
$$;

revoke all on function public.get_database_size_bytes() from public;
revoke all on function public.get_database_size_bytes() from anon;
grant execute on function public.get_database_size_bytes() to authenticated;
