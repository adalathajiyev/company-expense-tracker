-- Trucks and prepaid fuel balances. Provider top-ups and card allocations are
-- balance movements; only fuel-card purchases recorded in expenses are costs.

create table public.trucks (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  registration_number text not null check (length(btrim(registration_number)) > 0),
  make_model text,
  tank_capacity_liters numeric(12, 2) not null check (tank_capacity_liters > 0),
  is_active boolean not null default true,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text not null,
  created_at timestamptz not null default now()
);

create unique index trucks_registration_number_key
  on public.trucks (lower(registration_number));
create index trucks_active_name_idx on public.trucks (is_active desc, name, id);
create index trucks_created_by_idx on public.trucks (created_by)
  where created_by is not null;

create table public.fuel_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  is_active boolean not null default true,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text not null,
  created_at timestamptz not null default now()
);

create unique index fuel_providers_name_key on public.fuel_providers (lower(name));
create index fuel_providers_created_by_idx on public.fuel_providers (created_by)
  where created_by is not null;

create table public.fuel_cards (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.fuel_providers(id) on delete restrict,
  name text not null check (length(btrim(name)) > 0),
  card_number text not null check (length(btrim(card_number)) > 0),
  assignment_type text not null default 'unassigned'
    check (assignment_type in ('truck', 'project', 'cash_account', 'factory', 'unassigned')),
  truck_id uuid references public.trucks(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  cash_account_id uuid references public.cash_accounts(id) on delete restrict,
  custodian_name text,
  is_active boolean not null default true,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text not null,
  created_at timestamptz not null default now(),
  constraint fuel_cards_assignment_check check (
    (assignment_type = 'truck' and truck_id is not null and project_id is null and cash_account_id is null)
    or (assignment_type = 'project' and truck_id is null and project_id is not null and cash_account_id is null)
    or (assignment_type = 'cash_account' and truck_id is null and project_id is null and cash_account_id is not null)
    or (assignment_type in ('factory', 'unassigned') and truck_id is null and project_id is null and cash_account_id is null)
  )
);

create unique index fuel_cards_provider_number_key
  on public.fuel_cards (provider_id, lower(card_number));
create index fuel_cards_provider_active_idx
  on public.fuel_cards (provider_id, is_active desc, name, id);
create index fuel_cards_truck_idx on public.fuel_cards (truck_id)
  where truck_id is not null;
create index fuel_cards_project_idx on public.fuel_cards (project_id)
  where project_id is not null;
create index fuel_cards_cash_account_idx on public.fuel_cards (cash_account_id)
  where cash_account_id is not null;
create index fuel_cards_created_by_idx on public.fuel_cards (created_by)
  where created_by is not null;

create table public.fuel_provider_topups (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.fuel_providers(id) on delete restrict,
  topup_date date not null default ((now() at time zone 'Asia/Baku')::date),
  amount numeric(18, 2) not null check (amount > 0),
  bank_reference text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text not null,
  created_at timestamptz not null default now()
);

create index fuel_provider_topups_provider_date_idx
  on public.fuel_provider_topups (provider_id, topup_date desc, id);
create index fuel_provider_topups_created_by_idx
  on public.fuel_provider_topups (created_by)
  where created_by is not null;

create table public.fuel_card_allocations (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.fuel_cards(id) on delete restrict,
  allocation_date date not null default ((now() at time zone 'Asia/Baku')::date),
  allocation_type text not null default 'allocate'
    check (allocation_type in ('allocate', 'return')),
  amount numeric(18, 2) not null check (amount > 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text not null,
  created_at timestamptz not null default now()
);

create index fuel_card_allocations_card_date_idx
  on public.fuel_card_allocations (card_id, allocation_date desc, id);
create index fuel_card_allocations_created_by_idx
  on public.fuel_card_allocations (created_by)
  where created_by is not null;

alter table public.expenses
  add column fuel_card_id uuid references public.fuel_cards(id) on delete restrict,
  add column truck_id uuid references public.trucks(id) on delete restrict,
  add column fuel_level_before_liters numeric(12, 2),
  add column fuel_level_after_liters numeric(12, 2);

create index expenses_fuel_card_date_idx
  on public.expenses (fuel_card_id, expense_date desc, id)
  where fuel_card_id is not null;
create index expenses_truck_date_idx
  on public.expenses (truck_id, expense_date desc, id)
  where truck_id is not null;

alter table public.expenses drop constraint if exists expenses_payment_method_check;
alter table public.expenses
  add constraint expenses_payment_method_check
  check (payment_method in ('Cash', 'Bank transfer', 'Fuel card'));

alter table public.expenses
  add constraint expenses_fuel_card_fields_check check (
    (
      payment_method = 'Fuel card'
      and fuel_card_id is not null
      and status = 'paid'
      and unit = 'Liter'
    )
    or (
      payment_method <> 'Fuel card'
      and fuel_card_id is null
      and fuel_level_before_liters is null
      and fuel_level_after_liters is null
    )
  ),
  add constraint expenses_truck_category_check
    check (truck_id is null or category = 'Truck Costs'),
  add constraint expenses_fuel_readings_check check (
    (fuel_level_before_liters is null or fuel_level_before_liters >= 0)
    and (fuel_level_after_liters is null or fuel_level_after_liters >= 0)
    and (
      (fuel_level_before_liters is null and fuel_level_after_liters is null)
      or (payment_method = 'Fuel card' and truck_id is not null)
    )
  );

create trigger set_truck_creator
before insert or update on public.trucks
for each row execute function private.set_record_creator();

create trigger set_fuel_provider_creator
before insert or update on public.fuel_providers
for each row execute function private.set_record_creator();

create trigger set_fuel_card_creator
before insert or update on public.fuel_cards
for each row execute function private.set_record_creator();

create trigger set_fuel_provider_topup_creator
before insert or update on public.fuel_provider_topups
for each row execute function private.set_record_creator();

create trigger set_fuel_card_allocation_creator
before insert or update on public.fuel_card_allocations
for each row execute function private.set_record_creator();

create or replace function private.validate_fuel_expense()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  card_active boolean;
  provider_active boolean;
  truck_active boolean;
  tank_capacity numeric(12, 2);
begin
  if new.payment_method = 'Fuel card' then
    select card.is_active, provider.is_active
    into card_active, provider_active
    from public.fuel_cards card
    join public.fuel_providers provider on provider.id = card.provider_id
    where card.id = new.fuel_card_id;

    if card_active is distinct from true or provider_active is distinct from true then
      raise exception 'The selected fuel card or provider is inactive';
    end if;
  end if;

  if new.truck_id is not null then
    select truck.is_active, truck.tank_capacity_liters
    into truck_active, tank_capacity
    from public.trucks truck
    where truck.id = new.truck_id;

    if truck_active is distinct from true then
      raise exception 'The selected truck is inactive';
    end if;

    if new.fuel_level_before_liters > tank_capacity
      or new.fuel_level_after_liters > tank_capacity
    then
      raise exception 'A fuel reading cannot exceed the truck tank capacity of % liters', tank_capacity;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function private.validate_fuel_expense()
from public, anon, authenticated;

create trigger validate_fuel_expense
before insert or update of payment_method, fuel_card_id, truck_id,
  fuel_level_before_liters, fuel_level_after_liters
on public.expenses
for each row execute function private.validate_fuel_expense();

create or replace function private.can_access_fuel_card(
  p_card_id uuid,
  p_require_spend_permission boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.current_app_role() = 'project_lead'
    and exists (
      select 1
      from public.fuel_cards card
      where card.id = p_card_id
        and card.is_active
        and card.cash_account_id is not null
        and private.can_access_cash_account(
          card.cash_account_id,
          p_require_spend_permission
        )
    );
$$;

revoke execute on function private.can_access_fuel_card(uuid, boolean)
from public, anon;
grant execute on function private.can_access_fuel_card(uuid, boolean)
to authenticated, service_role;

alter table public.trucks enable row level security;
alter table public.fuel_providers enable row level security;
alter table public.fuel_cards enable row level security;
alter table public.fuel_provider_topups enable row level security;
alter table public.fuel_card_allocations enable row level security;

revoke all on table public.trucks, public.fuel_providers, public.fuel_cards,
  public.fuel_provider_topups, public.fuel_card_allocations
from public, anon;

grant select, insert, update on table public.trucks, public.fuel_providers,
  public.fuel_cards to authenticated, service_role;
grant select, insert on table public.fuel_provider_topups,
  public.fuel_card_allocations to authenticated, service_role;

create policy "Authorized users can read trucks"
  on public.trucks for select to authenticated
  using (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    or exists (
      select 1
      from public.fuel_cards card
      where card.truck_id = id
        and (select private.can_access_fuel_card(card.id))
    )
  );

create policy "Privileged users can add trucks"
  on public.trucks for insert to authenticated
  with check (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    and created_by = (select auth.uid())
  );

create policy "Privileged users can update trucks"
  on public.trucks for update to authenticated
  using ((select private.current_app_role()) in ('admin', 'main_accountant'))
  with check ((select private.current_app_role()) in ('admin', 'main_accountant'));

create policy "Authorized users can read fuel providers"
  on public.fuel_providers for select to authenticated
  using (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    or exists (
      select 1
      from public.fuel_cards card
      where card.provider_id = id
        and (select private.can_access_fuel_card(card.id))
    )
  );

create policy "Privileged users can add fuel providers"
  on public.fuel_providers for insert to authenticated
  with check (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    and created_by = (select auth.uid())
  );

create policy "Privileged users can update fuel providers"
  on public.fuel_providers for update to authenticated
  using ((select private.current_app_role()) in ('admin', 'main_accountant'))
  with check ((select private.current_app_role()) in ('admin', 'main_accountant'));

create policy "Authorized users can read fuel cards"
  on public.fuel_cards for select to authenticated
  using (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    or (select private.can_access_fuel_card(id))
  );

create policy "Privileged users can add fuel cards"
  on public.fuel_cards for insert to authenticated
  with check (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    and created_by = (select auth.uid())
  );

create policy "Privileged users can update fuel cards"
  on public.fuel_cards for update to authenticated
  using ((select private.current_app_role()) in ('admin', 'main_accountant'))
  with check ((select private.current_app_role()) in ('admin', 'main_accountant'));

create policy "Privileged users can read provider topups"
  on public.fuel_provider_topups for select to authenticated
  using ((select private.current_app_role()) in ('admin', 'main_accountant'));

create policy "Privileged users can add provider topups"
  on public.fuel_provider_topups for insert to authenticated
  with check (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    and created_by = (select auth.uid())
  );

create policy "Authorized users can read card allocations"
  on public.fuel_card_allocations for select to authenticated
  using (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    or (select private.can_access_fuel_card(card_id))
  );

create policy "Privileged users can add card allocations"
  on public.fuel_card_allocations for insert to authenticated
  with check (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    and created_by = (select auth.uid())
  );

drop policy if exists "Authorized users can read expenses" on public.expenses;
create policy "Authorized users can read expenses"
  on public.expenses for select to authenticated
  using (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    or (select private.can_access_cash_account(cash_account_id))
    or (select private.can_access_fuel_card(fuel_card_id))
  );

drop policy if exists "Authorized users can add expenses" on public.expenses;
create policy "Authorized users can add expenses"
  on public.expenses for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (select private.current_app_role()) in ('admin', 'main_accountant')
      or (
        payment_method = 'Cash'
        and status = 'paid'
        and salary_source_id is null
        and (select private.can_access_cash_account(cash_account_id, true))
        and exists (
          select 1 from public.cash_accounts account
          where account.id = cash_account_id and account.is_active
        )
      )
      or (
        payment_method = 'Fuel card'
        and status = 'paid'
        and salary_source_id is null
        and (select private.can_access_fuel_card(fuel_card_id, true))
      )
    )
  );

drop policy if exists "Authorized users can delete owned expenses" on public.expenses;
create policy "Authorized users can delete owned expenses"
  on public.expenses for delete to authenticated
  using (
    (select private.current_app_role()) = 'admin'
    or (
      created_by = (select auth.uid())
      and (
        (select private.current_app_role()) = 'main_accountant'
        or (select private.can_access_cash_account(cash_account_id))
        or (select private.can_access_fuel_card(fuel_card_id))
      )
    )
  );

create view public.fuel_card_balances
with (security_invoker = true)
as
with allocation_totals as (
  select
    allocation.card_id,
    coalesce(sum(allocation.amount) filter (where allocation.allocation_type = 'allocate'), 0) as allocated,
    coalesce(sum(allocation.amount) filter (where allocation.allocation_type = 'return'), 0) as returned,
    max(allocation.allocation_date) as last_allocation_date
  from public.fuel_card_allocations allocation
  group by allocation.card_id
), purchase_totals as (
  select
    expense.fuel_card_id as card_id,
    coalesce(sum(expense.amount), 0) as purchased,
    max(expense.expense_date) as last_purchase_date
  from public.expenses expense
  where expense.fuel_card_id is not null
  group by expense.fuel_card_id
)
select
  card.id,
  card.provider_id,
  provider.name as provider_name,
  card.name,
  card.card_number,
  card.assignment_type,
  card.truck_id,
  truck.name as truck_name,
  truck.registration_number as truck_registration_number,
  card.project_id,
  project.name as project_name,
  card.cash_account_id,
  cash_account.name as cash_account_name,
  card.custodian_name,
  card.is_active,
  card.notes,
  card.created_by,
  card.created_by_email,
  card.created_at,
  coalesce(allocation.allocated, 0)::numeric(18, 2) as allocated_amount,
  coalesce(allocation.returned, 0)::numeric(18, 2) as returned_amount,
  coalesce(purchase.purchased, 0)::numeric(18, 2) as purchased_amount,
  (
    coalesce(allocation.allocated, 0)
    - coalesce(allocation.returned, 0)
    - coalesce(purchase.purchased, 0)
  )::numeric(18, 2) as balance,
  greatest(allocation.last_allocation_date, purchase.last_purchase_date) as last_activity_date
from public.fuel_cards card
join public.fuel_providers provider on provider.id = card.provider_id
left join public.trucks truck on truck.id = card.truck_id
left join public.projects project on project.id = card.project_id
left join public.cash_accounts cash_account on cash_account.id = card.cash_account_id
left join allocation_totals allocation on allocation.card_id = card.id
left join purchase_totals purchase on purchase.card_id = card.id;

create view public.fuel_provider_balances
with (security_invoker = true)
as
with topup_totals as (
  select topup.provider_id, coalesce(sum(topup.amount), 0) as topped_up,
    max(topup.topup_date) as last_topup_date
  from public.fuel_provider_topups topup
  group by topup.provider_id
), allocation_totals as (
  select
    card.provider_id,
    coalesce(sum(allocation.amount) filter (where allocation.allocation_type = 'allocate'), 0) as allocated,
    coalesce(sum(allocation.amount) filter (where allocation.allocation_type = 'return'), 0) as returned
  from public.fuel_card_allocations allocation
  join public.fuel_cards card on card.id = allocation.card_id
  group by card.provider_id
), purchase_totals as (
  select
    card.provider_id,
    coalesce(sum(expense.amount), 0) as purchased
  from public.expenses expense
  join public.fuel_cards card on card.id = expense.fuel_card_id
  group by card.provider_id
)
select
  provider.id,
  provider.name,
  provider.is_active,
  provider.notes,
  provider.created_by,
  provider.created_by_email,
  provider.created_at,
  coalesce(topup.topped_up, 0)::numeric(18, 2) as topped_up_amount,
  coalesce(allocation.allocated, 0)::numeric(18, 2) as allocated_amount,
  coalesce(allocation.returned, 0)::numeric(18, 2) as returned_amount,
  coalesce(purchase.purchased, 0)::numeric(18, 2) as purchased_amount,
  (
    coalesce(topup.topped_up, 0)
    - coalesce(allocation.allocated, 0)
    + coalesce(allocation.returned, 0)
  )::numeric(18, 2) as main_balance,
  (
    coalesce(allocation.allocated, 0)
    - coalesce(allocation.returned, 0)
    - coalesce(purchase.purchased, 0)
  )::numeric(18, 2) as cards_balance,
  (coalesce(topup.topped_up, 0) - coalesce(purchase.purchased, 0))::numeric(18, 2)
    as total_prepaid_balance,
  topup.last_topup_date
from public.fuel_providers provider
left join topup_totals topup on topup.provider_id = provider.id
left join allocation_totals allocation on allocation.provider_id = provider.id
left join purchase_totals purchase on purchase.provider_id = provider.id;

create view public.fuel_card_ledger
with (security_invoker = true)
as
select
  'allocation:' || allocation.id::text as entry_key,
  allocation.card_id,
  allocation.allocation_date as transaction_date,
  allocation.allocation_type as kind,
  case when allocation.allocation_type = 'allocate' then 'inflow' else 'outflow' end as direction,
  allocation.amount,
  coalesce(allocation.notes, case when allocation.allocation_type = 'allocate' then 'Allocated from provider balance' else 'Returned to provider balance' end) as description,
  allocation.created_by_email,
  allocation.created_at
from public.fuel_card_allocations allocation
union all
select
  'expense:' || expense.id::text,
  expense.fuel_card_id,
  expense.expense_date,
  'fuel_purchase',
  'outflow',
  expense.amount,
  expense.merchant || case when expense.description is null or btrim(expense.description) = '' then '' else ' — ' || expense.description end,
  expense.created_by_email,
  expense.created_at
from public.expenses expense
where expense.fuel_card_id is not null;

create view public.truck_cost_summary
with (security_invoker = true)
as
select
  truck.id,
  truck.name,
  truck.registration_number,
  truck.make_model,
  truck.tank_capacity_liters,
  truck.is_active,
  truck.notes,
  truck.created_by,
  truck.created_by_email,
  truck.created_at,
  coalesce(sum(expense.amount), 0)::numeric(18, 2) as total_cost,
  coalesce(sum(expense.amount) filter (where expense.payment_method = 'Fuel card'), 0)::numeric(18, 2) as fuel_cost,
  coalesce(sum(expense.quantity) filter (where expense.payment_method = 'Fuel card'), 0)::numeric(18, 3) as fuel_liters,
  coalesce(sum(
    expense.quantity - (expense.fuel_level_after_liters - expense.fuel_level_before_liters)
  ) filter (
    where expense.payment_method = 'Fuel card'
      and expense.fuel_level_before_liters is not null
      and expense.fuel_level_after_liters is not null
  ), 0)::numeric(18, 3) as sensor_variance_liters,
  count(expense.id)::bigint as expense_count,
  max(expense.expense_date) as last_expense_date
from public.trucks truck
left join public.expenses expense on expense.truck_id = truck.id
group by truck.id;

revoke all on table public.fuel_card_balances, public.fuel_provider_balances,
  public.fuel_card_ledger, public.truck_cost_summary
from public, anon;
grant select on table public.fuel_card_balances, public.fuel_provider_balances,
  public.fuel_card_ledger, public.truck_cost_summary
to authenticated, service_role;
