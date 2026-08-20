-- customer_payments inherited a table-level UPDATE grant when it was created.
-- No application workflow edits receipts in place, so remove that stale grant.
revoke update on table public.customer_payments from authenticated;
