-- Projects are cost centres only. They intentionally do not reference cash
-- accounts: cash custody and project reporting remain separate concerns.
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  location text not null check (length(btrim(location)) > 0),
  status text not null default 'planned'
    check (status in ('planned', 'active', 'completed', 'archived')),
  estimated_cost numeric(18, 2)
    check (estimated_cost is null or estimated_cost >= 0),
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_status_name_idx on public.projects (status, name, id);
create index projects_created_by_idx on public.projects (created_by)
where created_by is not null;

alter table public.expenses
  add column project_id uuid references public.projects(id) on delete restrict;

create index expenses_project_date_idx
  on public.expenses (project_id, expense_date desc, id)
  where project_id is not null;

create trigger set_project_creator
before insert or update on public.projects
for each row execute function private.set_record_creator();

create or replace function private.set_project_updated_at()
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

revoke execute on function private.set_project_updated_at()
from public, anon, authenticated;

create trigger set_project_updated_at
before update on public.projects
for each row execute function private.set_project_updated_at();

alter table public.projects enable row level security;

revoke all on table public.projects from public, anon;
grant select, insert, update on table public.projects
  to authenticated, service_role;
grant delete on table public.projects to service_role;

create policy "Privileged users can read projects"
  on public.projects for select to authenticated
  using ((select private.current_app_role()) in ('admin', 'main_accountant'));

create policy "Privileged users can add projects"
  on public.projects for insert to authenticated
  with check (
    (select private.current_app_role()) in ('admin', 'main_accountant')
    and created_by = (select auth.uid())
  );

create policy "Privileged users can update projects"
  on public.projects for update to authenticated
  using ((select private.current_app_role()) in ('admin', 'main_accountant'))
  with check ((select private.current_app_role()) in ('admin', 'main_accountant'));

-- The view centralizes cost calculations so every screen uses the same
-- definition. Actual cost includes every linked expense, paid or pending.
create view public.project_cost_summary
with (security_invoker = true)
as
select
  project.id,
  project.name,
  project.location,
  project.status,
  project.estimated_cost,
  project.description,
  project.created_by,
  project.created_by_email,
  project.created_at,
  project.updated_at,
  coalesce(sum(expense.amount), 0)::numeric(18, 2) as actual_cost,
  coalesce(sum(expense.amount) filter (where expense.status = 'paid'), 0)::numeric(18, 2) as paid_cost,
  coalesce(sum(expense.amount) filter (where expense.status = 'pending'), 0)::numeric(18, 2) as pending_cost,
  count(expense.id)::bigint as expense_count,
  case
    when project.estimated_cost is null then null
    else (project.estimated_cost - coalesce(sum(expense.amount), 0))::numeric(18, 2)
  end as variance
from public.projects project
left join public.expenses expense on expense.project_id = project.id
group by project.id;

revoke all on table public.project_cost_summary from public, anon;
grant select on table public.project_cost_summary to authenticated, service_role;
