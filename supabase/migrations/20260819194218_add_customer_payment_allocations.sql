-- Replace sale-bound payment rows with a customer receipt ledger and explicit
-- allocations. A receipt changes cash once; allocations only explain which
-- sales that receipt settles.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now()
);

create index customers_name_idx on public.customers (lower(name));

alter table public.sales add column customer_id uuid;

do $$
declare
  legacy_customer_id uuid;
begin
  if exists (select 1 from public.sales) then
    insert into public.customers (name)
    values ('Legacy / Unassigned Customer')
    returning id into legacy_customer_id;

    update public.sales
    set customer_id = legacy_customer_id
    where customer_id is null;
  end if;
end
$$;

alter table public.sales alter column customer_id set not null;
alter table public.sales
  add constraint sales_customer_id_fkey
  foreign key (customer_id) references public.customers(id) on delete restrict;

create index sales_customer_id_sale_date_idx
  on public.sales (customer_id, sale_date desc);

create table public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  payment_date date not null default current_date,
  amount numeric(12, 2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('Cash', 'Bank transfer')),
  reference text,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text not null,
  created_at timestamptz not null default now()
);

create index customer_payments_customer_id_date_idx
  on public.customer_payments (customer_id, payment_date desc);
create index customer_payments_created_by_idx
  on public.customer_payments (created_by);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.customer_payments(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  constraint payment_allocations_payment_sale_key unique (payment_id, sale_id)
);

create index payment_allocations_sale_id_idx
  on public.payment_allocations (sale_id);

-- Preserve every historical payment as one customer receipt allocated to its
-- original sale. Reusing its UUID keeps the audit trail easy to compare.
insert into public.customer_payments (
  id,
  customer_id,
  payment_date,
  amount,
  payment_method,
  note,
  created_by,
  created_by_email,
  created_at
)
select
  payment.id,
  sale.customer_id,
  payment.payment_date,
  payment.amount,
  payment.payment_method,
  payment.note,
  payment.created_by,
  payment.created_by_email,
  payment.created_at
from public.sale_payments payment
join public.sales sale on sale.id = payment.sale_id;

insert into public.payment_allocations (
  payment_id,
  sale_id,
  amount,
  created_at
)
select id, sale_id, amount, created_at
from public.sale_payments;

create or replace function public.validate_customer_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allocated_amount numeric(12, 2);
begin
  if new.payment_date > current_date then
    raise exception 'Payment date cannot be in the future';
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(sum(allocation.amount), 0)
    into allocated_amount
    from public.payment_allocations allocation
    where allocation.payment_id = new.id;

    if allocated_amount > new.amount then
      raise exception 'Payment amount cannot be less than its allocated amount';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.validate_customer_payment()
  from public, anon, authenticated;

create trigger validate_customer_payment
before insert or update on public.customer_payments
for each row execute function public.validate_customer_payment();

create or replace function public.validate_payment_allocation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_customer_id uuid;
  payment_total numeric(12, 2);
  sale_customer_id uuid;
  sale_total numeric(12, 2);
  payment_allocated numeric(12, 2);
  sale_allocated numeric(12, 2);
begin
  -- Always lock the receipt before the sale so concurrent allocations use a
  -- consistent lock order.
  select payment.customer_id, payment.amount
  into payment_customer_id, payment_total
  from public.customer_payments payment
  where payment.id = new.payment_id
  for update;

  if payment_customer_id is null then
    raise exception 'Customer payment does not exist';
  end if;

  select sale.customer_id, sale.amount
  into sale_customer_id, sale_total
  from public.sales sale
  where sale.id = new.sale_id
  for update;

  if sale_customer_id is null then
    raise exception 'Sale does not exist';
  end if;

  if payment_customer_id <> sale_customer_id then
    raise exception 'A payment can only be allocated to a sale for the same customer';
  end if;

  select coalesce(sum(allocation.amount), 0)
  into payment_allocated
  from public.payment_allocations allocation
  where allocation.payment_id = new.payment_id
    and allocation.id <> new.id;

  if payment_allocated + new.amount > payment_total then
    raise exception 'Allocations exceed the customer payment amount';
  end if;

  select coalesce(sum(allocation.amount), 0)
  into sale_allocated
  from public.payment_allocations allocation
  where allocation.sale_id = new.sale_id
    and allocation.id <> new.id;

  if sale_allocated + new.amount > sale_total then
    raise exception 'Allocation exceeds the remaining sale balance';
  end if;

  return new;
