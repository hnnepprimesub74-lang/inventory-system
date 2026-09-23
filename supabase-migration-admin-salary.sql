-- Run this once in the Supabase SQL editor for this project.
-- The Admin Finance page's "Add Admin Salary Payment" feature reads/writes a
-- table that was never created in this database, causing:
--   "Failed to add admin salary payment: Could not find the table
--    'public.admin_salary' in the schema cache"

create table if not exists admin_salary (
  id uuid primary key default gen_random_uuid(),
  month text not null,
  amount numeric not null,
  paid_date date not null,
  note text,
  source_id uuid references cash_sources(id),
  created_at timestamptz not null default now()
);

alter table admin_salary enable row level security;

create policy "Authenticated users can manage admin_salary"
  on admin_salary for all to authenticated using (true) with check (true);
