grant delete on table public.cash_transfers to authenticated, service_role;

drop policy if exists "Privileged users can delete recent cash transfers" on public.cash_transfers;
create policy "Privileged users can delete recent cash transfers"
  on public.cash_transfers for delete to authenticated
  using (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    and created_at > now() - interval '1 day'
  );

create or replace function private.prevent_expired_cash_transfer_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.created_at <= now() - interval '1 day' then
    raise exception 'Cash transfers can only be deleted within 24 hours of creation.'
      using errcode = 'P0001';
  end if;

  return old;
end;
$$;

revoke execute on function private.prevent_expired_cash_transfer_delete() from public, anon, authenticated;

drop trigger if exists prevent_expired_cash_transfer_delete on public.cash_transfers;
create trigger prevent_expired_cash_transfer_delete
before delete on public.cash_transfers
for each row execute function private.prevent_expired_cash_transfer_delete();
