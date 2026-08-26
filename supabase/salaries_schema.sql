create extension if not exists "pgcrypto";

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists employees_active_name_idx on public.employees (active, name);

create table if not exists public.employee_daily_rates (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  daily_rate numeric(12, 2) not null check (daily_rate > 0),
  effective_from date not null,
  created_at timestamptz not null default now(),
  constraint employee_daily_rates_employee_date_unique unique (employee_id, effective_from)
);

create index if not exists employee_daily_rates_employee_effective_idx on public.employee_daily_rates (employee_id, effective_from desc);

create table if not exists public.monthly_salaries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  salary_month date not null check (extract(day from salary_month) = 1),
  daily_rate_snapshot numeric(12, 2) not null check (daily_rate_snapshot > 0),
  days_worked numeric(5, 2) not null default 0 check (days_worked >= 0 and days_worked <= 31),
  meal_count integer not null default 0 check (meal_count >= 0),
  meal_rate_snapshot numeric(12, 2) not null default 1.50 check (meal_rate_snapshot > 0),
  notes text,
  closed_at timestamptz,
  closed_cash_amount numeric(12, 2) not null default 0 check (closed_cash_amount >= 0),
  closed_card_amount numeric(12, 2) not null default 0 check (closed_card_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_salaries_employee_month_unique unique (employee_id, salary_month)
);

create index if not exists monthly_salaries_month_employee_idx on public.monthly_salaries (salary_month desc, employee_id);

create table if not exists public.salary_payments (
  id uuid primary key default gen_random_uuid(),
  monthly_salary_id uuid not null references public.monthly_salaries(id) on delete cascade,
  payment_date date not null default current_date,
  payment_type text not null check (payment_type in ('cash_payment', 'card_transfer')),
  amount numeric(12, 2) not null check (amount > 0),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists salary_payments_salary_date_idx on public.salary_payments (monthly_salary_id, payment_date desc);

alter table public.monthly_salaries add column if not exists closed_at timestamptz;
alter table public.monthly_salaries add column if not exists closed_cash_amount numeric(12, 2) not null default 0;
alter table public.monthly_salaries add column if not exists closed_card_amount numeric(12, 2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'monthly_salaries_closed_cash_amount_check'
      and conrelid = 'public.monthly_salaries'::regclass
  ) then
    alter table public.monthly_salaries
      add constraint monthly_salaries_closed_cash_amount_check check (closed_cash_amount >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'monthly_salaries_closed_card_amount_check'
      and conrelid = 'public.monthly_salaries'::regclass
  ) then
    alter table public.monthly_salaries
      add constraint monthly_salaries_closed_card_amount_check check (closed_card_amount >= 0);
  end if;
end $$;

create table if not exists public.salary_month_closures (
  salary_month date primary key check (extract(day from salary_month) = 1),
  closed_at timestamptz not null default now()
);

create table if not exists public.salary_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.salary_payments(id) on delete restrict,
  monthly_salary_id uuid not null references public.monthly_salaries(id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  constraint salary_payment_allocations_payment_salary_unique unique (payment_id, monthly_salary_id)
);

create index if not exists salary_payment_allocations_salary_idx on public.salary_payment_allocations (monthly_salary_id);

alter table public.expenses add column if not exists salary_source_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'expenses_salary_source_id_fkey'
      and conrelid = 'public.expenses'::regclass
  ) then
    alter table public.expenses
      add constraint expenses_salary_source_id_fkey
      foreign key (salary_source_id) references public.monthly_salaries(id) on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'expenses_salary_source_unique'
      and conrelid = 'public.expenses'::regclass
  ) then
    alter table public.expenses
      add constraint expenses_salary_source_unique unique (salary_source_id);
  end if;
end $$;

alter table public.salary_payments drop constraint if exists salary_payments_payment_type_check;
update public.salary_payments
set payment_type = 'cash_payment'
where payment_type in ('cash_advance', 'cash_salary_payment');
alter table public.salary_payments
  add constraint salary_payments_payment_type_check
  check (payment_type in ('cash_payment', 'card_transfer'));

