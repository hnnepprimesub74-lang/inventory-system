-- Run this once in the Supabase SQL editor for this project.
-- The Admin Finance page's "Set Monthly Admin Salary" feature reads/writes a
-- table that was never created in this database, causing:
--   "Failed to set admin salary: Could not find the table
--    'public.admin_salary_rates' in the schema cache"

create table if not exists admin_salary_rates (
  effective_month text primary key,
  rate numeric not null,
  created_at timestamptz not null default now()
);

-- If your other finance tables (e.g. admin_salary) have row-level security
-- enabled, mirror the same policy here so this table is reachable the same way:
alter table admin_salary_rates enable row level security;

create policy "Authenticated users can manage admin_salary_rates"
  on admin_salary_rates for all to authenticated using (true) with check (true);
