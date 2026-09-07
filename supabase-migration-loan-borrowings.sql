-- Run this once in the Supabase SQL editor for this project.
-- Today the Loan page only ever infers "borrowed" amounts from expenses that
-- happened to be paid out of a non-Daraz cash source — there is no way to
-- directly record the act of taking a loan (e.g. "borrowed Rs 50,000 from
-- Bank X on this date") before spending any of it. This table adds that.

create table if not exists loan_borrowings (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references cash_sources(id) on delete cascade,
  amount numeric not null,
  borrow_date date not null,
  note text,
  created_at timestamptz not null default now()
);

-- Supabase enables RLS by default with no policies, which blocks all access.
-- This mirrors the permissive policy loan_payments already uses so the app
-- (which talks to Supabase as an authenticated user) can read and write it.
alter table loan_borrowings enable row level security;

create policy "Authenticated users can manage loan_borrowings"
  on loan_borrowings for all to authenticated using (true) with check (true);
