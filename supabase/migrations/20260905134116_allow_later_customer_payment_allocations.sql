-- Payments may be received before a sale exists. Allow authorized users to
-- apply the remaining credit later while the existing validation trigger
-- continues to lock both records and prevent over-allocation.
drop policy if exists "Receipt creators can add payment allocations"
  on public.payment_allocations;

create policy "Authorized users can add payment allocations"
  on public.payment_allocations for insert to authenticated
  with check (
    exists (
      select 1
      from public.customer_payments payment
      where payment.id = payment_allocations.payment_id
        and (
          (select private.current_app_role()) in ('admin', 'main_accountant')
          or (
            (select private.current_app_role()) = 'office_accountant'
            and payment.created_by = (select auth.uid())
            and payment.payment_method = 'Bank transfer'
          )
        )
    )
  );