drop index if exists public.salary_payments_cash_date_idx;
create index salary_payments_cash_date_idx on public.salary_payments (payment_date desc) where payment_type = 'cash_payment';

create or replace function public.set_monthly_salary_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end; $$;

revoke execute on function public.set_monthly_salary_updated_at() from public, anon, authenticated;
drop trigger if exists set_monthly_salary_updated_at on public.monthly_salaries;
create trigger set_monthly_salary_updated_at before update on public.monthly_salaries for each row execute function public.set_monthly_salary_updated_at();

create or replace function public.validate_salary_payment_date()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.payment_date > current_date then
    raise exception 'Salary payment date cannot be in the future';
  end if;
  return new;
end; $$;

revoke execute on function public.validate_salary_payment_date() from public, anon, authenticated;
drop trigger if exists validate_salary_payment_date on public.salary_payments;
create trigger validate_salary_payment_date before insert or update on public.salary_payments for each row execute function public.validate_salary_payment_date();

create or replace function public.protect_closed_monthly_salary()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  protected_month date;
begin
  if tg_op = 'INSERT' then
    protected_month := new.salary_month;
  else
    protected_month := old.salary_month;
    if old.closed_at is not null then
      raise exception 'Closed salaries cannot be changed or deleted';
    end if;
  end if;

  if exists (
    select 1 from public.salary_month_closures closure
    where closure.salary_month = protected_month
  ) then
    raise exception 'The salary month is closed';
  end if;

  if tg_op = 'UPDATE' and new.salary_month <> old.salary_month and exists (
    select 1 from public.salary_month_closures closure
    where closure.salary_month = new.salary_month
  ) then
    raise exception 'The target salary month is closed';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;

revoke execute on function public.protect_closed_monthly_salary() from public, anon, authenticated;
drop trigger if exists protect_closed_monthly_salary on public.monthly_salaries;
create trigger protect_closed_monthly_salary
before insert or update or delete on public.monthly_salaries
for each row execute function public.protect_closed_monthly_salary();

create or replace function public.protect_closed_salary_payment()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  origin_salary_id uuid;
  origin_month date;
  origin_closed_at timestamptz;
begin
  origin_salary_id := case when tg_op = 'DELETE' then old.monthly_salary_id else new.monthly_salary_id end;

  select salary.salary_month, salary.closed_at
  into origin_month, origin_closed_at
  from public.monthly_salaries salary
  where salary.id = origin_salary_id;

  if origin_closed_at is not null or exists (
    select 1 from public.salary_month_closures closure
    where closure.salary_month = origin_month
  ) then
    raise exception 'Payments for a closed salary cannot be changed or deleted';
  end if;

  if tg_op = 'UPDATE' and new.monthly_salary_id <> old.monthly_salary_id then
    select salary.salary_month, salary.closed_at
    into origin_month, origin_closed_at
    from public.monthly_salaries salary
    where salary.id = old.monthly_salary_id;

    if origin_closed_at is not null or exists (
      select 1 from public.salary_month_closures closure
      where closure.salary_month = origin_month
    ) then
      raise exception 'Payments cannot be moved from a closed salary';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;

revoke execute on function public.protect_closed_salary_payment() from public, anon, authenticated;
drop trigger if exists protect_closed_salary_payment on public.salary_payments;
create trigger protect_closed_salary_payment
before insert or update or delete on public.salary_payments
for each row execute function public.protect_closed_salary_payment();

create or replace function public.validate_salary_payment_allocation()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  payment_amount numeric;
  origin_employee_id uuid;
  origin_month date;
  target_employee_id uuid;
  target_month date;
  target_closed_at timestamptz;
  allocated_amount numeric;
