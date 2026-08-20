-- The validator must lock and inspect the parent sale even when the caller has
-- insert-only Sales access. It is trigger-only and has a fixed empty search path.
create or replace function public.validate_sale_payment_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sale_total numeric(12, 2);
  existing_total numeric(12, 2);
begin
  if new.payment_date > current_date then
    raise exception 'Payment date cannot be in the future';
  end if;

  select amount
  into sale_total
  from public.sales
  where id = new.sale_id
  for update;

  if sale_total is null then
    raise exception 'Sale does not exist';
  end if;

  select coalesce(sum(amount), 0)
  into existing_total
  from public.sale_payments
  where sale_id = new.sale_id
    and id <> new.id;

  if existing_total + new.amount > sale_total then
    raise exception 'Payment exceeds remaining sale balance';
  end if;

  return new;
end;
$$;

revoke execute on function public.validate_sale_payment_total() from public, anon, authenticated;
