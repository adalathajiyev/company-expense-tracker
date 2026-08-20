-- Admin-only directory used by the Access module. Authentication credentials
-- remain in auth.users; only non-secret account metadata is mirrored here.
create table public.user_directory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null,
  last_sign_in_at timestamptz
);

alter table public.user_directory enable row level security;

revoke all on table public.user_directory from public, anon;
grant select on table public.user_directory to authenticated;
grant select, insert, update, delete on table public.user_directory to service_role;

insert into public.user_directory (user_id, email, created_at, last_sign_in_at)
select id, email, created_at, last_sign_in_at
from auth.users
on conflict (user_id) do update
set email = excluded.email,
    created_at = excluded.created_at,
    last_sign_in_at = excluded.last_sign_in_at;

create policy "Admins can read the user directory"
  on public.user_directory
  for select
  to authenticated
  using ((select private.current_app_role()) = 'admin');

-- Auth owns the source records, so a private trigger keeps the directory in
-- sync without giving browser clients write access to account metadata.
create or replace function private.sync_auth_user_directory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_directory (user_id, email, created_at, last_sign_in_at)
  values (new.id, new.email, new.created_at, new.last_sign_in_at)
  on conflict (user_id) do update
  set email = excluded.email,
      created_at = excluded.created_at,
      last_sign_in_at = excluded.last_sign_in_at;

  return new;
end;
$$;

revoke execute on function private.sync_auth_user_directory() from public, anon, authenticated;

drop trigger if exists sync_auth_user_directory on auth.users;
create trigger sync_auth_user_directory
after insert or update of email, last_sign_in_at on auth.users
for each row execute function private.sync_auth_user_directory();

-- Keep at least one administrator assigned. The UI also disables changing the
-- signed-in administrator, while this trigger protects direct API access.
create or replace function private.protect_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin'
    and (tg_op = 'DELETE' or new.role <> 'admin')
    and not exists (
      select 1
      from public.user_roles other_role
      where other_role.user_id <> old.user_id
        and other_role.role = 'admin'
    )
  then
    raise exception 'At least one administrator must remain assigned';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke execute on function private.protect_last_admin() from public, anon, authenticated;

drop trigger if exists protect_last_admin on public.user_roles;
create trigger protect_last_admin
before update or delete on public.user_roles
for each row execute function private.protect_last_admin();
