-- =============================================================================
-- PGCI · Fase 1 · Corrección de agrupadores (discovery 2026-07-03)
-- Aplica los deltas incrementales de 03.00.01/02, 03.20.01/02 vs. el schema vivo.
-- Idempotente.
-- =============================================================================

-- 1) profiles.can_create_agreement_groups -------------------------------------
alter table public.profiles
  add column if not exists can_create_agreement_groups boolean not null default false;

do $$ begin
  alter table public.profiles
    add constraint can_create_groups_only_platform_user check (
      role = 'platform_user' or can_create_agreement_groups = false
    );
exception when duplicate_object then null; end $$;

-- 2) Retirar check_agreement_client_access (columna eliminada) ---------------
drop trigger if exists trg_check_agreement_client_access on public.agreements;
drop function if exists public.check_agreement_client_access();

-- 3) agreements.group_id → nullable + ON DELETE SET NULL ---------------------
alter table public.agreements alter column group_id drop not null;

do $$
declare v_fk text;
begin
  select conname into v_fk from pg_constraint
   where conrelid = 'public.agreements'::regclass
     and contype = 'f'
     and conname = 'agreements_group_id_fkey';
  if v_fk is not null then
    execute 'alter table public.agreements drop constraint ' || v_fk;
  end if;
end $$;

alter table public.agreements
  add constraint agreements_group_id_fkey
    foreign key (group_id) references public.agreement_groups(id)
    on delete set null;

-- 4) Nuevas funciones de permiso ---------------------------------------------
create or replace function public.can_create_agreement_groups()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin()
    or exists (
      select 1 from public.profiles
       where user_id = auth.uid()
         and role = 'platform_user'
         and status = 'active'
         and can_create_agreement_groups = true
    );
$$;

create or replace function public.can_create_agreements()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin()
    or exists (
      select 1 from public.user_client_access uca
        join public.profiles p on p.user_id = uca.user_id
       where uca.user_id = auth.uid()
         and uca.can_create_agreements = true
         and p.role = 'platform_user'
         and p.status = 'active'
    );
$$;

-- 5) Trigger de doble autoridad al reasignar group_id ------------------------
create or replace function public.check_agreement_group_reassignment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.group_id is distinct from old.group_id then
    if new.group_id is not null then
      if not public.is_super_admin()
         and not public.is_agreement_group_admin(new.group_id, auth.uid()) then
        raise exception 'Se requiere ser admin del agrupador destino para asignar este acuerdo'
          using errcode = '42501';
      end if;
    end if;
    -- Sacar (new.group_id null): agreement_admin es suficiente (RLS general).
  end if;
  return new;
end;
$$;

drop trigger if exists check_agreement_group_reassignment_trigger on public.agreements;
create trigger check_agreement_group_reassignment_trigger
  before update on public.agreements
  for each row execute function public.check_agreement_group_reassignment();

-- 6) RLS actualizada ---------------------------------------------------------
-- agreements_insert: general de cartera
drop policy if exists agreements_insert on public.agreements;
create policy agreements_insert on public.agreements for insert to authenticated
  with check ( public.can_create_agreements() );

-- ag_insert: super_admin o permiso global de agrupadores
drop policy if exists ag_insert on public.agreement_groups;
create policy ag_insert on public.agreement_groups
  for insert to authenticated
  with check (
    public.is_super_admin()
    or public.can_create_agreement_groups()
  );

-- ag_delete: super_admin o admin del propio agrupador
drop policy if exists ag_delete on public.agreement_groups;
create policy ag_delete on public.agreement_groups
  for delete to authenticated
  using (
    public.is_super_admin()
    or public.is_agreement_group_admin(id, auth.uid())
  );
