-- Fase 3: historización de user_client_access como período de acceso.
-- Los tres permisos (can_create_agreements, can_manage_client_catalog,
-- can_manage_matching) siguen siendo atributos del período vigente,
-- no se historizan.

-- 1) Columnas de período.
alter table public.user_client_access
  add column valid_from   timestamptz not null default now(),
  add column valid_until  timestamptz,
  add column started_by   uuid references auth.users(id) on delete set null,
  add column ended_by     uuid references auth.users(id) on delete set null,
  add column ended_reason text;

-- 2) Backfill preservando fecha real.
update public.user_client_access
   set valid_from = created_at,
       started_by = assigned_by
 where started_by is null;

-- 3) Sustituir unique rígido por índice parcial sobre período abierto.
alter table public.user_client_access
  drop constraint user_client_access_client_id_user_id_key;

create unique index user_client_access_open_uniq
  on public.user_client_access (client_id, user_id)
  where valid_until is null;

-- 4) Invariantes de período.
alter table public.user_client_access
  add constraint user_client_access_period_valid
    check (valid_until is null or valid_until >= valid_from),
  add constraint user_client_access_closure_consistent
    check ((valid_until is null) = (ended_by is null));

-- 5) Trigger de identidad (no existía).
create or replace function public.prevent_user_client_access_identity_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.client_id <> old.client_id or new.user_id <> old.user_id then
    raise exception 'client_id and user_id cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_user_client_access_identity_change
  on public.user_client_access;

create trigger prevent_user_client_access_identity_change
  before update on public.user_client_access
  for each row execute function public.prevent_user_client_access_identity_change();

-- 6) Cinco funciones autorizadoras: filtrar solo período abierto.

create or replace function public.user_has_client_access(p_user_id uuid, p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.profiles
       where user_id = p_user_id and role = 'super_admin' and status = 'active'
    )
    or exists (
      select 1 from public.user_client_access uca
        join public.profiles p on p.user_id = uca.user_id
       where uca.user_id = p_user_id
         and uca.client_id = p_client_id
         and uca.valid_until is null
         and p.status = 'active'
    );
$$;

create or replace function public.can_create_agreements()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1 from public.user_client_access uca
        join public.profiles p on p.user_id = uca.user_id
       where uca.user_id = auth.uid()
         and uca.can_create_agreements = true
         and uca.valid_until is null
         and p.role = 'platform_user'
         and p.status = 'active'
    );
$$;

create or replace function public.can_create_agreements_for_client(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
        from public.user_client_access uca
        join public.profiles p on p.user_id = uca.user_id
       where uca.user_id     = auth.uid()
         and uca.client_id   = p_client_id
         and uca.can_create_agreements = true
         and uca.valid_until is null
         and p.role          = 'platform_user'
         and p.status        = 'active'
    );
$$;

create or replace function public.can_manage_client_catalog(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1 from public.user_client_access uca
      join public.profiles p on p.user_id = uca.user_id
     where uca.user_id = auth.uid()
       and uca.client_id = p_client_id
       and uca.can_manage_client_catalog = true
       and uca.valid_until is null
       and p.status = 'active'
  );
$$;

create or replace function public.can_manage_matching(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1 from public.user_client_access uca
      join public.profiles p on p.user_id = uca.user_id
     where uca.user_id = auth.uid()
       and uca.client_id = p_client_id
       and uca.can_manage_matching = true
       and uca.valid_until is null
       and p.status = 'active'
  );
$$;