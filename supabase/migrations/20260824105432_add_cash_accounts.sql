-- Universal cash custody accounts. Operational tables remain the source of
-- truth; the ledger view below assembles every physical-cash movement without
-- duplicating financial records.

create table public.cash_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  account_type text not null check (account_type in ('main', 'project', 'employee_float')),
  description text,
  custodian_user_id uuid references auth.users(id) on delete set null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text not null,
  created_at timestamptz not null default now()
);

create unique index cash_accounts_name_key on public.cash_accounts (lower(name));
create unique index cash_accounts_single_main_idx on public.cash_accounts (account_type) where account_type = 'main';
create index cash_accounts_custodian_idx on public.cash_accounts (custodian_user_id) where custodian_user_id is not null;

create table public.cash_account_members (
  account_id uuid not null references public.cash_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null default 'manager' check (permission in ('viewer', 'spender', 'manager')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (account_id, user_id)
);

create index cash_account_members_user_idx on public.cash_account_members (user_id, account_id);

create table public.cash_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_date date not null default ((now() at time zone 'Asia/Baku')::date),
  from_account_id uuid not null references public.cash_accounts(id) on delete restrict,
  to_account_id uuid not null references public.cash_accounts(id) on delete restrict,
  from_account_name text not null,
  to_account_name text not null,
  amount numeric(18, 2) not null check (amount > 0),
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text not null,
  created_at timestamptz not null default now(),
  constraint cash_transfers_different_accounts_check check (from_account_id <> to_account_id)
);

create index cash_transfers_from_date_idx on public.cash_transfers (from_account_id, transfer_date desc);
create index cash_transfers_to_date_idx on public.cash_transfers (to_account_id, transfer_date desc);

create table public.cash_reconciliations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.cash_accounts(id) on delete restrict,
  reconciliation_date date not null default ((now() at time zone 'Asia/Baku')::date),
  expected_balance numeric(18, 2) not null,
  counted_balance numeric(18, 2) not null check (counted_balance >= 0),
  variance numeric(18, 2) not null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text not null,
  created_at timestamptz not null default now()
);

create index cash_reconciliations_account_date_idx on public.cash_reconciliations (account_id, reconciliation_date desc);

alter table public.expenses add column cash_account_id uuid references public.cash_accounts(id) on delete restrict;
create index expenses_cash_account_date_idx on public.expenses (cash_account_id, expense_date desc) where cash_account_id is not null;

-- Attribute the main till to the first Main Accountant when one exists, or to
-- the oldest Admin in installations that do not yet have that role assigned.
do $$
declare
  main_account_id uuid;
  main_custodian_id uuid;
  creator_id uuid;
  creator_email text;
begin
  select role_row.user_id
  into main_custodian_id
  from public.user_roles role_row
  where role_row.role = 'main_accountant'
  order by role_row.created_at, role_row.user_id
  limit 1;

  select role_row.user_id, directory.email
  into creator_id, creator_email
  from public.user_roles role_row
  left join public.user_directory directory on directory.user_id = role_row.user_id
  where role_row.role = 'admin'
  order by role_row.created_at, role_row.user_id
  limit 1;

  if creator_id is null then
    raise exception 'An Admin role is required to create the Main Cash account';
  end if;

  insert into public.cash_accounts (
    name,
    account_type,
    description,
    custodian_user_id,
    created_by,
    created_by_email
  ) values (
    'Main Cash',
    'main',
    'Primary company cash held by the main accountant',
    coalesce(main_custodian_id, creator_id),
    creator_id,
    coalesce(creator_email, creator_id::text)
  )
  returning id into main_account_id;

  insert into public.cash_account_members (account_id, user_id, permission, created_by)
  values (main_account_id, coalesce(main_custodian_id, creator_id), 'manager', creator_id);

  update public.expenses
  set cash_account_id = main_account_id
  where payment_method = 'Cash';
end;
$$;

alter table public.expenses
  add constraint expenses_cash_account_check
  check (payment_method <> 'Cash' or cash_account_id is not null);

-- Existing creator metadata protection is reused for every new audited table.
create trigger set_cash_account_creator
before insert or update on public.cash_accounts
for each row execute function private.set_record_creator();

create trigger set_cash_transfer_creator
before insert or update on public.cash_transfers
for each row execute function private.set_record_creator();

create trigger set_cash_reconciliation_creator
before insert or update on public.cash_reconciliations
for each row execute function private.set_record_creator();

