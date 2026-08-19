create extension if not exists "pgcrypto";

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  sale_date date not null default current_date,
  product text not null check (length(btrim(product)) > 0),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit text not null check (length(btrim(unit)) > 0),
  unit_price numeric(12, 2) not null check (unit_price > 0),
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  constraint sales_amount_calculation_check check (amount = round(quantity * unit_price, 2))
);

create index if not exists sales_sale_date_idx on public.sales (sale_date desc);

create table if not exists public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  payment_date date not null default current_date,
  amount numeric(12, 2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('Cash', 'Bank transfer')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists sale_payments_sale_id_date_idx on public.sale_payments (sale_id, payment_date desc);

create or replace function public.validate_sale_payment_total()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare sale_total numeric(12, 2); existing_total numeric(12, 2);
begin
  if new.payment_date > current_date then raise exception 'Payment date cannot be in the future'; end if;
  select amount into sale_total from public.sales where id = new.sale_id for update;
  if sale_total is null then raise exception 'Sale does not exist'; end if;
  select coalesce(sum(amount), 0) into existing_total from public.sale_payments where sale_id = new.sale_id and id <> new.id;
  if existing_total + new.amount > sale_total then raise exception 'Payment exceeds remaining sale balance'; end if;
  return new;
end; $$;

revoke execute on function public.validate_sale_payment_total() from public, anon, authenticated;
drop trigger if exists validate_sale_payment_total on public.sale_payments;
create trigger validate_sale_payment_total before insert or update on public.sale_payments for each row execute function public.validate_sale_payment_total();

alter table public.sales enable row level security;
alter table public.sale_payments enable row level security;
grant select, insert, update, delete on public.sales, public.sale_payments to authenticated, service_role;
revoke all on public.sales, public.sale_payments from anon;

create policy "Authenticated users can read sales" on public.sales for select to authenticated using (true);
create policy "Authenticated users can add sales" on public.sales for insert to authenticated with check (true);
create policy "Authenticated users can update sales" on public.sales for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete sales" on public.sales for delete to authenticated using (true);
create policy "Authenticated users can read sale payments" on public.sale_payments for select to authenticated using (true);
create policy "Authenticated users can add sale payments" on public.sale_payments for insert to authenticated with check (true);
create policy "Authenticated users can update sale payments" on public.sale_payments for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete sale payments" on public.sale_payments for delete to authenticated using (true);
