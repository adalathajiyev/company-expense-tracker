alter table public.cash_transfers
  add column if not exists from_account_name text,
  add column if not exists to_account_name text;

update public.cash_transfers transfer
set from_account_name = source.name,
    to_account_name = destination.name
from public.cash_accounts source,
     public.cash_accounts destination
where source.id = transfer.from_account_id
  and destination.id = transfer.to_account_id;

alter table public.cash_transfers
  alter column from_account_name set not null,
  alter column to_account_name set not null;

create or replace function private.validate_cash_transfer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  available_balance numeric(18, 2);
begin
  if (select private.current_app_role()) not in ('admin', 'main_accountant') then
    raise exception 'Only an Admin or Main Accountant can transfer cash';
  end if;

  if new.transfer_date > ((now() at time zone 'Asia/Baku')::date) then
    raise exception 'Transfer date cannot be in the future';
  end if;

  select account.name
  into new.from_account_name
  from public.cash_accounts account
  where account.id = new.from_account_id
    and account.is_active
  for update;

  if new.from_account_name is null then
    raise exception 'The source cash account is inactive or does not exist';
  end if;

  select account.name
  into new.to_account_name
  from public.cash_accounts account
  where account.id = new.to_account_id
    and account.is_active;

  if new.to_account_name is null then
    raise exception 'The destination cash account is inactive or does not exist';
  end if;

  select account.balance
  into available_balance
  from public.cash_account_balances account
  where account.id = new.from_account_id;

  if coalesce(available_balance, 0) < new.amount then
    raise exception 'Transfer exceeds the available source account balance';
  end if;

  return new;
end;
$$;

revoke execute on function private.validate_cash_transfer() from public, anon, authenticated;

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
  'balance-adjustment:' || adjustment.id::text,
  account.id,
  ((adjustment.created_at at time zone 'Asia/Baku')::date),
  'balance_adjustment',
  case when adjustment.direction = 'receivable' then 'inflow' else 'outflow' end,
  adjustment.amount::numeric(18, 2),
  concat('Other payment · ', adjustment.name, coalesce(' · ' || nullif(adjustment.description, ''), '')),
  'balance_adjustments',
  adjustment.id,
  null::text,
  adjustment.created_at
from public.balance_adjustments adjustment
join public.cash_accounts account on account.account_type = 'main'

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

create or replace view public.cash_account_balances
with (security_invoker = true)
as
select
  account.id,
  account.name,
  account.account_type,
  account.description,
  account.custodian_user_id,
  directory.email as custodian_email,
  account.is_active,
  coalesce(sum(
    case when ledger.direction = 'inflow' then ledger.amount else -ledger.amount end
  ), 0)::numeric(18, 2) as balance,
  max(ledger.transaction_date) as last_activity_date,
  account.created_at
from public.cash_accounts account
left join public.user_directory directory on directory.user_id = account.custodian_user_id
left join public.cash_account_ledger ledger on ledger.account_id = account.id
group by account.id, directory.email;

revoke all on table public.cash_account_ledger, public.cash_account_balances from public, anon;
grant select on table public.cash_account_ledger, public.cash_account_balances to authenticated, service_role;
