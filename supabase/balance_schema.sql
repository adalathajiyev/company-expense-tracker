create table if not exists public.balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  description text,
  amount numeric(12, 2) not null check (amount > 0),
  direction text not null check (direction in ('receivable', 'payable')),
  created_at timestamptz not null default now()
);

alter table public.balance_adjustments enable row level security;

revoke all on table public.balance_adjustments from anon;
grant select, insert, update, delete on table public.balance_adjustments to authenticated, service_role;

create policy "Authenticated users can read balance adjustments"
  on public.balance_adjustments for select to authenticated using (true);
create policy "Authenticated users can add balance adjustments"
  on public.balance_adjustments for insert to authenticated with check (true);
create policy "Authenticated users can update balance adjustments"
  on public.balance_adjustments for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete balance adjustments"
  on public.balance_adjustments for delete to authenticated using (true);

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
    coalesce((select sum(amount) from public.expenses where payment_method = 'Cash' and status = 'paid'), 0) as cash_expenses,
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
from totals;

revoke all on table public.cash_balance from anon;
grant select on table public.cash_balance to authenticated, service_role;
