-- Existing sales may be corrected by Admins and Main Accountants, but their
-- financial identity and payment reconciliation must remain intact.
create or replace function private.prevent_sale_total_below_allocations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allocated_total numeric(18, 2);
begin
  select coalesce(sum(allocation.amount), 0)
  into allocated_total
  from public.payment_allocations allocation
  where allocation.sale_id = new.id;

  if new.amount < allocated_total then
    raise exception 'Sale total cannot be less than its allocated payments'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke execute on function private.prevent_sale_total_below_allocations()
from public, anon, authenticated;

drop trigger if exists validate_sale_total_against_allocations on public.sales;
create trigger validate_sale_total_against_allocations
before update of quantity, unit_price, amount on public.sales
for each row execute function private.prevent_sale_total_below_allocations();

-- Browser clients may update only user-editable sale details. The customer,
-- creator metadata, calculated amount, ID, and creation time remain protected.
revoke update on table public.sales from authenticated;
grant update (
  sale_date,
  product,
  description,
  category,
  quantity,
  unit,
  unit_price,
  payment_method
) on table public.sales to authenticated;
