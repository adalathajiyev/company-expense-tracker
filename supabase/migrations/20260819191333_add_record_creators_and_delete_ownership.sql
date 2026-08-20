-- Audit who created records in the modules where deletion ownership matters.
alter table public.expenses add column created_by uuid;
alter table public.expenses add column created_by_email text;
alter table public.owner_funding add column created_by uuid;
alter table public.owner_funding add column created_by_email text;
alter table public.sales add column created_by uuid;
alter table public.sales add column created_by_email text;
alter table public.sale_payments add column created_by uuid;
alter table public.sale_payments add column created_by_email text;

-- Historical rows predate creator tracking. Attribute them to the oldest Admin,
-- which is the existing owner account in the current environments.
-- Salary-generated expenses are normally immutable; suspend only that trigger
-- for this one-time metadata backfill and restore it before the transaction ends.
alter table public.expenses disable trigger protect_generated_salary_expense;

do $$
declare
  fallback_user_id uuid;
  fallback_email text;
  historical_row_count bigint;
begin
  select user_role.user_id, directory.email
  into fallback_user_id, fallback_email
  from public.user_roles user_role
  left join public.user_directory directory on directory.user_id = user_role.user_id
  where user_role.role = 'admin'
  order by user_role.created_at, user_role.user_id
  limit 1;

  select
    (select count(*) from public.expenses)
    + (select count(*) from public.owner_funding)
    + (select count(*) from public.sales)
    + (select count(*) from public.sale_payments)
  into historical_row_count;

  if historical_row_count > 0 and fallback_user_id is null then
    raise exception 'An Admin role is required to backfill historical record creators';
  end if;

  update public.expenses
  set created_by = fallback_user_id,
      created_by_email = coalesce(fallback_email, fallback_user_id::text);

  update public.owner_funding
  set created_by = fallback_user_id,
      created_by_email = coalesce(fallback_email, fallback_user_id::text);

  update public.sales
  set created_by = fallback_user_id,
      created_by_email = coalesce(fallback_email, fallback_user_id::text);

  update public.sale_payments
  set created_by = fallback_user_id,
      created_by_email = coalesce(fallback_email, fallback_user_id::text);
end;
$$;

alter table public.expenses enable trigger protect_generated_salary_expense;

alter table public.expenses alter column created_by_email set not null;
alter table public.owner_funding alter column created_by_email set not null;
alter table public.sales alter column created_by_email set not null;
alter table public.sale_payments alter column created_by_email set not null;

alter table public.expenses
  add constraint expenses_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;
alter table public.owner_funding
  add constraint owner_funding_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;
alter table public.sales
  add constraint sales_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;
alter table public.sale_payments
  add constraint sale_payments_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

create index expenses_created_by_idx on public.expenses (created_by);
create index owner_funding_created_by_idx on public.owner_funding (created_by);
create index sales_created_by_idx on public.sales (created_by);
create index sale_payments_created_by_idx on public.sale_payments (created_by);

-- Browser clients cannot choose or later change creator metadata. The function
-- is private and uses the authenticated request ID to snapshot the Auth email.
create or replace function private.set_record_creator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_user_id uuid;
  request_email text;
begin
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_by_email := old.created_by_email;
    return new;
  end if;

  request_user_id := (select auth.uid());

  if request_user_id is not null then
    select auth_user.email::text
    into request_email
    from auth.users auth_user
    where auth_user.id = request_user_id;

    new.created_by := request_user_id;
    new.created_by_email := coalesce(request_email, request_user_id::text);
    return new;
  end if;

  -- Trusted server-side inserts may supply creator metadata explicitly.
  if new.created_by is not null then
    select auth_user.email::text
    into request_email
    from auth.users auth_user
    where auth_user.id = new.created_by;

    new.created_by_email := coalesce(new.created_by_email, request_email, new.created_by::text);
    return new;
  end if;

  raise exception 'An authenticated creator is required';
end;
$$;

revoke execute on function private.set_record_creator() from public, anon, authenticated;

create trigger set_expense_creator
before insert or update on public.expenses
for each row execute function private.set_record_creator();

create trigger set_owner_funding_creator
before insert or update on public.owner_funding
for each row execute function private.set_record_creator();

