-- Application roles and role-aware access control.
-- Existing users become administrators so this migration cannot lock them out.

do $$
begin
  create type public.app_role as enum ('admin', 'main_accountant', 'office_accountant');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

revoke all on table public.user_roles from anon;
grant select, insert, update, delete on table public.user_roles to authenticated, service_role;

insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role
from auth.users
on conflict (user_id) do nothing;

-- Keep authorization helpers outside exposed schemas. The function runs as its
-- owner so user_roles can protect itself without recursive RLS evaluation.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select user_role.role
  from public.user_roles user_role
  where user_role.user_id = (select auth.uid())
  limit 1;
$$;

revoke execute on function private.current_app_role() from public, anon;
grant execute on function private.current_app_role() to authenticated, service_role;

create policy "Users can read their own role"
  on public.user_roles
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.current_app_role()) = 'admin'
  );

create policy "Admins can add user roles"
  on public.user_roles
  for insert
  to authenticated
  with check ((select private.current_app_role()) = 'admin');

create policy "Admins can update user roles"
  on public.user_roles
  for update
  to authenticated
  using ((select private.current_app_role()) = 'admin')
  with check ((select private.current_app_role()) = 'admin');

create policy "Admins can delete user roles"
  on public.user_roles
  for delete
  to authenticated
  using ((select private.current_app_role()) = 'admin');

-- Store the sale's intended payment method. Existing rows are inferred from
-- their payment history; unpaid or mixed-method rows fall back to Cash.
alter table public.sales add column if not exists payment_method text;

update public.sales sale
set payment_method = case
  when exists (
    select 1 from public.sale_payments payment where payment.sale_id = sale.id
  ) and not exists (
    select 1
    from public.sale_payments payment
    where payment.sale_id = sale.id
      and payment.payment_method <> 'Bank transfer'
  ) then 'Bank transfer'
  else 'Cash'
end
where sale.payment_method is null;

alter table public.sales alter column payment_method set default 'Cash';
alter table public.sales alter column payment_method set not null;

do $$
begin
  alter table public.sales
    add constraint sales_payment_method_check
    check (payment_method in ('Cash', 'Bank transfer'));
exception
  when duplicate_object then null;
end
$$;

-- Remove the earlier permissive policies before installing role-aware ones.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'expenses',
        'owner_funding',
        'sales',
        'sale_payments',
        'worker_debts',
        'worker_debt_payments',
        'employees',
        'employee_daily_rates',
        'monthly_salaries',
        'salary_payments',
        'salary_month_closures',
        'salary_payment_allocations',
        'balance_adjustments'
      ])
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      policy_record.policyname,
      policy_record.tablename
    );
  end loop;
end
$$;

-- Admins and main accountants currently have complete business-data access.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'expenses',
    'owner_funding',
    'worker_debts',
    'worker_debt_payments',
    'employees',
    'employee_daily_rates',
    'monthly_salaries',
    'salary_payments',
    'salary_month_closures',
    'salary_payment_allocations',
    'balance_adjustments'
  ]
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select private.current_app_role()) in (''admin'', ''main_accountant'')) with check ((select private.current_app_role()) in (''admin'', ''main_accountant''))',
      table_name || '_privileged_access',
      table_name
    );
  end loop;
end
$$;

-- Office accountants can see sales and payment history, create only bank
-- transfer records, and cannot update or delete either kind of record.
create policy "Authorized users can read sales"
  on public.sales
  for select
  to authenticated
  using (
    (select private.current_app_role()) in (
      'admin',
      'main_accountant',
      'office_accountant'
    )
  );

create policy "Authorized users can add sales"
  on public.sales
  for insert
  to authenticated
  with check (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    or (
      (select private.current_app_role()) = 'office_accountant'
      and payment_method = 'Bank transfer'
    )
  );

create policy "Privileged users can update sales"
  on public.sales
  for update
  to authenticated
  using ((select private.current_app_role()) in ('admin', 'main_accountant'))
  with check ((select private.current_app_role()) in ('admin', 'main_accountant'));

create policy "Privileged users can delete sales"
  on public.sales
  for delete
  to authenticated
  using ((select private.current_app_role()) in ('admin', 'main_accountant'));

create policy "Authorized users can read sale payments"
  on public.sale_payments
  for select
  to authenticated
  using (
    (select private.current_app_role()) in (
      'admin',
      'main_accountant',
      'office_accountant'
    )
  );

create policy "Authorized users can add sale payments"
  on public.sale_payments
  for insert
  to authenticated
  with check (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    or (
      (select private.current_app_role()) = 'office_accountant'
      and payment_method = 'Bank transfer'
    )
  );

create policy "Privileged users can update sale payments"
  on public.sale_payments
  for update
  to authenticated
  using ((select private.current_app_role()) in ('admin', 'main_accountant'))
  with check ((select private.current_app_role()) in ('admin', 'main_accountant'));

create policy "Privileged users can delete sale payments"
  on public.sale_payments
  for delete
  to authenticated
  using ((select private.current_app_role()) in ('admin', 'main_accountant'));

-- Ensure the shared authenticated database role has the table privileges that
-- RLS will now narrow according to each application role.
grant select, insert, update, delete on table
  public.expenses,
  public.owner_funding,
  public.sales,
  public.sale_payments,
  public.worker_debts,
  public.worker_debt_payments,
  public.employees,
  public.employee_daily_rates,
  public.monthly_salaries,
  public.salary_payments,
  public.salary_month_closures,
  public.salary_payment_allocations,
  public.balance_adjustments
to authenticated, service_role;

-- The view remains security-invoker and now returns no balance row to an
-- office accountant, even though that role can read the sales source tables.
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
    coalesce((select sum(amount) from public.sale_payments where payment_method = 'Cash'), 0) as cash_sales,
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
