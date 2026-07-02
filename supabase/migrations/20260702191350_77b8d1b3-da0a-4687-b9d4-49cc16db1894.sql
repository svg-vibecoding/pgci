-- 1. agreement_groups.created_by
alter table public.agreement_groups
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- 2. Backfill created_by desde agreements.created_by (primer acuerdo del grupo)
update public.agreement_groups g
   set created_by = sub.created_by
  from (
    select distinct on (a.group_id) a.group_id, a.created_by
      from public.agreements a
     where a.group_id is not null and a.created_by is not null
     order by a.group_id, a.created_at asc
  ) sub
 where g.id = sub.group_id
   and g.created_by is null;

-- 3. Tabla agreement_group_members
create table if not exists public.agreement_group_members (
  id                  uuid primary key default gen_random_uuid(),
  agreement_group_id  uuid not null references public.agreement_groups(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  role                text not null check (role in ('agreement_group_admin','agreement_group_member')),
  assigned_by         uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  unique (agreement_group_id, user_id)
);

create index if not exists agreement_group_members_group_idx
  on public.agreement_group_members(agreement_group_id);
create index if not exists agreement_group_members_user_idx
  on public.agreement_group_members(user_id);

grant select, insert, update, delete on public.agreement_group_members to authenticated;
grant all on public.agreement_group_members to service_role;

alter table public.agreement_group_members enable row level security;

-- 4. Trigger: prevent_last_group_admin_removal
create or replace function public.prevent_last_group_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_count int;
begin
  select count(*) into v_count
    from public.agreement_group_members
   where agreement_group_id = old.agreement_group_id
     and role = 'agreement_group_admin'
     and id <> old.id;

  if v_count = 0 and old.role = 'agreement_group_admin' then
    raise exception 'No se puede eliminar el último agreement_group_admin del agrupador.';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_prevent_last_group_admin_removal on public.agreement_group_members;
create trigger trg_prevent_last_group_admin_removal
  before delete or update on public.agreement_group_members
  for each row execute function public.prevent_last_group_admin_removal();

-- 5. Trigger: add_creator_as_group_admin
create or replace function public.add_creator_as_group_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into public.agreement_group_members
      (agreement_group_id, user_id, role, assigned_by)
    values
      (new.id, new.created_by, 'agreement_group_admin', new.created_by)
    on conflict (agreement_group_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_add_creator_as_group_admin on public.agreement_groups;
create trigger trg_add_creator_as_group_admin
  after insert on public.agreement_groups
  for each row execute function public.add_creator_as_group_admin();

-- 6. Backfill: creador existente como agreement_group_admin
insert into public.agreement_group_members
  (agreement_group_id, user_id, role, assigned_by)
select g.id, g.created_by, 'agreement_group_admin', g.created_by
  from public.agreement_groups g
 where g.created_by is not null
on conflict (agreement_group_id, user_id) do nothing;

-- 7. RLS de agreement_groups
alter table public.agreement_groups enable row level security;

drop policy if exists ag_select on public.agreement_groups;
create policy ag_select on public.agreement_groups
  for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.agreements a
       where a.group_id = agreement_groups.id
         and public.can_access_agreement(a.id)
    )
    or exists (
      select 1 from public.agreement_group_members m
       where m.agreement_group_id = agreement_groups.id
         and m.user_id = auth.uid()
    )
  );

drop policy if exists ag_insert on public.agreement_groups;
create policy ag_insert on public.agreement_groups
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (client_id is not null and public.can_create_agreements_for_client(client_id))
  );

drop policy if exists ag_update on public.agreement_groups;
create policy ag_update on public.agreement_groups
  for update to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.agreement_group_members m
       where m.agreement_group_id = agreement_groups.id
         and m.user_id = auth.uid()
         and m.role = 'agreement_group_admin'
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.agreement_group_members m
       where m.agreement_group_id = agreement_groups.id
         and m.user_id = auth.uid()
         and m.role = 'agreement_group_admin'
    )
  );

drop policy if exists ag_delete on public.agreement_groups;
create policy ag_delete on public.agreement_groups
  for delete to authenticated
  using (public.is_super_admin());

-- 8. RLS de agreement_group_members
drop policy if exists agm_select on public.agreement_group_members;
create policy agm_select on public.agreement_group_members
  for select to authenticated
  using (
    public.is_super_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.agreement_group_members m
       where m.agreement_group_id = agreement_group_members.agreement_group_id
         and m.user_id = auth.uid()
    )
    or exists (
      select 1 from public.agreements a
       where a.group_id = agreement_group_members.agreement_group_id
         and public.can_access_agreement(a.id)
    )
  );

drop policy if exists agm_insert on public.agreement_group_members;
create policy agm_insert on public.agreement_group_members
  for insert to authenticated
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.agreement_group_members m
       where m.agreement_group_id = agreement_group_members.agreement_group_id
         and m.user_id = auth.uid()
         and m.role = 'agreement_group_admin'
    )
  );

drop policy if exists agm_update on public.agreement_group_members;
create policy agm_update on public.agreement_group_members
  for update to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.agreement_group_members m
       where m.agreement_group_id = agreement_group_members.agreement_group_id
         and m.user_id = auth.uid()
         and m.role = 'agreement_group_admin'
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.agreement_group_members m
       where m.agreement_group_id = agreement_group_members.agreement_group_id
         and m.user_id = auth.uid()
         and m.role = 'agreement_group_admin'
    )
  );

drop policy if exists agm_delete on public.agreement_group_members;
create policy agm_delete on public.agreement_group_members
  for delete to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.agreement_group_members m
       where m.agreement_group_id = agreement_group_members.agreement_group_id
         and m.user_id = auth.uid()
         and m.role = 'agreement_group_admin'
    )
  );

-- 9. Corrección de agreements_insert (WITH CHECK real por cliente / grupo)
drop policy if exists agreements_insert on public.agreements;
create policy agreements_insert on public.agreements
  for insert to authenticated
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.agreement_companies ac
       where ac.agreement_id = agreements.id
         and public.can_create_agreements_for_client(ac.client_id)
    )
    or exists (
      select 1
        from public.agreement_groups g
        join public.clients c on c.id = g.client_id
       where g.id = agreements.group_id
         and public.can_create_agreements_for_client(g.client_id)
    )
  );