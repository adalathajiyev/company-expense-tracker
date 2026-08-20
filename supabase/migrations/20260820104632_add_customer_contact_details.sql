alter table public.customers
  add column phone text,
  add column details text;

-- Legacy rows predate contact capture. Keep them valid while making phone
-- mandatory for every customer created after this migration.
update public.customers
set phone = 'Not provided'
where phone is null or btrim(phone) = '';

alter table public.customers
  alter column phone set not null,
  add constraint customers_phone_not_empty_check
    check (btrim(phone) <> '');
