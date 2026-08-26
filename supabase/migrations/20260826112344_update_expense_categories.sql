-- Salary expenses are generated inside an existing database function. Replace
-- only its category literal so all other closing behavior remains unchanged.
do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.close_previous_salary_month_and_generate(date)'::regprocedure
  ) into function_definition;

  if function_definition is null
    or position('''Payroll''' in function_definition) = 0
  then
    raise exception 'Could not find the Payroll category in the salary closing function';
  end if;

  execute replace(function_definition, '''Payroll''', '''Salaries''');
end;
$migration$;

-- Generated salary expenses are otherwise immutable. Temporarily suspend the
-- protection trigger only for this deterministic category rename.
alter table public.expenses disable trigger protect_generated_salary_expense;

update public.expenses
set category = 'Salaries'
where salary_source_id is not null
  and category = 'Payroll';

alter table public.expenses enable trigger protect_generated_salary_expense;
