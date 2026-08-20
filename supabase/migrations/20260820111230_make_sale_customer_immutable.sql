-- A sale's customer is part of its financial identity. Corrections should be
-- made by deleting an unpaid sale and creating it again for the right customer.
drop function if exists public.reassign_sale_customer(uuid, uuid);

drop policy if exists "Privileged users can reassign customer payments"
  on public.customer_payments;
revoke update (customer_id) on table public.customer_payments
  from authenticated;

create or replace function private.prevent_sale_customer_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.customer_id is distinct from old.customer_id then
    raise exception 'The customer on an existing sale cannot be changed'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke execute on function private.prevent_sale_customer_change()
  from public, anon, authenticated;

drop trigger if exists prevent_sale_customer_change on public.sales;
create trigger prevent_sale_customer_change
before update of customer_id on public.sales
for each row execute function private.prevent_sale_customer_change();
