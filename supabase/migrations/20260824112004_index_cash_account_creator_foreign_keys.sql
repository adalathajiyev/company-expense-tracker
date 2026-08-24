-- Cover creator foreign keys so auth-user updates/deletes do not require full
-- scans of the operational cash tables.
create index cash_accounts_created_by_idx
  on public.cash_accounts (created_by)
  where created_by is not null;

create index cash_account_members_created_by_idx
  on public.cash_account_members (created_by)
  where created_by is not null;

create index cash_transfers_created_by_idx
  on public.cash_transfers (created_by)
  where created_by is not null;

create index cash_reconciliations_created_by_idx
  on public.cash_reconciliations (created_by)
  where created_by is not null;
