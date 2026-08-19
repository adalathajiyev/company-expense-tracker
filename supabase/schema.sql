create extension if not exists "pgcrypto";

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  merchant text not null constraint expenses_merchant_check check (length(btrim(merchant)) > 0),
  description text,
  category text not null constraint expenses_category_check check (length(btrim(category)) > 0),
  payment_method text not null constraint expenses_payment_method_check check (payment_method in ('Cash', 'Bank transfer')),
  quantity numeric(12, 3) not null constraint expenses_quantity_positive_check check (quantity > 0),
  unit text not null constraint expenses_unit_not_empty_check check (btrim(unit) <> ''),
  unit_price numeric(12, 2) not null constraint expenses_unit_price_positive_check check (unit_price > 0),
  amount numeric(12, 2) not null constraint expenses_amount_check check (amount > 0),
  status text not null default 'paid' check (status in ('paid', 'pending')),
  receipt_url text,
  created_at timestamptz not null default now(),
  constraint expenses_amount_calculation_check check (amount = round(quantity * unit_price, 2))
);

create index if not exists expenses_expense_date_idx
  on public.expenses (expense_date desc);

alter table public.expenses enable row level security;

revoke all on table public.expenses from anon;
grant select, insert, update, delete on table public.expenses to authenticated, service_role;

-- Starter policies for a private authenticated app. Add Supabase Auth before production use.
create policy "Authenticated users can read expenses"
  on public.expenses for select to authenticated using (true);
create policy "Authenticated users can add expenses"
  on public.expenses for insert to authenticated with check (true);
create policy "Authenticated users can update expenses"
  on public.expenses for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete expenses"
  on public.expenses for delete to authenticated using (true);

-- Uncomment these two policies only for a quick no-auth prototype.
-- create policy "Anon can read expenses" on public.expenses for select to anon using (true);
-- create policy "Anon can add expenses" on public.expenses for insert to anon with check (true);
