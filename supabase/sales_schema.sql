create extension if not exists "pgcrypto";

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  sale_date date not null default current_date,
  product text not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit text not null,
  unit_price numeric(12, 2) not null check (unit_price > 0),
  amount numeric(12, 2) not null check (amount > 0),
  paid_amount numeric(12, 2) not null default 0 check (paid_amount >= 0 and paid_amount <= amount),
  payment_method text not null check (payment_method in ('Cash', 'Bank transfer')),
  status text not null check (status in ('paid', 'partially_paid', 'unpaid')),
  created_at timestamptz not null default now(),
  constraint sales_payment_consistency check (
    (status = 'paid' and paid_amount = amount) or
    (status = 'partially_paid' and paid_amount > 0 and paid_amount < amount) or
    (status = 'unpaid' and paid_amount = 0)
  )
);

create index if not exists sales_date_idx on public.sales (sale_date desc);

-- Migrates a sales table created before unit prices were introduced.
alter table public.sales add column if not exists unit_price numeric(12, 2);
update public.sales set unit_price = round(amount / quantity, 2) where unit_price is null;
alter table public.sales alter column unit_price set not null;
alter table public.sales drop constraint if exists sales_unit_price_check;
alter table public.sales add constraint sales_unit_price_check check (unit_price > 0);
alter table public.sales drop constraint if exists sales_amount_calculation_check;
alter table public.sales add constraint sales_amount_calculation_check check (amount = round(quantity * unit_price, 2));

alter table public.sales enable row level security;
create policy "Authenticated users can read sales" on public.sales for select to authenticated using (true);
create policy "Authenticated users can add sales" on public.sales for insert to authenticated with check (true);
create policy "Authenticated users can update sales" on public.sales for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete sales" on public.sales for delete to authenticated using (true);

-- For a temporary no-auth prototype only:
-- create policy "Anon can read sales" on public.sales for select to anon using (true);
-- create policy "Anon can add sales" on public.sales for insert to anon with check (true);
-- create policy "Anon can delete sales" on public.sales for delete to anon using (true);
