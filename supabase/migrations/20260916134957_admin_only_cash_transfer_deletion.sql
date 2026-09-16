drop policy if exists "Privileged users can delete recent cash transfers" on public.cash_transfers;
drop policy if exists "Admins can delete cash transfers" on public.cash_transfers;

create policy "Admins can delete cash transfers"
  on public.cash_transfers for delete to authenticated
  using ((select private.current_app_role()) = 'admin');

drop trigger if exists prevent_expired_cash_transfer_delete on public.cash_transfers;
drop function if exists private.prevent_expired_cash_transfer_delete();