end;
$$;

revoke execute on function public.validate_payment_allocation()
  from public, anon, authenticated;

create trigger validate_payment_allocation
before insert or update on public.payment_allocations
for each row execute function public.validate_payment_allocation();

create or replace function private.protect_allocated_sale_customer()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.customer_id <> old.customer_id
    and exists (
      select 1
      from public.payment_allocations allocation
      where allocation.sale_id = old.id
    )
  then
    raise exception 'A sale with allocated payments cannot be reassigned';
  end if;

  return new;
end;
$$;

revoke execute on function private.protect_allocated_sale_customer()
  from public, anon, authenticated;

create trigger protect_allocated_sale_customer
before update of customer_id on public.sales
for each row execute function private.protect_allocated_sale_customer();

-- Reuse the existing immutable creator trigger for receipts.
create trigger set_customer_payment_creator
before insert or update on public.customer_payments
for each row execute function private.set_record_creator();

alter table public.customers enable row level security;
alter table public.customer_payments enable row level security;
alter table public.payment_allocations enable row level security;

revoke all on table
  public.customers,
  public.customer_payments,
  public.payment_allocations
from anon;

grant select, insert, update, delete on table public.customers
  to authenticated, service_role;
grant select, insert, delete on table public.customer_payments
  to authenticated;
grant select, insert, update, delete on table public.customer_payments
  to service_role;
grant select, insert on table public.payment_allocations
  to authenticated;
grant select, insert, update, delete on table public.payment_allocations
  to service_role;

create policy "Authorized users can read customers"
  on public.customers for select to authenticated
  using (
    (select private.current_app_role()) in (
      'admin',
      'main_accountant',
      'office_accountant'
    )
  );

create policy "Authorized users can add customers"
  on public.customers for insert to authenticated
  with check (
    (select private.current_app_role()) in (
      'admin',
      'main_accountant',
      'office_accountant'
    )
  );

create policy "Privileged users can update customers"
  on public.customers for update to authenticated
  using ((select private.current_app_role()) in ('admin', 'main_accountant'))
  with check ((select private.current_app_role()) in ('admin', 'main_accountant'));

create policy "Privileged users can delete customers"
  on public.customers for delete to authenticated
  using ((select private.current_app_role()) in ('admin', 'main_accountant'));

create policy "Authorized users can read customer payments"
  on public.customer_payments for select to authenticated
  using (
    (select private.current_app_role()) in (
      'admin',
      'main_accountant',
      'office_accountant'
    )
  );

create policy "Authorized users can add customer payments"
  on public.customer_payments for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (select private.current_app_role()) in ('admin', 'main_accountant')
      or (
        (select private.current_app_role()) = 'office_accountant'
        and payment_method = 'Bank transfer'
      )
    )
  );

create policy "Admins or creators can delete customer payments"
  on public.customer_payments for delete to authenticated
  using (
    (select private.current_app_role()) = 'admin'
    or (
      (select private.current_app_role()) in ('main_accountant', 'office_accountant')
      and created_by = (select auth.uid())
    )
  );

create policy "Authorized users can read payment allocations"
  on public.payment_allocations for select to authenticated
  using (
    (select private.current_app_role()) in (
      'admin',
      'main_accountant',
      'office_accountant'
    )
  );

create policy "Receipt creators can add payment allocations"
  on public.payment_allocations for insert to authenticated
  with check (
    (select private.current_app_role()) in (
      'admin',
      'main_accountant',
      'office_accountant'
    )
    and exists (
      select 1
      from public.customer_payments payment
      where payment.id = payment_allocations.payment_id
        and payment.created_by = (select auth.uid())
        and (
          (select private.current_app_role()) <> 'office_accountant'
          or payment.payment_method = 'Bank transfer'
        )
    )
  );

