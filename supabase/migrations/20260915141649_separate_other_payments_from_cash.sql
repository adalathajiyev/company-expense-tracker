-- Receivables and payables describe obligations, not money already present in
-- a cash till. Only their settlements may affect a physical cash account.
create table public.balance_adjustment_settlements (
  id uuid primary key default gen_random_uuid(),
  balance_adjustment_id uuid not null references public.balance_adjustments(id) on delete restrict,
  payment_date date not null default ((now() at time zone 'Asia/Baku')::date),
  payment_method text not null check (payment_method in ('Cash', 'Bank transfer')),
  cash_account_id uuid references public.cash_accounts(id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text not null,
  created_at timestamptz not null default now(),
  constraint balance_adjustment_settlements_cash_account_check check (
    (payment_method = 'Cash' and cash_account_id is not null)
    or (payment_method = 'Bank transfer' and cash_account_id is null)
  )
);

create index balance_adjustment_settlements_adjustment_date_idx
  on public.balance_adjustment_settlements (balance_adjustment_id, payment_date desc);
create index balance_adjustment_settlements_cash_account_date_idx
  on public.balance_adjustment_settlements (cash_account_id, payment_date desc)
  where cash_account_id is not null;
create index balance_adjustment_settlements_created_by_idx
  on public.balance_adjustment_settlements (created_by);

alter table public.balance_adjustment_settlements enable row level security;

revoke all on table public.balance_adjustment_settlements from public, anon, authenticated;
grant select, insert, delete on table public.balance_adjustment_settlements to authenticated;
grant all on table public.balance_adjustment_settlements to service_role;

create policy "Privileged users can read other payment settlements"
  on public.balance_adjustment_settlements for select to authenticated
  using ((select private.current_app_role()) in ('admin', 'main_accountant'));

create policy "Privileged users can add other payment settlements"
  on public.balance_adjustment_settlements for insert to authenticated
  with check (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    and created_by = (select auth.uid())
  );

create policy "Privileged users can delete other payment settlements"
  on public.balance_adjustment_settlements for delete to authenticated
  using ((select private.current_app_role()) in ('admin', 'main_accountant'));

create trigger set_balance_adjustment_settlement_creator
before insert on public.balance_adjustment_settlements
for each row execute function private.set_record_creator();

create or replace function private.validate_balance_adjustment_settlement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  obligation_amount numeric(12, 2);
  already_settled numeric(12, 2);
begin
  if new.payment_date > ((now() at time zone 'Asia/Baku')::date) then
    raise exception 'Payment date cannot be in the future';
  end if;

  select adjustment.amount
  into obligation_amount
  from public.balance_adjustments adjustment
  where adjustment.id = new.balance_adjustment_id
  for update;

  if obligation_amount is null then
    raise exception 'The receivable or payable does not exist';
  end if;

  select coalesce(sum(settlement.amount), 0)
  into already_settled
  from public.balance_adjustment_settlements settlement
  where settlement.balance_adjustment_id = new.balance_adjustment_id;

  if already_settled + new.amount > obligation_amount then
    raise exception 'Payment exceeds the remaining amount';
  end if;

  if new.payment_method = 'Cash' and not exists (
    select 1
    from public.cash_accounts account
    where account.id = new.cash_account_id
      and account.is_active
  ) then
    raise exception 'Select an active cash account';
  end if;

  return new;
end;
$$;

revoke execute on function private.validate_balance_adjustment_settlement()
from public, anon, authenticated;

create trigger validate_balance_adjustment_settlement
before insert on public.balance_adjustment_settlements
for each row execute function private.validate_balance_adjustment_settlement();

create or replace view public.cash_account_ledger
with (security_invoker = true)
as
select
  'expense:' || expense.id::text as entry_key,
  expense.cash_account_id as account_id,
  expense.expense_date as transaction_date,
  'expense'::text as kind,
  'outflow'::text as direction,
  expense.amount::numeric(18, 2) as amount,
  concat('Expense · ', expense.merchant, coalesce(' · ' || nullif(expense.description, ''), '')) as description,
  'expenses'::text as source_type,
  expense.id as source_id,
  expense.created_by_email,
  expense.created_at
from public.expenses expense
where expense.payment_method = 'Cash'
  and expense.status = 'paid'
  and expense.salary_source_id is null

union all

select
  'customer-payment:' || payment.id::text,
  account.id,
  payment.payment_date,
  'customer_payment',
  'inflow',
  payment.amount::numeric(18, 2),
  concat('Customer payment · ', customer.name, coalesce(' · ' || nullif(payment.note, ''), '')),
  'customer_payments',
  payment.id,
  payment.created_by_email,
  payment.created_at
from public.customer_payments payment
join public.customers customer on customer.id = payment.customer_id
join public.cash_accounts account on account.account_type = 'main'
where payment.payment_method = 'Cash'

union all

select
  'owner-funding:' || funding.id::text,
  account.id,
  funding.funding_date,
  'owner_funding',
  case when funding.direction = 'incoming' then 'inflow' else 'outflow' end,
  funding.amount::numeric(18, 2),
  concat('Owner funding · ', funding.owner_name, coalesce(' · ' || nullif(funding.description, ''), '')),
  'owner_funding',
  funding.id,
  funding.created_by_email,
  funding.created_at
from public.owner_funding funding
join public.cash_accounts account on account.account_type = 'main'

union all

select
  'salary-payment:' || payment.id::text,
  account.id,
  payment.payment_date,
  'salary_payment',
  'outflow',
  payment.amount::numeric(18, 2),
  concat('Salary cash · ', employee.name, coalesce(' · ' || nullif(payment.note, ''), '')),
  'salary_payments',
  payment.id,
  null::text,
  payment.created_at
from public.salary_payments payment
join public.monthly_salaries salary on salary.id = payment.monthly_salary_id
join public.employees employee on employee.id = salary.employee_id
join public.cash_accounts account on account.account_type = 'main'
where payment.payment_type = 'cash_payment'

union all

select
  'worker-debt:' || debt.id::text,
  account.id,
  debt.debt_date,
  'worker_debt',
  'outflow',
  debt.amount::numeric(18, 2),
  concat('Worker debt · ', debt.worker_name, coalesce(' · ' || nullif(debt.description, ''), '')),
  'worker_debts',
  debt.id,
  null::text,
  debt.created_at
from public.worker_debts debt
join public.cash_accounts account on account.account_type = 'main'

union all

select
  'worker-debt-payment:' || payment.id::text,
  account.id,
  payment.payment_date,
  'worker_debt_payment',
  'inflow',
  payment.amount::numeric(18, 2),
  concat('Worker debt repayment · ', debt.worker_name, coalesce(' · ' || nullif(payment.note, ''), '')),
  'worker_debt_payments',
  payment.id,
  null::text,
  payment.created_at
from public.worker_debt_payments payment
join public.worker_debts debt on debt.id = payment.debt_id
join public.cash_accounts account on account.account_type = 'main'

union all

select
  'other-payment-settlement:' || settlement.id::text,
  settlement.cash_account_id,
  settlement.payment_date,
  'other_payment',
  case when adjustment.direction = 'receivable' then 'inflow' else 'outflow' end,
  settlement.amount::numeric(18, 2),
  concat(
    case when adjustment.direction = 'receivable' then 'Other payment received · ' else 'Other payment paid · ' end,
    adjustment.name,
    coalesce(' · ' || nullif(settlement.note, ''), '')
  ),
  'balance_adjustment_settlements',
  settlement.id,
  settlement.created_by_email,
  settlement.created_at
from public.balance_adjustment_settlements settlement
join public.balance_adjustments adjustment on adjustment.id = settlement.balance_adjustment_id
where settlement.payment_method = 'Cash'

union all

select
  'transfer-out:' || transfer.id::text,
  transfer.from_account_id,
  transfer.transfer_date,
  'transfer',
  'outflow',
  transfer.amount::numeric(18, 2),
  concat('Transfer to ', transfer.to_account_name, coalesce(' · ' || nullif(transfer.description, ''), '')),
  'cash_transfers',
  transfer.id,
  transfer.created_by_email,
  transfer.created_at
from public.cash_transfers transfer
where (select private.current_app_role()) in ('admin', 'main_accountant')
  or exists (
    select 1
    from public.cash_account_members member
    join public.cash_accounts account on account.id = member.account_id
    where member.account_id = transfer.from_account_id
      and member.user_id = (select auth.uid())
      and account.account_type <> 'main'
  )

union all

select
  'transfer-in:' || transfer.id::text,
  transfer.to_account_id,
  transfer.transfer_date,
  'transfer',
  'inflow',
  transfer.amount::numeric(18, 2),
  concat('Transfer from ', transfer.from_account_name, coalesce(' · ' || nullif(transfer.description, ''), '')),
  'cash_transfers',
  transfer.id,
  transfer.created_by_email,
  transfer.created_at
from public.cash_transfers transfer
where (select private.current_app_role()) in ('admin', 'main_accountant')
  or exists (
    select 1
    from public.cash_account_members member
    join public.cash_accounts account on account.id = member.account_id
    where member.account_id = transfer.to_account_id
      and member.user_id = (select auth.uid())
      and account.account_type <> 'main'
  );

revoke all on table public.cash_account_ledger from public, anon;
grant select on table public.cash_account_ledger to authenticated, service_role;

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
), settlement_totals as (
  select settlement.balance_adjustment_id, sum(settlement.amount) as settled_amount
  from public.balance_adjustment_settlements settlement
  group by settlement.balance_adjustment_id
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
    coalesce((
      select sum(greatest(adjustment.amount - coalesce(settlement.settled_amount, 0), 0))
      from public.balance_adjustments adjustment
      left join settlement_totals settlement on settlement.balance_adjustment_id = adjustment.id
      where adjustment.direction = 'receivable'
    ), 0) as payments_to_receive,
    coalesce((
      select sum(greatest(adjustment.amount - coalesce(settlement.settled_amount, 0), 0))
      from public.balance_adjustments adjustment
      left join settlement_totals settlement on settlement.balance_adjustment_id = adjustment.id
      where adjustment.direction = 'payable'
    ), 0) as payments_to_pay,
    coalesce((select sum(account.balance) from public.cash_account_balances account), 0) as physical_cash
)
select
  cash_sales::numeric(12, 2) as cash_sales,
  owner_funding::numeric(12, 2) as owner_funding,
  cash_expenses::numeric(12, 2) as cash_expenses,
  physical_cash::numeric(12, 2) as balance,
  remaining_debts::numeric(12, 2) as remaining_debts,
  cash_salary_payments::numeric(12, 2) as cash_salary_payments,
  payments_to_receive::numeric(12, 2) as payments_to_receive,
  payments_to_pay::numeric(12, 2) as payments_to_pay
from totals
where (select private.current_app_role()) in ('admin', 'main_accountant');

revoke all on table public.cash_balance from public, anon;
grant select on table public.cash_balance to authenticated, service_role;
