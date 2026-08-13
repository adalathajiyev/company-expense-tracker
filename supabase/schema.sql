create extension if not exists "pgcrypto";

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  merchant text not null,
  description text,
  category text not null,
  payment_method text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  status text not null default 'paid' check (status in ('paid', 'pending')),
  receipt_url text,
  created_at timestamptz not null default now()
);

create index if not exists expenses_expense_date_idx
  on public.expenses (expense_date desc);

alter table public.expenses enable row level security;

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