create or replace function public.record_customer_payment(
  p_customer_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_payment_method text,
  p_reference text default null,
  p_note text default null,
  p_allocations jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_payment_id uuid;
  allocation_count bigint;
  distinct_sale_count bigint;
  allocated_total numeric(12, 2);
begin
  if p_allocations is null then
    p_allocations := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_allocations) <> 'array' then
    raise exception 'Payment allocations must be a JSON array';
  end if;

  select
    count(*),
    count(distinct allocation.sale_id),
    coalesce(sum(allocation.amount), 0)
  into allocation_count, distinct_sale_count, allocated_total
  from jsonb_to_recordset(p_allocations)
    as allocation(sale_id uuid, amount numeric);

  if allocation_count <> distinct_sale_count then
    raise exception 'A sale can only appear once in a payment allocation';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_allocations)
      as allocation(sale_id uuid, amount numeric)
    where allocation.sale_id is null
      or allocation.amount is null
      or allocation.amount <= 0
  ) then
    raise exception 'Every allocation requires a sale and a positive amount';
  end if;

  if allocated_total > p_amount then
    raise exception 'Allocations exceed the customer payment amount';
  end if;

  insert into public.customer_payments (
    customer_id,
    payment_date,
    amount,
    payment_method,
    reference,
    note
  )
  values (
    p_customer_id,
    p_payment_date,
    p_amount,
    p_payment_method,
    nullif(btrim(p_reference), ''),
    nullif(btrim(p_note), '')
  )
  returning id into new_payment_id;

  insert into public.payment_allocations (payment_id, sale_id, amount)
  select new_payment_id, allocation.sale_id, allocation.amount
  from jsonb_to_recordset(p_allocations)
    as allocation(sale_id uuid, amount numeric)
  order by allocation.sale_id;

  return new_payment_id;
end;
$$;

revoke execute on function public.record_customer_payment(
  uuid,
  date,
  numeric,
  text,
  text,
  text,
  jsonb
) from public, anon;
grant execute on function public.record_customer_payment(
  uuid,
  date,
  numeric,
  text,
  text,
  text,
  jsonb
) to authenticated, service_role;

-- Cash is counted from receipts, never allocations, so one receipt affects the
-- cash balance exactly once even when it covers several sales.
create or replace view public.cash_balance
with (security_invoker = true)
as
with salary_payment_allocation_totals as (
  select allocation.payment_id, sum(allocation.amount) as allocated_amount
  from public.salary_payment_allocations allocation
  join public.monthly_salaries salary on salary.id = allocation.monthly_salary_id
  where salary.closed_at is not null
  group by allocation.payment_id
), totals as (
  select
    coalesce((select sum(amount) from public.customer_payments where payment_method = 'Cash'), 0) as cash_sales,
    coalesce((select sum(case when direction = 'incoming' then amount else -amount end) from public.owner_funding), 0) as owner_funding,
    coalesce((select sum(amount) from public.expenses where payment_method = 'Cash'), 0) as cash_expenses,
    coalesce((
      select sum(greatest(payment.amount - coalesce(allocation.allocated_amount, 0), 0))
      from public.salary_payments payment
      left join salary_payment_allocation_totals allocation on allocation.payment_id = payment.id
      where payment.payment_type = 'cash_payment'
    ), 0) as cash_salary_payments,
    coalesce((
      select sum(debt.amount - coalesce(payments.paid_amount, 0))
      from public.worker_debts debt
      left join (
        select debt_id, sum(amount) as paid_amount
        from public.worker_debt_payments
        group by debt_id
      ) payments on payments.debt_id = debt.id
    ), 0) as remaining_debts,
    coalesce((select sum(amount) from public.balance_adjustments where direction = 'receivable'), 0) as payments_to_receive,
    coalesce((select sum(amount) from public.balance_adjustments where direction = 'payable'), 0) as payments_to_pay
)
select
  cash_sales::numeric(12, 2) as cash_sales,
  owner_funding::numeric(12, 2) as owner_funding,
  cash_expenses::numeric(12, 2) as cash_expenses,
  (cash_sales + owner_funding + payments_to_receive - cash_expenses - remaining_debts - cash_salary_payments - payments_to_pay)::numeric(12, 2) as balance,
  remaining_debts::numeric(12, 2) as remaining_debts,
  cash_salary_payments::numeric(12, 2) as cash_salary_payments,
  payments_to_receive::numeric(12, 2) as payments_to_receive,
  payments_to_pay::numeric(12, 2) as payments_to_pay
from totals
where (select private.current_app_role()) in ('admin', 'main_accountant');

revoke all on table public.cash_balance from anon;
grant select on table public.cash_balance to authenticated, service_role;

drop trigger if exists protect_sale_payment_ownership_on_delete on public.sales;
drop function if exists private.protect_sale_payment_ownership_on_delete();
drop trigger if exists validate_sale_payment_total on public.sale_payments;
drop function if exists public.validate_sale_payment_total();
drop table public.sale_payments;
