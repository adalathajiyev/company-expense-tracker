-- Keep accounting dates consistent with the company business timezone even
-- when a write comes directly through the API instead of the React client.
alter table public.expenses
  alter column expense_date set default ((now() at time zone 'Asia/Baku')::date);
alter table public.owner_funding
  alter column funding_date set default ((now() at time zone 'Asia/Baku')::date);
alter table public.sales
  alter column sale_date set default ((now() at time zone 'Asia/Baku')::date);
alter table public.customer_payments
  alter column payment_date set default ((now() at time zone 'Asia/Baku')::date);
alter table public.worker_debts
  alter column debt_date set default ((now() at time zone 'Asia/Baku')::date);
alter table public.worker_debt_payments
  alter column payment_date set default ((now() at time zone 'Asia/Baku')::date);
alter table public.salary_payments
  alter column payment_date set default ((now() at time zone 'Asia/Baku')::date);

-- current_date observes the function's TimeZone setting. Pin the functions
-- that validate or generate business dates so the rule is deterministic.
alter function public.validate_worker_debt_payment_total()
  set timezone = 'Asia/Baku';
alter function public.validate_salary_payment_date()
  set timezone = 'Asia/Baku';
alter function public.validate_customer_payment()
  set timezone = 'Asia/Baku';
alter function public.close_previous_salary_month_and_generate(date)
  set timezone = 'Asia/Baku';

-- An employee and their initial rate form one logical write. This RPC avoids a
-- half-created employee if inserting the rate fails.
create or replace function public.create_employee_with_rate(
  p_name text,
  p_daily_rate numeric,
  p_effective_from date
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_employee_id uuid;
begin
  if nullif(btrim(p_name), '') is null then
    raise exception 'Employee name is required';
  end if;
  if p_daily_rate is null or p_daily_rate <= 0 then
    raise exception 'Daily rate must be greater than zero';
  end if;
  if p_effective_from is null then
    raise exception 'Effective date is required';
  end if;

  insert into public.employees (name)
  values (btrim(p_name))
  returning id into new_employee_id;

  insert into public.employee_daily_rates (
    employee_id,
    daily_rate,
    effective_from
  ) values (
    new_employee_id,
    p_daily_rate,
    p_effective_from
  );

  return new_employee_id;
end;
$$;

revoke execute on function public.create_employee_with_rate(text, numeric, date)
  from public, anon;
grant execute on function public.create_employee_with_rate(text, numeric, date)
  to authenticated, service_role;

-- Carryover is only unambiguous when an employee has one open salary month.
-- Existing historical rows remain readable; this protects new/moved rows.
create or replace function public.validate_open_monthly_salary()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_business_month date;
begin
  current_business_month := date_trunc(
    'month',
    (now() at time zone 'Asia/Baku')::date
  )::date;

  if new.salary_month > current_business_month then
    raise exception 'A future salary month cannot be created';
  end if;

  if exists (
    select 1
    from public.monthly_salaries salary
    where salary.employee_id = new.employee_id
      and salary.id <> new.id
      and salary.salary_month <> new.salary_month
      and salary.closed_at is null
  ) then
    raise exception 'Close the employee''s existing salary month before creating another';
  end if;

  return new;
end;
$$;

revoke execute on function public.validate_open_monthly_salary()
  from public, anon, authenticated;
drop trigger if exists validate_open_monthly_salary on public.monthly_salaries;
create trigger validate_open_monthly_salary
before insert or update of employee_id, salary_month on public.monthly_salaries
for each row execute function public.validate_open_monthly_salary();

-- A pending expense is a liability, not cash that has already left the till.
create or replace view public.cash_balance
with (security_invoker = true)
as
with salary_payment_allocation_totals as (
  select allocation.payment_id, sum(allocation.amount) as allocated_amount
  from public.salary_payment_allocations allocation
  join public.monthly_salaries salary
    on salary.id = allocation.monthly_salary_id
  where salary.closed_at is not null
  group by allocation.payment_id
), totals as (
  select
    coalesce((
      select sum(amount)
      from public.customer_payments
      where payment_method = 'Cash'
    ), 0) as cash_sales,
    coalesce((
      select sum(case when direction = 'incoming' then amount else -amount end)
      from public.owner_funding
    ), 0) as owner_funding,
    coalesce((
      select sum(amount)
      from public.expenses
      where payment_method = 'Cash'
        and status = 'paid'
    ), 0) as cash_expenses,
    coalesce((
      select sum(greatest(payment.amount - coalesce(allocation.allocated_amount, 0), 0))
      from public.salary_payments payment
      left join salary_payment_allocation_totals allocation
        on allocation.payment_id = payment.id
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
    coalesce((
      select sum(amount)
      from public.balance_adjustments
      where direction = 'receivable'
    ), 0) as payments_to_receive,
    coalesce((
      select sum(amount)
      from public.balance_adjustments
      where direction = 'payable'
    ), 0) as payments_to_pay
)
select
  cash_sales::numeric(12, 2) as cash_sales,
  owner_funding::numeric(12, 2) as owner_funding,
  cash_expenses::numeric(12, 2) as cash_expenses,
  (
    cash_sales + owner_funding + payments_to_receive
    - cash_expenses - remaining_debts - cash_salary_payments - payments_to_pay
  )::numeric(12, 2) as balance,
  remaining_debts::numeric(12, 2) as remaining_debts,
  cash_salary_payments::numeric(12, 2) as cash_salary_payments,
  payments_to_receive::numeric(12, 2) as payments_to_receive,
  payments_to_pay::numeric(12, 2) as payments_to_pay
from totals
where (select private.current_app_role()) in ('admin', 'main_accountant');

revoke all on table public.cash_balance from public, anon;
grant select on table public.cash_balance to authenticated, service_role;
