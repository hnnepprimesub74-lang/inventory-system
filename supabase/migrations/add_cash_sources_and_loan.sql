-- Run this once in the Supabase SQL Editor (Dashboard > SQL Editor > New query).
-- Adds a "cash source" concept (Daraz vs. own cash / bank / etc.) to every expense
-- table, and a loan_payments table to track clearing payments against non-Daraz sources.

-- 0. Misc Expenses tables (the app's Misc Expenses page already expects these,
--    but they were never created in this database — create them to match
--    the shape of expense_types / operating_expenses).
create table if not exists misc_expense_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists misc_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_type_id uuid not null references misc_expense_types(id),
  expense_date date not null default current_date,
  amount numeric not null,
  remark text,
  created_at timestamptz not null default now()
);

alter table misc_expense_types enable row level security;
alter table misc_expenses enable row level security;

create policy "misc_expense_types_select" on misc_expense_types for select using (true);
create policy "misc_expense_types_insert" on misc_expense_types for insert with check (true);
create policy "misc_expense_types_update" on misc_expense_types for update using (true);
create policy "misc_expense_types_delete" on misc_expense_types for delete using (true);

create policy "misc_expenses_select" on misc_expenses for select using (true);
create policy "misc_expenses_insert" on misc_expenses for insert with check (true);
create policy "misc_expenses_update" on misc_expenses for update using (true);
create policy "misc_expenses_delete" on misc_expenses for delete using (true);

-- 0b. Admin Finance tables (admin's own monthly salary, mirrors rent_rates / rent_payments)
create table if not exists admin_salary_rates (
  id uuid primary key default gen_random_uuid(),
  effective_month text not null unique,
  rate numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists admin_salary (
  id uuid primary key default gen_random_uuid(),
  month text not null,
  amount numeric not null,
  paid_date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

insert into admin_salary_rates (effective_month, rate)
values (to_char(current_date, 'YYYY-MM'), 35000)
on conflict (effective_month) do nothing;

alter table admin_salary_rates enable row level security;
alter table admin_salary enable row level security;

create policy "admin_salary_rates_select" on admin_salary_rates for select using (true);
create policy "admin_salary_rates_insert" on admin_salary_rates for insert with check (true);
create policy "admin_salary_rates_update" on admin_salary_rates for update using (true);
create policy "admin_salary_rates_delete" on admin_salary_rates for delete using (true);

create policy "admin_salary_select" on admin_salary for select using (true);
create policy "admin_salary_insert" on admin_salary for insert with check (true);
create policy "admin_salary_update" on admin_salary for update using (true);
create policy "admin_salary_delete" on admin_salary for delete using (true);

-- 1. Cash sources
create table if not exists cash_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into cash_sources (name)
values ('Daraz')
on conflict (name) do nothing;

alter table cash_sources enable row level security;

create policy "cash_sources_select" on cash_sources for select using (true);
create policy "cash_sources_insert" on cash_sources for insert with check (true);
create policy "cash_sources_update" on cash_sources for update using (true);
create policy "cash_sources_delete" on cash_sources for delete using (true);

-- 2. source_id column on every table where an amount is recorded
alter table operating_expenses add column if not exists source_id uuid references cash_sources(id);
alter table misc_expenses      add column if not exists source_id uuid references cash_sources(id);
alter table rent_payments      add column if not exists source_id uuid references cash_sources(id);
alter table staff_salary       add column if not exists source_id uuid references cash_sources(id);
alter table refunds            add column if not exists source_id uuid references cash_sources(id);
alter table payments           add column if not exists source_id uuid references cash_sources(id);
alter table admin_salary       add column if not exists source_id uuid references cash_sources(id);

-- 3. Backfill existing rows to Daraz so nothing is left unattributed
update operating_expenses set source_id = (select id from cash_sources where name = 'Daraz') where source_id is null;
update misc_expenses      set source_id = (select id from cash_sources where name = 'Daraz') where source_id is null;
update rent_payments      set source_id = (select id from cash_sources where name = 'Daraz') where source_id is null;
update staff_salary       set source_id = (select id from cash_sources where name = 'Daraz') where source_id is null;
update refunds             set source_id = (select id from cash_sources where name = 'Daraz') where source_id is null;
update payments             set source_id = (select id from cash_sources where name = 'Daraz') where source_id is null;
update admin_salary        set source_id = (select id from cash_sources where name = 'Daraz') where source_id is null;

-- 4. Loan clearing payments (money paid back to a non-Daraz source)
create table if not exists loan_payments (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references cash_sources(id),
  amount numeric not null,
  payment_date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

alter table loan_payments enable row level security;

create policy "loan_payments_select" on loan_payments for select using (true);
create policy "loan_payments_insert" on loan_payments for insert with check (true);
create policy "loan_payments_update" on loan_payments for update using (true);
create policy "loan_payments_delete" on loan_payments for delete using (true);