begin
  select payment.amount, origin.employee_id, origin.salary_month
  into payment_amount, origin_employee_id, origin_month
  from public.salary_payments payment
  join public.monthly_salaries origin on origin.id = payment.monthly_salary_id
  where payment.id = new.payment_id
  for update of payment;

  select target.employee_id, target.salary_month, target.closed_at
  into target_employee_id, target_month, target_closed_at
  from public.monthly_salaries target
  where target.id = new.monthly_salary_id;

  if origin_employee_id <> target_employee_id then
    raise exception 'A salary payment can only be allocated to the same employee';
  end if;
  if target_month < origin_month then
    raise exception 'A salary payment cannot be carried backward to an earlier month';
  end if;
  if target_closed_at is not null then
    raise exception 'Allocations for a closed salary cannot be changed';
  end if;

  select coalesce(sum(allocation.amount), 0)
  into allocated_amount
  from public.salary_payment_allocations allocation
  where allocation.payment_id = new.payment_id
    and (tg_op = 'INSERT' or allocation.id <> new.id);

  if allocated_amount + new.amount > payment_amount then
    raise exception 'Salary payment allocations cannot exceed the payment amount';
  end if;

  return new;
end; $$;

revoke execute on function public.validate_salary_payment_allocation() from public, anon, authenticated;
drop trigger if exists validate_salary_payment_allocation on public.salary_payment_allocations;
create trigger validate_salary_payment_allocation
before insert or update on public.salary_payment_allocations
for each row execute function public.validate_salary_payment_allocation();

create or replace function public.protect_generated_salary_expense()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.salary_source_id is not null or (tg_op = 'UPDATE' and new.salary_source_id is not null) then
    raise exception 'Generated salary expenses cannot be changed or deleted';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;

revoke execute on function public.protect_generated_salary_expense() from public, anon, authenticated;
drop trigger if exists protect_generated_salary_expense on public.expenses;
create trigger protect_generated_salary_expense
before update or delete on public.expenses
for each row execute function public.protect_generated_salary_expense();

create or replace function public.generate_monthly_salaries(target_month date)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  normalized_month date;
  inserted_count integer;
  missing_employee_names text;
begin
  normalized_month := date_trunc('month', target_month)::date;

  select string_agg(employee.name, ', ' order by employee.name)
  into missing_employee_names
  from public.employees employee
  where employee.active
    and not exists (
      select 1
      from public.employee_daily_rates rate
      where rate.employee_id = employee.id
        and rate.effective_from <= normalized_month
    );

  if missing_employee_names is not null then
    raise exception 'Missing an applicable daily rate for: %', missing_employee_names;
  end if;

  insert into public.monthly_salaries (employee_id, salary_month, daily_rate_snapshot)
  select employee.id, normalized_month, applicable_rate.daily_rate
  from public.employees employee
  cross join lateral (
    select rate.daily_rate
    from public.employee_daily_rates rate
    where rate.employee_id = employee.id
      and rate.effective_from <= normalized_month
    order by rate.effective_from desc
    limit 1
  ) applicable_rate
  where employee.active
  on conflict (employee_id, salary_month) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end; $$;

revoke execute on function public.generate_monthly_salaries(date) from public, anon;
grant execute on function public.generate_monthly_salaries(date) to authenticated, service_role;

