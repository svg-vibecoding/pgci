-- =========================================================
-- B.1 Funciones auxiliares de acceso
-- =========================================================

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
     where user_id = auth.uid() and role = 'super_admin' and status = 'active'
  );
$$;

create or replace function public.is_active_user(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
     where user_id = p_user_id and status = 'active'
  );
$$;

create or replace function public.user_has_client_access(
  p_user_id uuid, p_client_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    exists (
      select 1 from public.profiles
       where user_id = p_user_id and role = 'super_admin' and status = 'active'
    )
    or exists (
      select 1 from public.user_client_access uca
        join public.profiles p on p.user_id = uca.user_id
       where uca.user_id = p_user_id and uca.client_id = p_client_id
         and p.status = 'active'
    );
$$;

create or replace function public.has_client_access(p_client_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.user_has_client_access(auth.uid(), p_client_id);
$$;

create or replace function public.get_agreement_client_id(p_agreement_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select client_id from public.agreements where id = p_agreement_id limit 1;
$$;

create or replace function public.can_create_agreements_for_client(p_client_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or exists (
    select 1 from public.profiles p
     where p.user_id = auth.uid() and p.role = 'platform_user'
       and p.status = 'active' and p.can_create_agreements = true
       and public.user_has_client_access(auth.uid(), p_client_id)
  );
$$;

create or replace function public.user_can_access_agreement(
  p_user_id uuid, p_agreement_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    exists (
      select 1 from public.profiles
       where user_id = p_user_id and role = 'super_admin' and status = 'active'
    )
    or exists (
      select 1 from public.agreement_members am
        join public.agreements a on a.id = am.agreement_id
        join public.profiles p on p.user_id = am.user_id
       where am.user_id = p_user_id and am.agreement_id = p_agreement_id
         and p.status = 'active'
         and public.user_has_client_access(p_user_id, a.client_id)
    );
$$;

create or replace function public.can_access_agreement(p_agreement_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.user_can_access_agreement(auth.uid(), p_agreement_id);
$$;

create or replace function public.get_agreement_role(p_agreement_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select case when public.is_super_admin() then 'super_admin'
    else (
      select am.role from public.agreement_members am
        join public.profiles p on p.user_id = am.user_id
        join public.agreements a on a.id = am.agreement_id
       where am.agreement_id = p_agreement_id and am.user_id = auth.uid()
         and p.status = 'active'
         and public.user_has_client_access(auth.uid(), a.client_id)
       limit 1
    )
  end;
$$;

create or replace function public.can_admin_agreement(p_agreement_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.get_agreement_role(p_agreement_id)
    in ('super_admin', 'agreement_admin');
$$;

create or replace function public.can_view_costs(p_agreement_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or exists (
    select 1 from public.agreement_members am
      join public.agreements a on a.id = am.agreement_id
      join public.profiles p on p.user_id = am.user_id
     where am.agreement_id = p_agreement_id and am.user_id = auth.uid()
       and am.can_view_costs = true and p.status = 'active'
       and public.user_has_client_access(auth.uid(), a.client_id)
  );
$$;

-- =========================================================
-- B.2 Habilitar RLS — tablas del Grupo 8
-- =========================================================
alter table public.profiles                  enable row level security;
alter table public.user_client_access        enable row level security;
alter table public.agreement_members         enable row level security;
alter table public.agreement_change_requests enable row level security;

-- =========================================================
-- B.3 Políticas RLS — tablas del Grupo 8
-- =========================================================

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using ( public.is_super_admin() or user_id = auth.uid() );

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check ( public.is_super_admin() );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using ( public.is_super_admin() ) with check ( public.is_super_admin() );

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete to authenticated
  using ( public.is_super_admin() );

-- user_client_access
drop policy if exists uca_select on public.user_client_access;
create policy uca_select on public.user_client_access for select to authenticated
  using ( public.is_super_admin() or user_id = auth.uid() );

drop policy if exists uca_insert on public.user_client_access;
create policy uca_insert on public.user_client_access for insert to authenticated
  with check ( public.is_super_admin() );

drop policy if exists uca_delete on public.user_client_access;
create policy uca_delete on public.user_client_access for delete to authenticated
  using ( public.is_super_admin() );

-- agreement_members
drop policy if exists am_select on public.agreement_members;
create policy am_select on public.agreement_members for select to authenticated
  using ( public.is_super_admin() or public.can_access_agreement(agreement_id) );

drop policy if exists am_insert on public.agreement_members;
create policy am_insert on public.agreement_members for insert to authenticated
  with check ( public.is_super_admin() or (
    public.can_admin_agreement(agreement_id)
    and public.user_has_client_access(
      user_id, public.get_agreement_client_id(agreement_id)) ) );

drop policy if exists am_update on public.agreement_members;
create policy am_update on public.agreement_members for update to authenticated
  using ( public.is_super_admin() or public.can_admin_agreement(agreement_id) )
  with check ( public.is_super_admin() or (
    public.can_admin_agreement(agreement_id)
    and public.user_has_client_access(
      user_id, public.get_agreement_client_id(agreement_id)) ) );

drop policy if exists am_delete on public.agreement_members;
create policy am_delete on public.agreement_members for delete to authenticated
  using ( public.is_super_admin() or public.can_admin_agreement(agreement_id) );

-- agreement_change_requests
drop policy if exists acr_select on public.agreement_change_requests;
create policy acr_select on public.agreement_change_requests for select to authenticated
  using ( public.is_super_admin() or public.can_admin_agreement(agreement_id)
          or requested_by = auth.uid() );

drop policy if exists acr_insert on public.agreement_change_requests;
create policy acr_insert on public.agreement_change_requests for insert to authenticated
  with check ( requested_by = auth.uid()
               and public.can_access_agreement(agreement_id) );

drop policy if exists acr_update on public.agreement_change_requests;
create policy acr_update on public.agreement_change_requests for update to authenticated
  using ( public.is_super_admin() or public.can_admin_agreement(agreement_id) )
  with check ( public.is_super_admin() or public.can_admin_agreement(agreement_id) );

drop policy if exists acr_delete on public.agreement_change_requests;
create policy acr_delete on public.agreement_change_requests for delete to authenticated
  using ( public.is_super_admin() );

-- =========================================================
-- B.4 Políticas RLS en tablas relacionadas (stubs)
-- =========================================================

-- clients
alter table public.clients enable row level security;

drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients for select to authenticated
  using ( public.is_super_admin() or public.has_client_access(id) );

drop policy if exists clients_write on public.clients;
create policy clients_write on public.clients for all to authenticated
  using ( public.is_super_admin() ) with check ( public.is_super_admin() );

-- client_companies
alter table public.client_companies enable row level security;

drop policy if exists cc_select on public.client_companies;
create policy cc_select on public.client_companies for select to authenticated
  using ( public.is_super_admin() or public.has_client_access(client_id) );

drop policy if exists cc_write on public.client_companies;
create policy cc_write on public.client_companies for all to authenticated
  using ( public.is_super_admin() ) with check ( public.is_super_admin() );

-- agreements
alter table public.agreements enable row level security;

drop policy if exists agreements_select on public.agreements;
create policy agreements_select on public.agreements for select to authenticated
  using ( public.is_super_admin() or public.can_access_agreement(id) );

drop policy if exists agreements_insert on public.agreements;
create policy agreements_insert on public.agreements for insert to authenticated
  with check ( public.can_create_agreements_for_client(client_id) );

drop policy if exists agreements_update on public.agreements;
create policy agreements_update on public.agreements for update to authenticated
  using ( public.can_admin_agreement(id) ) with check ( public.can_admin_agreement(id) );

drop policy if exists agreements_delete on public.agreements;
create policy agreements_delete on public.agreements for delete to authenticated
  using ( public.can_admin_agreement(id) );

-- Contrato técnico para S-02
create or replace function public.check_agreement_client_access()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if public.is_super_admin() then
    return new;
  end if;
  if not public.user_has_client_access(auth.uid(), new.client_id) then
    raise exception 'Sin acceso al cliente para crear el acuerdo';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_agreement_client_access on public.agreements;
create trigger trg_check_agreement_client_access
  before insert on public.agreements
  for each row execute function public.check_agreement_client_access();

create or replace function public.add_creator_as_admin()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.agreement_members (agreement_id, user_id, role, assigned_by)
  values (new.id, auth.uid(), 'agreement_admin', auth.uid())
  on conflict (agreement_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_add_creator_as_admin on public.agreements;
create trigger trg_add_creator_as_admin
  after insert on public.agreements
  for each row execute function public.add_creator_as_admin();

-- agreement_products
alter table public.agreement_products enable row level security;

drop policy if exists ap_select on public.agreement_products;
create policy ap_select on public.agreement_products for select to authenticated
  using ( public.can_access_agreement(agreement_id) );

drop policy if exists ap_write on public.agreement_products;
create policy ap_write on public.agreement_products for all to authenticated
  using ( public.can_admin_agreement(agreement_id) )
  with check ( public.can_admin_agreement(agreement_id) );

-- agreement_costs
alter table public.agreement_costs enable row level security;

drop policy if exists ac_select on public.agreement_costs;
create policy ac_select on public.agreement_costs for select to authenticated
  using ( public.can_view_costs(agreement_id) );

drop policy if exists ac_insert on public.agreement_costs;
create policy ac_insert on public.agreement_costs for insert to authenticated
  with check ( public.can_admin_agreement(agreement_id) );

drop policy if exists ac_update on public.agreement_costs;
create policy ac_update on public.agreement_costs for update to authenticated
  using ( public.can_admin_agreement(agreement_id) )
  with check ( public.can_admin_agreement(agreement_id) );

drop policy if exists ac_delete on public.agreement_costs;
create policy ac_delete on public.agreement_costs for delete to authenticated
  using ( public.can_admin_agreement(agreement_id) );