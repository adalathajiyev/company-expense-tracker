-- Keep delegated cash access behind one audited check. This avoids policy
-- recursion and prevents a stale membership from exposing Main Cash after a
-- user's role changes.
create or replace function private.can_access_cash_account(
  p_account_id uuid,
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
      from public.cash_account_members member
      join public.cash_accounts account on account.id = member.account_id
      where member.account_id = p_account_id
        and member.user_id = (select auth.uid())
        and account.account_type <> 'main'
        and (
          not p_require_spend_permission
          or member.permission in ('spender', 'manager')
        )
    );
$$;

revoke execute on function private.can_access_cash_account(uuid, boolean) from public, anon;
grant execute on function private.can_access_cash_account(uuid, boolean) to authenticated, service_role;

drop policy if exists "Authorized users can read cash accounts" on public.cash_accounts;
create policy "Authorized users can read cash accounts"
  on public.cash_accounts for select to authenticated
  using (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    or (select private.can_access_cash_account(id))
  );

drop policy if exists "Authorized users can read cash memberships" on public.cash_account_members;
create policy "Authorized users can read cash memberships"
  on public.cash_account_members for select to authenticated
  using (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    or (select private.can_access_cash_account(account_id))
  );

drop policy if exists "Authorized users can read cash transfers" on public.cash_transfers;
create policy "Authorized users can read cash transfers"
  on public.cash_transfers for select to authenticated
  using (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    or (select private.can_access_cash_account(from_account_id))
    or (select private.can_access_cash_account(to_account_id))
  );

drop policy if exists "Authorized users can read cash reconciliations" on public.cash_reconciliations;
create policy "Authorized users can read cash reconciliations"
  on public.cash_reconciliations for select to authenticated
  using (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    or (select private.can_access_cash_account(account_id))
  );

drop policy if exists "Authorized users can add cash reconciliations" on public.cash_reconciliations;
create policy "Authorized users can add cash reconciliations"
  on public.cash_reconciliations for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (select private.current_app_role()) in ('admin', 'main_accountant')
      or (select private.can_access_cash_account(account_id, true))
    )
  );

drop policy if exists "Authorized users can read expenses" on public.expenses;
create policy "Authorized users can read expenses"
  on public.expenses for select to authenticated
  using (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    or (select private.can_access_cash_account(cash_account_id))
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
          select 1
          from public.cash_accounts account
          where account.id = cash_account_id
            and account.is_active
        )
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
      )
    )
  );
