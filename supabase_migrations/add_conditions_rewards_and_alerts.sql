-- Rewards + accountability alerts for habit conditions.
--
-- habits.frequency_conditions keeps its existing jsonb column, but each entry
-- now carries an operator and an outcome:
--   { trackingValue, operator: '=='|'<='|'>='|'<'|'>', count, frequency:
--     'daily'|'weekly'|'monthly'|'yearly', outcome: 'fine'|'reward' }
-- Older rows without operator/outcome are read as { operator: '>', outcome:
-- 'fine' }, which is exactly what the previous fine logic did.

alter table public.habits
add column if not exists reward_amount numeric not null default 0;

-- Which accountability emails (defined in Settings) get told about this habit's
-- fines, plus the message that is sent to them.
alter table public.habits
add column if not exists alert_emails jsonb not null default '[]'::jsonb;

alter table public.habits
add column if not exists alert_subject text;

alter table public.habits
add column if not exists alert_body text;

-- Marks rows the condition engine created, so it can clean up after itself
-- without touching anything entered by hand on the Fines & Rewards page.
alter table public.fines_status
add column if not exists is_auto boolean not null default false;

-- A permanent record of every accountability email sent. Kept separate from
-- fines_status so that deleting or re-evaluating a fine can never cause the
-- same email to go out to someone twice.
create table if not exists public.habit_alert_log (
  alert_key text primary key,
  habit_id text not null,
  period_key text not null,
  recipients jsonb not null default '[]'::jsonb,
  subject text,
  sent_at timestamptz not null default now()
);

alter table public.habit_alert_log enable row level security;

drop policy if exists "habit_alert_log_all" on public.habit_alert_log;
create policy "habit_alert_log_all" on public.habit_alert_log
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