create or replace function public.salary_month_allocation_lines(target_month date)
returns table (
  salary_id uuid,
  employee_id uuid,
  employee_name text,
  salary_month date,
  net_salary numeric,
  payment_id uuid,
  payment_type text,
  payment_remaining numeric,
  amount_to_apply numeric
)
language sql stable security invoker set search_path = '' as $$
  with params as (
    select (date_trunc('month', target_month)::date - interval '1 month')::date as closing_month
  ), closing_salaries as (
    select
      salary.id as salary_id,
      salary.employee_id,
      employee.name as employee_name,
      salary.salary_month,
      greatest(round(salary.days_worked * salary.daily_rate_snapshot - salary.meal_count * salary.meal_rate_snapshot, 2), 0) as net_salary
    from public.monthly_salaries salary
    join public.employees employee on employee.id = salary.employee_id
    cross join params
    where salary.salary_month = params.closing_month
      and salary.closed_at is null
      and not exists (
        select 1 from public.salary_month_closures closure
        where closure.salary_month = salary.salary_month
      )
  ), allocated as (
    select allocation.payment_id, sum(allocation.amount) as allocated_amount
    from public.salary_payment_allocations allocation
    group by allocation.payment_id
  ), candidates as (
    select
      closing.salary_id,
      closing.employee_id,
      closing.employee_name,
      closing.salary_month,
      closing.net_salary,
      payment.id as payment_id,
      payment.payment_type,
      payment.payment_date,
      payment.created_at,
      greatest(payment.amount - coalesce(allocated.allocated_amount, 0), 0) as payment_remaining
    from closing_salaries closing
    join public.monthly_salaries origin
      on origin.employee_id = closing.employee_id
     and origin.salary_month <= closing.salary_month
    join public.salary_payments payment on payment.monthly_salary_id = origin.id
    left join allocated on allocated.payment_id = payment.id
    where payment.amount - coalesce(allocated.allocated_amount, 0) > 0
  ), ranked as (
    select
      candidate.*,
      coalesce(sum(candidate.payment_remaining) over (
        partition by candidate.salary_id
        order by
          case when candidate.payment_type = 'card_transfer' then 0 else 1 end,
          candidate.payment_date,
          candidate.created_at,
          candidate.payment_id
        rows between unbounded preceding and 1 preceding
      ), 0) as amount_before
    from candidates candidate
  )
  select
    ranked.salary_id,
    ranked.employee_id,
    ranked.employee_name,
    ranked.salary_month,
    ranked.net_salary,
    ranked.payment_id,
    ranked.payment_type,
    ranked.payment_remaining,
    greatest(least(ranked.payment_remaining, ranked.net_salary - ranked.amount_before), 0) as amount_to_apply
  from ranked
  order by
    ranked.employee_name,
    case when ranked.payment_type = 'card_transfer' then 0 else 1 end,
    ranked.payment_date,
    ranked.created_at,
    ranked.payment_id;
$$;

revoke execute on function public.salary_month_allocation_lines(date) from public, anon;
grant execute on function public.salary_month_allocation_lines(date) to authenticated, service_role;

create or replace function public.preview_salary_month_close(target_month date)
returns table (
  salary_id uuid,
  employee_id uuid,
  employee_name text,
  salary_month date,
  net_salary numeric,
  available_cash numeric,
  available_card numeric,
  cash_to_expense numeric,
  card_to_apply numeric,
  carryover_cash numeric,
  carryover_card numeric,
  outstanding numeric
)
language sql stable security invoker set search_path = '' as $$
  with params as (
    select (date_trunc('month', target_month)::date - interval '1 month')::date as closing_month
  ), salaries as (
    select
      salary.id as salary_id,
      salary.employee_id,
      employee.name as employee_name,
      salary.salary_month,
      greatest(round(salary.days_worked * salary.daily_rate_snapshot - salary.meal_count * salary.meal_rate_snapshot, 2), 0) as net_salary
    from public.monthly_salaries salary
    join public.employees employee on employee.id = salary.employee_id
    cross join params
    where salary.salary_month = params.closing_month
      and salary.closed_at is null
      and not exists (
        select 1 from public.salary_month_closures closure
        where closure.salary_month = salary.salary_month
      )
  ), lines as (
    select * from public.salary_month_allocation_lines(target_month)
  )
  select
    salary.salary_id,
    salary.employee_id,
    salary.employee_name,
    salary.salary_month,
    salary.net_salary::numeric(12, 2),
    coalesce(sum(line.payment_remaining) filter (where line.payment_type = 'cash_payment'), 0)::numeric(12, 2) as available_cash,
    coalesce(sum(line.payment_remaining) filter (where line.payment_type = 'card_transfer'), 0)::numeric(12, 2) as available_card,
    coalesce(sum(line.amount_to_apply) filter (where line.payment_type = 'cash_payment'), 0)::numeric(12, 2) as cash_to_expense,
    coalesce(sum(line.amount_to_apply) filter (where line.payment_type = 'card_transfer'), 0)::numeric(12, 2) as card_to_apply,
    coalesce(sum(line.payment_remaining - line.amount_to_apply) filter (where line.payment_type = 'cash_payment'), 0)::numeric(12, 2) as carryover_cash,
    coalesce(sum(line.payment_remaining - line.amount_to_apply) filter (where line.payment_type = 'card_transfer'), 0)::numeric(12, 2) as carryover_card,
    greatest(salary.net_salary - coalesce(sum(line.amount_to_apply), 0), 0)::numeric(12, 2) as outstanding
  from salaries salary
  left join lines line on line.salary_id = salary.salary_id
  group by salary.salary_id, salary.employee_id, salary.employee_name, salary.salary_month, salary.net_salary
  order by salary.employee_name;
