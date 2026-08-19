-- Archived after consolidating the project into the development baseline migration.
-- Keep this file as historical context; it must not run before the baseline on a fresh database.
alter table public.expenses
  add column quantity numeric(12, 3),
  add column unit text,
  add column unit_price numeric(12, 2);

update public.expenses
set quantity = 1,
    unit = 'Piece',
    unit_price = amount;

alter table public.expenses
  alter column quantity set not null,
  alter column unit set not null,
  alter column unit_price set not null,
  add constraint expenses_quantity_positive_check check (quantity > 0),
  add constraint expenses_unit_not_empty_check check (btrim(unit) <> ''),
  add constraint expenses_unit_price_positive_check check (unit_price > 0),
  add constraint expenses_amount_calculation_check check (amount = round(quantity * unit_price, 2));
