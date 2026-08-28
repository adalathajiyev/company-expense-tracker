-- Qualify correlated policy columns and enforce prepaid balances in the
-- database so direct/concurrent requests cannot overdraw a provider or card.

drop policy if exists "Authorized users can read trucks" on public.trucks;
create policy "Authorized users can read trucks"
  on public.trucks for select to authenticated
  using (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    or exists (
      select 1
      from public.fuel_cards card
      where card.truck_id = public.trucks.id
        and (select private.can_access_fuel_card(card.id))
    )
  );

drop policy if exists "Authorized users can read fuel providers"
  on public.fuel_providers;
create policy "Authorized users can read fuel providers"
  on public.fuel_providers for select to authenticated
  using (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    or exists (
      select 1
      from public.fuel_cards card
      where card.provider_id = public.fuel_providers.id
        and (select private.can_access_fuel_card(card.id))
    )
  );

create or replace function private.validate_fuel_provider_topup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  provider_is_active boolean;
begin
  select provider.is_active
  into provider_is_active
  from public.fuel_providers provider
  where provider.id = new.provider_id
  for update;

  if provider_is_active is distinct from true then
    raise exception 'The selected fuel provider is inactive or does not exist';
  end if;

  return new;
end;
$$;

revoke execute on function private.validate_fuel_provider_topup()
from public, anon, authenticated;

create trigger validate_fuel_provider_topup
before insert on public.fuel_provider_topups
for each row execute function private.validate_fuel_provider_topup();

create or replace function private.validate_fuel_card_allocation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_provider_id uuid;
  card_is_active boolean;
  provider_is_active boolean;
  available_balance numeric(18, 2);
begin
  select card.provider_id, card.is_active, provider.is_active
  into selected_provider_id, card_is_active, provider_is_active
  from public.fuel_cards card
  join public.fuel_providers provider on provider.id = card.provider_id
  where card.id = new.card_id
  for update of card, provider;

  if card_is_active is distinct from true or provider_is_active is distinct from true then
    raise exception 'The selected fuel card or provider is inactive or does not exist';
  end if;

  if new.allocation_type = 'allocate' then
    select
      coalesce((
        select sum(topup.amount)
        from public.fuel_provider_topups topup
        where topup.provider_id = selected_provider_id
      ), 0)
      - coalesce((
        select sum(
          case when allocation.allocation_type = 'allocate'
            then allocation.amount else -allocation.amount end
        )
        from public.fuel_card_allocations allocation
        join public.fuel_cards provider_card on provider_card.id = allocation.card_id
        where provider_card.provider_id = selected_provider_id
      ), 0)
    into available_balance;
  else
    select
      coalesce(sum(
        case when allocation.allocation_type = 'allocate'
          then allocation.amount else -allocation.amount end
      ), 0)
      - coalesce((
        select sum(expense.amount)
        from public.expenses expense
        where expense.fuel_card_id = new.card_id
      ), 0)
    into available_balance
    from public.fuel_card_allocations allocation
    where allocation.card_id = new.card_id;
  end if;

  if new.amount > available_balance then
    if new.allocation_type = 'allocate' then
      raise exception 'The provider has only % AZN available', available_balance;
    end if;
    raise exception 'The fuel card has only % AZN available', available_balance;
  end if;

  return new;
end;
$$;

revoke execute on function private.validate_fuel_card_allocation()
from public, anon, authenticated;

create trigger validate_fuel_card_allocation
before insert on public.fuel_card_allocations
for each row execute function private.validate_fuel_card_allocation();

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

    if new.fuel_level_before_liters > tank_capacity
      or new.fuel_level_after_liters > tank_capacity
    then
      raise exception 'A fuel reading cannot exceed the truck tank capacity of % liters', tank_capacity;
    end if;
  end if;

  return new;
end;
$$;
