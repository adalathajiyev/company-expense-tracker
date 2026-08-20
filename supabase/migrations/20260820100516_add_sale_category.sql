-- Classify every sale with one controlled business category.
alter table public.sales
  add column category text not null default 'Other';

alter table public.sales
  add constraint sales_category_check
  check (category in (
    'Pallet',
    'Pellet',
    'Furniture',
    'Raw materials',
    'Metal Pipes',
    'Sawdust',
    'Transportation',
    'Other'
  ));