-- Cash expenses default to the main till for trusted accounting workflows such
-- as generated salary expenses. A delegated user still cannot insert against
-- Main Cash because the RLS membership check happens after this trigger.
create or replace function private.assign_expense_cash_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_method = 'Cash' then
    if new.cash_account_id is null then
      select account.id
      into new.cash_account_id
      from public.cash_accounts account
      where account.account_type = 'main'
        and account.is_active;
    end if;

    if new.cash_account_id is null then
      raise exception 'An active cash account is required for a cash expense';
    end if;

    if not exists (
      select 1
      from public.cash_accounts account
      where account.id = new.cash_account_id
        and account.is_active
    ) then
      raise exception 'The selected cash account is inactive or does not exist';
    end if;
  else
    new.cash_account_id := null;
  end if;

  return new;
end;
$$;

revoke execute on function private.assign_expense_cash_account() from public, anon, authenticated;

create trigger assign_expense_cash_account
before insert or update of payment_method, cash_account_id on public.expenses
for each row execute function private.assign_expense_cash_account();

alter table public.cash_accounts enable row level security;
alter table public.cash_account_members enable row level security;
alter table public.cash_transfers enable row level security;
alter table public.cash_reconciliations enable row level security;

revoke all on table public.cash_accounts, public.cash_account_members, public.cash_transfers, public.cash_reconciliations from public, anon;
grant select, insert, update on table public.cash_accounts to authenticated, service_role;
grant select, insert, update, delete on table public.cash_account_members to authenticated, service_role;
grant select, insert on table public.cash_transfers, public.cash_reconciliations to authenticated, service_role;

create policy "Authorized users can read cash accounts"
  on public.cash_accounts for select to authenticated
  using (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    or (
      (select private.current_app_role()) = 'project_lead'
      and account_type <> 'main'
      and exists (
        select 1
        from public.cash_account_members member
        where member.account_id = id
          and member.user_id = (select auth.uid())
      )
    )
  );

create policy "Privileged users can add cash accounts"
  on public.cash_accounts for insert to authenticated
  with check (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    and created_by = (select auth.uid())
  );

create policy "Privileged users can update cash accounts"
  on public.cash_accounts for update to authenticated
  using ((select private.current_app_role()) in ('admin', 'main_accountant'))
  with check ((select private.current_app_role()) in ('admin', 'main_accountant'));

create policy "Authorized users can read cash memberships"
  on public.cash_account_members for select to authenticated
  using (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    or user_id = (select auth.uid())
  );

create policy "Privileged users can add cash memberships"
  on public.cash_account_members for insert to authenticated
  with check ((select private.current_app_role()) in ('admin', 'main_accountant'));

create policy "Privileged users can update cash memberships"
  on public.cash_account_members for update to authenticated
  using ((select private.current_app_role()) in ('admin', 'main_accountant'))
  with check ((select private.current_app_role()) in ('admin', 'main_accountant'));

create policy "Privileged users can delete cash memberships"
  on public.cash_account_members for delete to authenticated
  using ((select private.current_app_role()) in ('admin', 'main_accountant'));

create policy "Authorized users can read cash transfers"
  on public.cash_transfers for select to authenticated
  using (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    or (
      (select private.current_app_role()) = 'project_lead'
      and exists (
        select 1
        from public.cash_account_members member
        where member.user_id = (select auth.uid())
          and member.account_id in (from_account_id, to_account_id)
      )
    )
  );

create policy "Privileged users can add cash transfers"
  on public.cash_transfers for insert to authenticated
  with check (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    and created_by = (select auth.uid())
  );

create policy "Authorized users can read cash reconciliations"
  on public.cash_reconciliations for select to authenticated
  using (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    or (
      (select private.current_app_role()) = 'project_lead'
      and exists (
        select 1
        from public.cash_account_members member
        join public.cash_accounts account on account.id = member.account_id
        where member.account_id = account_id
          and member.user_id = (select auth.uid())
          and account.account_type <> 'main'
      )
    )
  );

create policy "Authorized users can add cash reconciliations"
  on public.cash_reconciliations for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (select private.current_app_role()) in ('admin', 'main_accountant')
      or (
        (select private.current_app_role()) = 'project_lead'
        and exists (
        select 1
        from public.cash_account_members member
        join public.cash_accounts account on account.id = member.account_id
        where member.account_id = account_id
          and member.user_id = (select auth.uid())
          and member.permission in ('spender', 'manager')
          and account.account_type <> 'main'
        )
      )
    )
  );

-- Main Accountants need non-secret user metadata in order to assign custodians.
drop policy if exists "Admins can read the user directory" on public.user_directory;
create policy "Authorized users can read the user directory"
  on public.user_directory for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.current_app_role()) in ('admin', 'main_accountant')
  );

drop policy if exists "Users can read their own role" on public.user_roles;
create policy "Authorized users can read application roles"
  on public.user_roles for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.current_app_role()) in ('admin', 'main_accountant')
  );

