-- Privileged users may correct the customer on a sale. Receipts allocated only
-- to that sale move with it in the same transaction. A receipt shared by
-- several sales cannot be moved because it belongs to one customer account.

drop trigger if exists protect_allocated_sale_customer on public.sales;
drop function if exists private.protect_allocated_sale_customer();

create or replace function private.validate_allocation_customer_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.customer_id = old.customer_id then
    return new;
  end if;

  if tg_table_name = 'sales' then
    if exists (
      select 1
      from public.payment_allocations allocation
      join public.customer_payments payment on payment.id = allocation.payment_id
      where allocation.sale_id = new.id
        and payment.customer_id <> new.customer_id
    ) then
      raise exception 'Sale and allocated payments must belong to the same customer';
    end if;
  elsif tg_table_name = 'customer_payments' then
    if exists (
      select 1
      from public.payment_allocations allocation
      join public.sales sale on sale.id = allocation.sale_id
      where allocation.payment_id = new.id
        and sale.customer_id <> new.customer_id
    ) then
      raise exception 'Payment and allocated sales must belong to the same customer';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function private.validate_allocation_customer_consistency()
  from public, anon, authenticated;

create constraint trigger validate_sale_allocation_customer
after update on public.sales
deferrable initially deferred
for each row execute function private.validate_allocation_customer_consistency();

create constraint trigger validate_payment_allocation_customer
after update on public.customer_payments
deferrable initially deferred
for each row execute function private.validate_allocation_customer_consistency();

grant update (customer_id) on table public.customer_payments to authenticated;

create policy "Privileged users can reassign customer payments"
  on public.customer_payments for update to authenticated
  using ((select private.current_app_role()) in ('admin', 'main_accountant'))
  with check ((select private.current_app_role()) in ('admin', 'main_accountant'));

create or replace function public.reassign_sale_customer(
  p_sale_id uuid,
  p_customer_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_customer_id uuid;
begin
  if (select private.current_app_role()) not in ('admin', 'main_accountant') then
    raise exception 'Only an Admin or Main Accountant can reassign a sale';
  end if;

  if not exists (
    select 1 from public.customers customer where customer.id = p_customer_id
  ) then
    raise exception 'Customer does not exist';
  end if;

  select sale.customer_id
  into current_customer_id
  from public.sales sale
  where sale.id = p_sale_id
  for update;

  if current_customer_id is null then
    raise exception 'Sale does not exist';
  end if;

  if current_customer_id = p_customer_id then
    return;
  end if;

  if exists (
    select 1
    from public.payment_allocations target_allocation
    join public.payment_allocations other_allocation
      on other_allocation.payment_id = target_allocation.payment_id
     and other_allocation.sale_id <> target_allocation.sale_id
    where target_allocation.sale_id = p_sale_id
  ) then
    raise exception 'This sale has a payment shared with another sale and cannot be reassigned';
  end if;

  -- Lock affected receipts in a stable order before updating either side of
  -- the deferred customer-consistency checks.
  perform 1
  from public.customer_payments payment
  where payment.id in (
    select allocation.payment_id
    from public.payment_allocations allocation
    where allocation.sale_id = p_sale_id
  )
  order by payment.id
  for update;

  update public.customer_payments payment
  set customer_id = p_customer_id
  where payment.id in (
    select allocation.payment_id
    from public.payment_allocations allocation
    where allocation.sale_id = p_sale_id
  );

  update public.sales
  set customer_id = p_customer_id
  where id = p_sale_id;
end;
$$;

revoke execute on function public.reassign_sale_customer(uuid, uuid)
  from public, anon;
grant execute on function public.reassign_sale_customer(uuid, uuid)
  to authenticated, service_role;
