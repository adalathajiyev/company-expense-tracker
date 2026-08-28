-- Store one observed tank level per fuel expense. Existing readings retain the
-- post-fueling value when available, otherwise the pre-fueling value.

drop trigger if exists validate_fuel_expense on public.expenses;
drop view if exists public.truck_cost_summary;

alter table public.expenses
  add column fuel_tank_reading_liters numeric(12, 2);

update public.expenses
set fuel_tank_reading_liters = coalesce(
  fuel_level_after_liters,
  fuel_level_before_liters
)
where fuel_level_after_liters is not null
   or fuel_level_before_liters is not null;

alter table public.expenses
  drop constraint if exists expenses_fuel_card_fields_check,
  drop constraint if exists expenses_fuel_readings_check;

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
      and fuel_tank_reading_liters is null
    )
  ),
  add constraint expenses_fuel_tank_reading_check check (
    fuel_tank_reading_liters is null
    or (
      fuel_tank_reading_liters >= 0
      and payment_method = 'Fuel card'
      and truck_id is not null
    )
  );

alter table public.expenses
  drop column fuel_level_before_liters,
  drop column fuel_level_after_liters;

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
  available_card_balance numeric(18, 2);
begin
  if new.payment_method = 'Fuel card' then
    select card.is_active, provider.is_active
    into card_active, provider_active
    from public.fuel_cards card
    join public.fuel_providers provider on provider.id = card.provider_id
    where card.id = new.fuel_card_id
    for update of card, provider;

    if card_active is distinct from true or provider_active is distinct from true then
      raise exception 'The selected fuel card or provider is inactive';
    end if;

    select
      coalesce((
        select sum(
          case when allocation.allocation_type = 'allocate'
            then allocation.amount else -allocation.amount end
        )
        from public.fuel_card_allocations allocation
        where allocation.card_id = new.fuel_card_id
      ), 0)
      - coalesce(sum(expense.amount), 0)
    into available_card_balance
    from public.expenses expense
    where expense.fuel_card_id = new.fuel_card_id
      and (tg_op <> 'UPDATE' or expense.id <> old.id);

    if new.amount > available_card_balance then
      raise exception 'The fuel card has only % AZN available', available_card_balance;
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

    if new.fuel_tank_reading_liters > tank_capacity then
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
  fuel_tank_reading_liters
on public.expenses
for each row execute function private.validate_fuel_expense();

create view public.truck_cost_summary
with (security_invoker = true)
as
with expense_totals as (
  select
    expense.truck_id,
    coalesce(sum(expense.amount), 0)::numeric(18, 2) as total_cost,
    coalesce(sum(expense.amount) filter (
      where expense.payment_method = 'Fuel card'
    ), 0)::numeric(18, 2) as fuel_cost,
    coalesce(sum(expense.quantity) filter (
      where expense.payment_method = 'Fuel card'
    ), 0)::numeric(18, 3) as fuel_liters,
    count(expense.id)::bigint as expense_count,
    max(expense.expense_date) as last_expense_date
  from public.expenses expense
  where expense.truck_id is not null
  group by expense.truck_id
), latest_tank_reading as (
  select distinct on (expense.truck_id)
    expense.truck_id,
    expense.fuel_tank_reading_liters as latest_tank_reading_liters,
    expense.expense_date as last_tank_reading_date
  from public.expenses expense
  where expense.truck_id is not null
    and expense.fuel_tank_reading_liters is not null
  order by expense.truck_id, expense.expense_date desc,
    expense.created_at desc, expense.id desc
)
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
  coalesce(total.total_cost, 0)::numeric(18, 2) as total_cost,
  coalesce(total.fuel_cost, 0)::numeric(18, 2) as fuel_cost,
  coalesce(total.fuel_liters, 0)::numeric(18, 3) as fuel_liters,
  latest.latest_tank_reading_liters,
  latest.last_tank_reading_date,
  coalesce(total.expense_count, 0)::bigint as expense_count,
  total.last_expense_date
from public.trucks truck
left join expense_totals total on total.truck_id = truck.id
left join latest_tank_reading latest on latest.truck_id = truck.id;

revoke all on table public.truck_cost_summary from public, anon;
grant select on table public.truck_cost_summary to authenticated, service_role;