-- Extend Expenses access for delegated cash custodians while preserving the
-- existing Admin/Main Accountant ownership rules.
drop policy if exists "Privileged users can read expenses" on public.expenses;
drop policy if exists "Privileged users can add expenses" on public.expenses;
drop policy if exists "Privileged users can update expenses" on public.expenses;
drop policy if exists "Admins or creators can delete expenses" on public.expenses;

create policy "Authorized users can read expenses"
  on public.expenses for select to authenticated
  using (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    or (
      (select private.current_app_role()) = 'project_lead'
      and exists (
        select 1
        from public.cash_account_members member
        join public.cash_accounts account on account.id = member.account_id
        where member.account_id = cash_account_id
          and member.user_id = (select auth.uid())
          and account.account_type <> 'main'
      )
    )
  );

create policy "Authorized users can add expenses"
  on public.expenses for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (select private.current_app_role()) in ('admin', 'main_accountant')
      or (
        (select private.current_app_role()) = 'project_lead'
        and payment_method = 'Cash'
        and status = 'paid'
        and salary_source_id is null
        and exists (
          select 1
          from public.cash_account_members member
          join public.cash_accounts account on account.id = member.account_id
          where member.account_id = cash_account_id
            and member.user_id = (select auth.uid())
            and member.permission in ('spender', 'manager')
            and account.is_active
            and account.account_type <> 'main'
        )
      )
    )
  );

create policy "Privileged users can update expenses"
  on public.expenses for update to authenticated
  using ((select private.current_app_role()) in ('admin', 'main_accountant'))
  with check ((select private.current_app_role()) in ('admin', 'main_accountant'));

create policy "Authorized users can delete owned expenses"
  on public.expenses for delete to authenticated
  using (
    (select private.current_app_role()) = 'admin'
    or (
      created_by = (select auth.uid())
      and (
        (select private.current_app_role()) = 'main_accountant'
        or (
          (select private.current_app_role()) = 'project_lead'
          and exists (
            select 1
            from public.cash_account_members member
            join public.cash_accounts account on account.id = member.account_id
            where member.account_id = cash_account_id
              and member.user_id = (select auth.uid())
              and account.account_type <> 'main'
          )
        )
      )
    )
  );

-- A single, read-only ledger assembled from the existing source tables. Salary
-- expenses generated at month close are excluded because their cash movement
-- was already recorded by salary_payments.
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

-- Transfers serialize on the source account row and cannot overdraw an account.
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

create trigger validate_cash_transfer
before insert on public.cash_transfers
for each row execute function private.validate_cash_transfer();

-- Reconciliation totals are database snapshots; browser clients can only
-- provide the counted amount and notes.
create or replace function private.set_cash_reconciliation_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reconciliation_date > ((now() at time zone 'Asia/Baku')::date) then
    raise exception 'Reconciliation date cannot be in the future';
  end if;

  select account.balance
  into new.expected_balance
  from public.cash_account_balances account
  where account.id = new.account_id;

  if new.expected_balance is null then
    raise exception 'Cash account does not exist or is not accessible';
  end if;

  new.variance := round(new.counted_balance - new.expected_balance, 2);
  return new;
end;
$$;

revoke execute on function private.set_cash_reconciliation_totals() from public, anon, authenticated;

create trigger set_cash_reconciliation_totals
before insert on public.cash_reconciliations
for each row execute function private.set_cash_reconciliation_totals();

-- Account creation and membership assignment form one atomic operation.
create or replace function public.create_cash_account(
  p_name text,
  p_account_type text,
  p_description text default null,
  p_custodian_user_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_account_id uuid;
begin
  if (select private.current_app_role()) not in ('admin', 'main_accountant') then
    raise exception 'Only an Admin or Main Accountant can create cash accounts';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception 'Account name is required';
  end if;

  if p_account_type not in ('project', 'employee_float') then
    raise exception 'Only project and employee float accounts can be created';
  end if;

  if p_custodian_user_id is not null and not exists (
    select 1 from public.user_roles role_row
    where role_row.user_id = p_custodian_user_id
  ) then
    raise exception 'The selected custodian does not have application access';
  end if;

  insert into public.cash_accounts (
    name,
    account_type,
    description,
    custodian_user_id,
    created_by_email
  ) values (
    btrim(p_name),
    p_account_type,
    nullif(btrim(p_description), ''),
    p_custodian_user_id,
    ''
  )
  returning id into new_account_id;

  if p_custodian_user_id is not null then
    insert into public.cash_account_members (account_id, user_id, permission, created_by)
    values (new_account_id, p_custodian_user_id, 'manager', (select auth.uid()));
  end if;

  return new_account_id;
end;
$$;

revoke execute on function public.create_cash_account(text, text, text, uuid) from public, anon;
grant execute on function public.create_cash_account(text, text, text, uuid) to authenticated, service_role;
