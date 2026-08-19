create extension if not exists "pgcrypto";

create table if not exists public.worker_debts (
  id uuid primary key default gen_random_uuid(),
  debt_date date not null default current_date,
  worker_name text not null check (length(btrim(worker_name)) > 0),
  description text,
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists worker_debts_debt_date_idx on public.worker_debts (debt_date desc);

create table if not exists public.worker_debt_payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.worker_debts(id) on delete cascade,
  payment_date date not null default current_date,
  amount numeric(12, 2) not null check (amount > 0),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists worker_debt_payments_debt_id_date_idx on public.worker_debt_payments (debt_id, payment_date desc);

create or replace function public.validate_worker_debt_payment_total()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare debt_total numeric(12, 2); existing_total numeric(12, 2);
begin
  if new.payment_date > current_date then raise exception 'Payment date cannot be in the future'; end if;
  select amount into debt_total from public.worker_debts where id = new.debt_id for update;
  if debt_total is null then raise exception 'Worker debt does not exist'; end if;
  select coalesce(sum(amount), 0) into existing_total from public.worker_debt_payments where debt_id = new.debt_id and id <> new.id;
  if existing_total + new.amount > debt_total then raise exception 'Payment exceeds remaining debt balance'; end if;
  return new;
end; $$;

revoke execute on function public.validate_worker_debt_payment_total() from public, anon, authenticated;
drop trigger if exists validate_worker_debt_payment_total on public.worker_debt_payments;
create trigger validate_worker_debt_payment_total before insert or update on public.worker_debt_payments for each row execute function public.validate_worker_debt_payment_total();

alter table public.worker_debts enable row level security;
alter table public.worker_debt_payments enable row level security;
grant select, insert, update, delete on public.worker_debts, public.worker_debt_payments to authenticated, service_role;
revoke all on public.worker_debts, public.worker_debt_payments from anon;

create policy "Authenticated users can read worker debts" on public.worker_debts for select to authenticated using (true);
create policy "Authenticated users can add worker debts" on public.worker_debts for insert to authenticated with check (true);
create policy "Authenticated users can update worker debts" on public.worker_debts for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete worker debts" on public.worker_debts for delete to authenticated using (true);
create policy "Authenticated users can read worker debt payments" on public.worker_debt_payments for select to authenticated using (true);
create policy "Authenticated users can add worker debt payments" on public.worker_debt_payments for insert to authenticated with check (true);
create policy "Authenticated users can update worker debt payments" on public.worker_debt_payments for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete worker debt payments" on public.worker_debt_payments for delete to authenticated using (true);