$$;

revoke execute on function public.preview_salary_month_close(date) from public, anon;
grant execute on function public.preview_salary_month_close(date) to authenticated, service_role;

create or replace function public.close_previous_salary_month_and_generate(target_month date)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  normalized_target date;
  closing_month date;
  was_closed boolean;
  shortage_names text;
  closed_count integer := 0;
  expense_count integer := 0;
  created_count integer := 0;
  cash_expensed numeric := 0;
  cash_credit numeric := 0;
  card_credit numeric := 0;
begin
  if target_month is null then
    raise exception 'Target month is required';
  end if;

  normalized_target := date_trunc('month', target_month)::date;
  closing_month := (normalized_target - interval '1 month')::date;

  if normalized_target > date_trunc('month', current_date)::date then
    raise exception 'A future salary month cannot be created';
  end if;

  perform salary.id
  from public.monthly_salaries salary
  where salary.salary_month = closing_month
  order by salary.id
  for update;

  select exists (
    select 1 from public.salary_month_closures closure
    where closure.salary_month = closing_month
  ) into was_closed;

  if not was_closed then
    if exists (
      select 1 from public.monthly_salaries salary
      where salary.salary_month < closing_month
        and salary.closed_at is null
    ) then
      raise exception 'An older salary month must be closed first';
    end if;

    select string_agg(
      preview.employee_name || ' (' || to_char(preview.outstanding, 'FM999999990.00') || ' AZN remaining)',
      ', ' order by preview.employee_name
    )
    into shortage_names
    from public.preview_salary_month_close(normalized_target) preview
    where preview.outstanding > 0;

    if shortage_names is not null then
      raise exception 'Salary payments are incomplete for: %', shortage_names;
    end if;

    insert into public.salary_payment_allocations (payment_id, monthly_salary_id, amount)
    select line.payment_id, line.salary_id, line.amount_to_apply
    from public.salary_month_allocation_lines(normalized_target) line
    where line.amount_to_apply > 0
    on conflict (payment_id, monthly_salary_id) do nothing;

    update public.monthly_salaries salary
    set
      closed_cash_amount = coalesce((
        select sum(allocation.amount)
        from public.salary_payment_allocations allocation
        join public.salary_payments payment on payment.id = allocation.payment_id
        where allocation.monthly_salary_id = salary.id
          and payment.payment_type = 'cash_payment'
      ), 0),
      closed_card_amount = coalesce((
        select sum(allocation.amount)
        from public.salary_payment_allocations allocation
        join public.salary_payments payment on payment.id = allocation.payment_id
        where allocation.monthly_salary_id = salary.id
          and payment.payment_type = 'card_transfer'
      ), 0),
      closed_at = now()
    where salary.salary_month = closing_month
      and salary.closed_at is null;

    get diagnostics closed_count = row_count;

    insert into public.expenses (
      expense_date, merchant, description, category, payment_method,
      quantity, unit, unit_price, amount, status, salary_source_id
    )
    select
      current_date,
      'Salary ' || to_char(closing_month, 'FMMonth YYYY'),
      employee.name,
      'Salaries',
      'Cash',
      1,
      'Service',
      salary.closed_cash_amount,
      salary.closed_cash_amount,
      'paid',
      salary.id
    from public.monthly_salaries salary
    join public.employees employee on employee.id = salary.employee_id
    where salary.salary_month = closing_month
      and salary.closed_cash_amount > 0
    on conflict (salary_source_id) do nothing;

    get diagnostics expense_count = row_count;

    select coalesce(sum(salary.closed_cash_amount), 0)
    into cash_expensed
    from public.monthly_salaries salary
    where salary.salary_month = closing_month;

    insert into public.salary_month_closures (salary_month)
    values (closing_month)
    on conflict (salary_month) do nothing;

    with allocation_totals as (
      select allocation.payment_id, sum(allocation.amount) as allocated_amount
      from public.salary_payment_allocations allocation
      group by allocation.payment_id
    ), remaining as (
      select payment.payment_type, greatest(payment.amount - coalesce(allocation.allocated_amount, 0), 0) as amount
      from public.salary_payments payment
      join public.monthly_salaries origin on origin.id = payment.monthly_salary_id
      left join allocation_totals allocation on allocation.payment_id = payment.id
      where origin.salary_month <= closing_month
        and origin.employee_id in (
          select salary.employee_id from public.monthly_salaries salary
          where salary.salary_month = closing_month
        )
    )
    select
      coalesce(sum(remaining.amount) filter (where remaining.payment_type = 'cash_payment'), 0),
      coalesce(sum(remaining.amount) filter (where remaining.payment_type = 'card_transfer'), 0)
    into cash_credit, card_credit
    from remaining;
  end if;

  created_count := public.generate_monthly_salaries(normalized_target);

  return jsonb_build_object(
    'target_month', normalized_target,
    'closed_month', closing_month,
    'already_closed', was_closed,
    'salaries_closed', closed_count,
    'expenses_created', expense_count,
    'cash_expensed', cash_expensed,
    'cash_credit_carried', cash_credit,
    'card_credit_carried', card_credit,
    'salaries_created', created_count
  );
