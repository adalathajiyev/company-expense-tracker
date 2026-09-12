-- Incoming material receipts are intentionally independent from expenses and
-- cash balances. They record quantities, invoice value, delivery costs, and
-- supporting documents without implying that complete stock is available.
create table public.raw_material_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_date date not null,
  supplier_name text not null check (length(btrim(supplier_name)) > 0),
  supplier_country text,
  invoice_number text,
  invoice_date date,
  transport_method text not null default 'Truck'
    check (transport_method in ('Truck', 'Rail', 'Sea', 'Air', 'Courier', 'Other')),
  vehicle_reference text,
  customs_reference text,
  currency text not null default 'AZN'
    check (currency ~ '^[A-Z]{3}$'),
  exchange_rate_to_azn numeric(18, 8) not null default 1
    check (exchange_rate_to_azn > 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (currency <> 'AZN' or exchange_rate_to_azn = 1)
);

create table public.raw_material_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.raw_material_receipts(id) on delete cascade,
  position integer not null check (position >= 0),
  material_name text not null check (length(btrim(material_name)) > 0),
  category text not null check (length(btrim(category)) > 0),
  specification text,
  quantity numeric(18, 6) not null check (quantity > 0),
  unit text not null check (length(btrim(unit)) > 0),
  unit_price numeric(18, 6) not null check (unit_price >= 0),
  line_total numeric(24, 6)
    generated always as (round(quantity * unit_price, 6)) stored,
  created_at timestamptz not null default now(),
  unique (receipt_id, position)
);

create table public.raw_material_receipt_costs (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.raw_material_receipts(id) on delete cascade,
  position integer not null check (position >= 0),
  cost_type text not null check (length(btrim(cost_type)) > 0),
  description text,
  amount_azn numeric(18, 2) not null check (amount_azn > 0),
  created_at timestamptz not null default now(),
  unique (receipt_id, position)
);

create table public.raw_material_attachments (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.raw_material_receipts(id) on delete cascade,
  storage_path text not null unique check (length(btrim(storage_path)) > 0),
  file_name text not null check (length(btrim(file_name)) > 0),
  content_type text not null check (
    content_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  ),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index raw_material_receipts_date_idx
  on public.raw_material_receipts (receipt_date desc, id);
create index raw_material_receipts_created_by_idx
  on public.raw_material_receipts (created_by)
  where created_by is not null;
create index raw_material_receipt_items_receipt_idx
  on public.raw_material_receipt_items (receipt_id, position);
create index raw_material_receipt_costs_receipt_idx
  on public.raw_material_receipt_costs (receipt_id, position);
create index raw_material_attachments_receipt_idx
  on public.raw_material_attachments (receipt_id, created_at, id);
create index raw_material_attachments_uploaded_by_idx
  on public.raw_material_attachments (uploaded_by);

create trigger set_raw_material_receipt_creator
before insert or update on public.raw_material_receipts
for each row execute function private.set_record_creator();

create or replace function private.set_raw_material_receipt_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function private.set_raw_material_receipt_updated_at()
from public, anon, authenticated;

create trigger set_raw_material_receipt_updated_at
before update on public.raw_material_receipts
for each row execute function private.set_raw_material_receipt_updated_at();

create or replace function private.prevent_future_raw_material_receipt()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.receipt_date > (now() at time zone 'Asia/Baku')::date then
    raise exception 'A received delivery cannot have a future date';
  end if;
  return new;
end;
$$;

revoke execute on function private.prevent_future_raw_material_receipt()
from public, anon, authenticated;

create trigger prevent_future_raw_material_receipt
before insert or update on public.raw_material_receipts
for each row execute function private.prevent_future_raw_material_receipt();

alter table public.raw_material_receipts enable row level security;
alter table public.raw_material_receipt_items enable row level security;
alter table public.raw_material_receipt_costs enable row level security;
alter table public.raw_material_attachments enable row level security;

revoke all on table
  public.raw_material_receipts,
  public.raw_material_receipt_items,
  public.raw_material_receipt_costs,
  public.raw_material_attachments
from public, anon;

grant select, insert, delete on table
  public.raw_material_receipts
to authenticated;

grant select, insert on table
  public.raw_material_receipt_items,
  public.raw_material_receipt_costs,
  public.raw_material_attachments
to authenticated;

grant all on table
  public.raw_material_receipts,
  public.raw_material_receipt_items,
  public.raw_material_receipt_costs,
  public.raw_material_attachments
to service_role;

create policy "Privileged users can read raw material receipts"
  on public.raw_material_receipts for select to authenticated
  using ((select private.current_app_role()) in ('admin', 'main_accountant'));

create policy "Privileged users can add raw material receipts"
  on public.raw_material_receipts for insert to authenticated
  with check (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    and created_by = (select auth.uid())
  );

create policy "Creators and admins can delete raw material receipts"
  on public.raw_material_receipts for delete to authenticated
  using (
    (select private.current_app_role()) = 'admin'
    or created_by = (select auth.uid())
  );

create policy "Privileged users can read raw material items"
  on public.raw_material_receipt_items for select to authenticated
  using (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    and exists (
      select 1 from public.raw_material_receipts receipt
      where receipt.id = raw_material_receipt_items.receipt_id
    )
  );

create policy "Creators and admins can add raw material items"
  on public.raw_material_receipt_items for insert to authenticated
  with check (
    exists (
      select 1 from public.raw_material_receipts receipt
      where receipt.id = raw_material_receipt_items.receipt_id
        and (
          (select private.current_app_role()) = 'admin'
          or receipt.created_by = (select auth.uid())
        )
    )
  );

create policy "Privileged users can read raw material costs"
  on public.raw_material_receipt_costs for select to authenticated
  using (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    and exists (
      select 1 from public.raw_material_receipts receipt
      where receipt.id = raw_material_receipt_costs.receipt_id
    )
  );

create policy "Creators and admins can add raw material costs"
  on public.raw_material_receipt_costs for insert to authenticated
  with check (
    exists (
      select 1 from public.raw_material_receipts receipt
      where receipt.id = raw_material_receipt_costs.receipt_id
        and (
          (select private.current_app_role()) = 'admin'
          or receipt.created_by = (select auth.uid())
        )
    )
  );

create policy "Privileged users can read raw material attachments"
  on public.raw_material_attachments for select to authenticated
  using (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    and exists (
      select 1 from public.raw_material_receipts receipt
      where receipt.id = raw_material_attachments.receipt_id
    )
  );

create policy "Creators and admins can add raw material attachments"
  on public.raw_material_attachments for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and exists (
      select 1 from public.raw_material_receipts receipt
      where receipt.id = raw_material_attachments.receipt_id
        and (
          (select private.current_app_role()) = 'admin'
          or receipt.created_by = (select auth.uid())
        )
    )
  );

-- Invoice files are private. Browser clients receive access only through
-- authenticated Storage requests or short-lived signed URLs.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'raw-material-documents',
  'raw-material-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Privileged users can read raw material documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'raw-material-documents'
    and (select private.current_app_role()) in ('admin', 'main_accountant')
  );

create policy "Privileged users can upload raw material documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'raw-material-documents'
    and owner_id = (select auth.uid()::text)
    and (select private.current_app_role()) in ('admin', 'main_accountant')
  );

create policy "Owners and admins can delete raw material documents"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'raw-material-documents'
    and (
      owner_id = (select auth.uid()::text)
      or (select private.current_app_role()) = 'admin'
    )
  );
