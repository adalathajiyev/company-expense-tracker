alter table public.sales
  alter column quantity type numeric(18, 6),
  alter column unit_price type numeric(18, 6),
  alter column amount type numeric(18, 2);

create or replace function public.set_sale_amount()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.amount := round(new.quantity * new.unit_price, 2);
  return new;
end;
$$;

revoke execute on function public.set_sale_amount() from public, anon, authenticated;
grant execute on function public.set_sale_amount() to service_role;

drop trigger if exists set_sale_amount on public.sales;

create trigger set_sale_amount
before insert or update of quantity, unit_price, amount on public.sales
for each row
execute function public.set_sale_amount();