create trigger set_sale_creator
before insert or update on public.sales
for each row execute function private.set_record_creator();

create trigger set_sale_payment_creator
before insert or update on public.sale_payments
for each row execute function private.set_record_creator();

-- A non-Admin deleting a sale must not indirectly cascade-delete a payment
-- recorded by somebody else.
create or replace function private.protect_sale_payment_ownership_on_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select private.current_app_role()) <> 'admin'
    and exists (
      select 1
      from public.sale_payments payment
      where payment.sale_id = old.id
        and payment.created_by is distinct from (select auth.uid())
    )
  then
    raise exception 'This sale has payments created by another user and can only be deleted by an Admin';
  end if;

  return old;
end;
$$;

revoke execute on function private.protect_sale_payment_ownership_on_delete() from public, anon, authenticated;

create trigger protect_sale_payment_ownership_on_delete
before delete on public.sales
for each row execute function private.protect_sale_payment_ownership_on_delete();

-- Replace broad delete access with Admin-or-owner checks.
drop policy if exists expenses_privileged_access on public.expenses;
drop policy if exists owner_funding_privileged_access on public.owner_funding;

create policy "Privileged users can read expenses"
  on public.expenses for select to authenticated
  using ((select private.current_app_role()) in ('admin', 'main_accountant'));
create policy "Privileged users can add expenses"
  on public.expenses for insert to authenticated
  with check (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    and created_by = (select auth.uid())
  );
create policy "Privileged users can update expenses"
  on public.expenses for update to authenticated
  using ((select private.current_app_role()) in ('admin', 'main_accountant'))
  with check ((select private.current_app_role()) in ('admin', 'main_accountant'));
create policy "Admins or creators can delete expenses"
  on public.expenses for delete to authenticated
  using (
    (select private.current_app_role()) = 'admin'
    or (
      (select private.current_app_role()) = 'main_accountant'
      and created_by = (select auth.uid())
    )
  );

create policy "Privileged users can read owner funding"
  on public.owner_funding for select to authenticated
  using ((select private.current_app_role()) in ('admin', 'main_accountant'));
create policy "Privileged users can add owner funding"
  on public.owner_funding for insert to authenticated
  with check (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    and created_by = (select auth.uid())
  );
create policy "Privileged users can update owner funding"
  on public.owner_funding for update to authenticated
  using ((select private.current_app_role()) in ('admin', 'main_accountant'))
  with check ((select private.current_app_role()) in ('admin', 'main_accountant'));
create policy "Admins or creators can delete owner funding"
  on public.owner_funding for delete to authenticated
  using (
    (select private.current_app_role()) = 'admin'
    or (
      (select private.current_app_role()) = 'main_accountant'
      and created_by = (select auth.uid())
    )
  );

drop policy if exists "Authorized users can add sales" on public.sales;
drop policy if exists "Privileged users can delete sales" on public.sales;

create policy "Authorized users can add sales"
  on public.sales for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (select private.current_app_role()) in ('admin', 'main_accountant')
      or (
        (select private.current_app_role()) = 'office_accountant'
        and payment_method = 'Bank transfer'
      )
    )
  );
create policy "Admins or creators can delete sales"
  on public.sales for delete to authenticated
  using (
    (select private.current_app_role()) = 'admin'
    or (
      (select private.current_app_role()) in ('main_accountant', 'office_accountant')
      and created_by = (select auth.uid())
    )
  );

drop policy if exists "Authorized users can add sale payments" on public.sale_payments;
drop policy if exists "Privileged users can delete sale payments" on public.sale_payments;

create policy "Authorized users can add sale payments"
  on public.sale_payments for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (select private.current_app_role()) in ('admin', 'main_accountant')
      or (
        (select private.current_app_role()) = 'office_accountant'
        and payment_method = 'Bank transfer'
      )
    )
  );
create policy "Admins or creators can delete sale payments"
  on public.sale_payments for delete to authenticated
  using (
    (select private.current_app_role()) = 'admin'
    or (
      (select private.current_app_role()) in ('main_accountant', 'office_accountant')
      and created_by = (select auth.uid())
    )
  );