end; $$;

revoke execute on function public.close_previous_salary_month_and_generate(date) from public, anon;
grant execute on function public.close_previous_salary_month_and_generate(date) to authenticated, service_role;

alter table public.employees enable row level security;
alter table public.employee_daily_rates enable row level security;
alter table public.monthly_salaries enable row level security;
alter table public.salary_payments enable row level security;
alter table public.salary_month_closures enable row level security;
alter table public.salary_payment_allocations enable row level security;

grant select, insert, update, delete on public.employees, public.employee_daily_rates, public.monthly_salaries, public.salary_payments to authenticated, service_role;
grant select, insert on public.salary_month_closures, public.salary_payment_allocations to authenticated;
grant select, insert, update, delete on public.salary_month_closures, public.salary_payment_allocations to service_role;
revoke all on public.employees, public.employee_daily_rates, public.monthly_salaries, public.salary_payments from anon;
revoke all on public.salary_month_closures, public.salary_payment_allocations from anon;

create policy "Authenticated users can read employees" on public.employees for select to authenticated using (true);
create policy "Authenticated users can add employees" on public.employees for insert to authenticated with check (true);
create policy "Authenticated users can update employees" on public.employees for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete employees" on public.employees for delete to authenticated using (true);

create policy "Authenticated users can read employee rates" on public.employee_daily_rates for select to authenticated using (true);
create policy "Authenticated users can add employee rates" on public.employee_daily_rates for insert to authenticated with check (true);
create policy "Authenticated users can update employee rates" on public.employee_daily_rates for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete employee rates" on public.employee_daily_rates for delete to authenticated using (true);

create policy "Authenticated users can read monthly salaries" on public.monthly_salaries for select to authenticated using (true);
create policy "Authenticated users can add monthly salaries" on public.monthly_salaries for insert to authenticated with check (true);
create policy "Authenticated users can update monthly salaries" on public.monthly_salaries for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete monthly salaries" on public.monthly_salaries for delete to authenticated using (true);

create policy "Authenticated users can read salary payments" on public.salary_payments for select to authenticated using (true);
create policy "Authenticated users can add salary payments" on public.salary_payments for insert to authenticated with check (true);
create policy "Authenticated users can update salary payments" on public.salary_payments for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete salary payments" on public.salary_payments for delete to authenticated using (true);

create policy "Authenticated users can read salary month closures" on public.salary_month_closures for select to authenticated using (true);
create policy "Authenticated users can add salary month closures" on public.salary_month_closures for insert to authenticated with check (true);

create policy "Authenticated users can read salary payment allocations" on public.salary_payment_allocations for select to authenticated using (true);
create policy "Authenticated users can add salary payment allocations" on public.salary_payment_allocations for insert to authenticated with check (true);
