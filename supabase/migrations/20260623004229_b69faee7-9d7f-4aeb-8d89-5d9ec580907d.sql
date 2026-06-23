-- A.1 Extensiones y función de timestamp
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- A.2 profiles
create table if not exists public.profiles (
  user_id               uuid primary key references auth.users(id) on delete cascade,
  email                 text not null unique,
  full_name             text not null,
  role                  text not null default 'platform_user'
                          check (role in ('super_admin', 'platform_user')),
  can_create_agreements boolean not null default false,
  status                text not null default 'active'
                          check (status in ('active', 'inactive')),
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint can_create_only_platform_user check (
    role = 'platform_user' or can_create_agreements = false
  )
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- A.3 user_client_access
create table if not exists public.user_client_access (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (client_id, user_id)
);
grant select, insert, update, delete on public.user_client_access to authenticated;
grant all on public.user_client_access to service_role;

-- A.4 agreement_members
create table if not exists public.agreement_members (
  id             uuid primary key default gen_random_uuid(),
  agreement_id   uuid not null references public.agreements(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  role           text not null
                   check (role in ('agreement_admin', 'agreement_member')),
  can_view_costs boolean not null default false,
  assigned_by    uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (agreement_id, user_id)
);
grant select, insert, update, delete on public.agreement_members to authenticated;
grant all on public.agreement_members to service_role;

-- A.5 Triggers de integridad de agreement_members
create or replace function public.prevent_agreement_member_identity_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.agreement_id <> old.agreement_id or new.user_id <> old.user_id then
    raise exception 'agreement_id and user_id cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_agreement_member_identity_change_trigger
  on public.agreement_members;
create trigger prevent_agreement_member_identity_change_trigger
  before update on public.agreement_members
  for each row execute function public.prevent_agreement_member_identity_change();

create or replace function public.prevent_last_agreement_admin_removal()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  admin_count integer;
begin
  if (tg_op = 'DELETE' and old.role = 'agreement_admin')
     or (tg_op = 'UPDATE' and old.role = 'agreement_admin'
         and new.role <> 'agreement_admin') then
    select count(*) into admin_count
      from public.agreement_members
     where agreement_id = old.agreement_id
       and role = 'agreement_admin'
       and id <> old.id;
    if admin_count = 0 then
      raise exception 'An agreement must have at least one agreement_admin';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists prevent_last_agreement_admin_removal_trigger
  on public.agreement_members;
create trigger prevent_last_agreement_admin_removal_trigger
  before update or delete on public.agreement_members
  for each row execute function public.prevent_last_agreement_admin_removal();

-- A.6 agreement_change_requests
create table if not exists public.agreement_change_requests (
  id               uuid primary key default gen_random_uuid(),
  agreement_id     uuid not null references public.agreements(id) on delete cascade,
  requested_by     uuid not null references auth.users(id) on delete cascade,
  target_table     text not null,
  target_record_id uuid not null,
  field_name       text not null,
  old_value        jsonb,
  new_value        jsonb,
  status           text not null default 'pending'
                     check (status in ('pending', 'approved', 'rejected')),
  reviewed_by      uuid references auth.users(id) on delete set null,
  review_note      text,
  created_at       timestamptz not null default now(),
  reviewed_at      timestamptz,
  constraint review_fields_required_when_closed check (
    status = 'pending' or (reviewed_by is not null and reviewed_at is not null)
  )
);
grant select, insert, update, delete on public.agreement_change_requests to authenticated;
grant all on public.agreement_change_requests to service_role;