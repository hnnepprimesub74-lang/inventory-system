-- Run this once in the Supabase SQL editor for this project.
-- It adds snapshot columns to stock_transactions so the Stock Log page can
-- store its own independent copy of a product's name/category/brand/shade/
-- weight/MRP at the time it was logged, instead of always reading the live
-- value from the products table. This is what makes editing a Stock Log
-- entry (or editing a product on the Inventory page) fully independent of
-- the other page.

alter table stock_transactions
  add column if not exists product_name text,
  add column if not exists category text,
  add column if not exists brand text,
  add column if not exists shade text,
  add column if not exists weight text,
  add column if not exists mrp numeric;

-- Backfill existing rows from today's product data, so older log entries
-- keep showing something sensible instead of blanks. New rows created by
-- the app going forward already write their own snapshot at insert time.
update stock_transactions st
set
  product_name = p.product_name,
  category = p.category,
  brand = p.brand,
  shade = p.shade,
  weight = p.weight,
  mrp = p.mrp
from products p
where st.product_id = p.id
  and st.product_name is null;
