-- Align the clean baseline with the validation rules already enforced in production.
-- The conditional renames keep this safe on both a fresh baseline and the evolved
-- production schema.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.expenses'::regclass
      and conname = 'expenses_quantity_check'
  ) and not exists (
    select 1 from pg_constraint
    where conrelid = 'public.expenses'::regclass
      and conname = 'expenses_quantity_positive_check'
  ) then
    alter table public.expenses
      rename constraint expenses_quantity_check to expenses_quantity_positive_check;
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.expenses'::regclass
      and conname = 'expenses_unit_check'
  ) and not exists (
    select 1 from pg_constraint
    where conrelid = 'public.expenses'::regclass
      and conname = 'expenses_unit_not_empty_check'
  ) then
    alter table public.expenses
      rename constraint expenses_unit_check to expenses_unit_not_empty_check;
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.expenses'::regclass
      and conname = 'expenses_unit_price_check'
  ) and not exists (
    select 1 from pg_constraint
    where conrelid = 'public.expenses'::regclass
      and conname = 'expenses_unit_price_positive_check'
  ) then
    alter table public.expenses
      rename constraint expenses_unit_price_check to expenses_unit_price_positive_check;
  end if;
end
$$;

alter table public.expenses
  drop constraint if exists expenses_amount_check;
alter table public.expenses
  add constraint expenses_amount_check check (amount > 0);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.expenses'::regclass
      and conname = 'expenses_merchant_check'
  ) then
    alter table public.expenses
      add constraint expenses_merchant_check check (length(btrim(merchant)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.expenses'::regclass
      and conname = 'expenses_category_check'
  ) then
    alter table public.expenses
      add constraint expenses_category_check check (length(btrim(category)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.expenses'::regclass
      and conname = 'expenses_payment_method_check'
  ) then
    alter table public.expenses
      add constraint expenses_payment_method_check
      check (payment_method in ('Cash', 'Bank transfer'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.owner_funding'::regclass
      and conname = 'owner_funding_owner_name_check'
  ) then
    alter table public.owner_funding
      add constraint owner_funding_owner_name_check
      check (length(btrim(owner_name)) > 0);
  end if;
end
$$;

-- rls_auto_enable is an event-trigger function, not an application RPC. It only
-- needs to be executable by the database owner and service role.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
    grant execute on function public.rls_auto_enable() to service_role;
  end if;
end
$$;
