create extension if not exists "pgcrypto";

create table if not exists public.owner_funding (
  id uuid primary key default gen_random_uuid(),
  funding_date date not null default current_date,
  owner_name text not null,
  description text,
  payment_method text not null default 'Cash' check (payment_method = 'Cash'),
  direction text not null default 'incoming' check (direction in ('incoming', 'outgoing')),
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists owner_funding_date_idx on public.owner_funding (funding_date desc);

-- Also migrates an existing table that previously allowed bank transfers.
alter table public.owner_funding drop constraint if exists owner_funding_payment_method_check;
update public.owner_funding set payment_method = 'Cash' where payment_method <> 'Cash';
alter table public.owner_funding alter column payment_method set default 'Cash';
alter table public.owner_funding add constraint owner_funding_payment_method_check check (payment_method = 'Cash');

-- Migrates existing owner funding rows as incoming transactions.
alter table public.owner_funding add column if not exists direction text;
update public.owner_funding set direction = 'incoming' where direction is null;
alter table public.owner_funding alter column direction set default 'incoming';
alter table public.owner_funding alter column direction set not null;
alter table public.owner_funding drop constraint if exists owner_funding_direction_check;
alter table public.owner_funding add constraint owner_funding_direction_check check (direction in ('incoming', 'outgoing'));

alter table public.owner_funding enable row level security;

create policy "Authenticated users can read owner funding" on public.owner_funding for select to authenticated using (true);
create policy "Authenticated users can add owner funding" on public.owner_funding for insert to authenticated with check (true);
create policy "Authenticated users can update owner funding" on public.owner_funding for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete owner funding" on public.owner_funding for delete to authenticated using (true);

-- For a temporary no-auth prototype only:
-- create policy "Anon can read owner funding" on public.owner_funding for select to anon using (true);
-- create policy "Anon can add owner funding" on public.owner_funding for insert to anon with check (true);
-- create policy "Anon can delete owner funding" on public.owner_funding for delete to anon using (true);
