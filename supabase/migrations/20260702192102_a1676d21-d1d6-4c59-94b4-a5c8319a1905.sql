
-- Fix infinite recursion on agreement_group_members RLS by using SECURITY DEFINER helpers

create or replace function public.is_agreement_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.agreement_group_members
     where agreement_group_id = p_group_id and user_id = p_user_id
  );
$$;

create or replace function public.is_agreement_group_admin(p_group_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.agreement_group_members
     where agreement_group_id = p_group_id
       and user_id = p_user_id
       and role = 'agreement_group_admin'
  );
$$;

-- agreement_group_members policies
drop policy if exists agm_select on public.agreement_group_members;
drop policy if exists agm_insert on public.agreement_group_members;
drop policy if exists agm_update on public.agreement_group_members;
drop policy if exists agm_delete on public.agreement_group_members;

create policy agm_select on public.agreement_group_members
for select to authenticated
using (
  public.is_super_admin()
  or user_id = auth.uid()
  or public.is_agreement_group_member(agreement_group_id, auth.uid())
  or exists (
    select 1 from public.agreements a
     where a.group_id = agreement_group_members.agreement_group_id
       and public.can_access_agreement(a.id)
  )
);

create policy agm_insert on public.agreement_group_members
for insert to authenticated
with check (
  public.is_super_admin()
  or public.is_agreement_group_admin(agreement_group_id, auth.uid())
);

create policy agm_update on public.agreement_group_members
for update to authenticated
using (
  public.is_super_admin()
  or public.is_agreement_group_admin(agreement_group_id, auth.uid())
)
with check (
  public.is_super_admin()
  or public.is_agreement_group_admin(agreement_group_id, auth.uid())
);

create policy agm_delete on public.agreement_group_members
for delete to authenticated
using (
  public.is_super_admin()
  or public.is_agreement_group_admin(agreement_group_id, auth.uid())
);

-- agreement_groups policies also reference agreement_group_members inline; route through helpers
drop policy if exists ag_select on public.agreement_groups;
drop policy if exists ag_update on public.agreement_groups;

create policy ag_select on public.agreement_groups
for select to authenticated
using (
  public.is_super_admin()
  or public.is_agreement_group_member(id, auth.uid())
  or exists (
    select 1 from public.agreements a
     where a.group_id = agreement_groups.id
       and public.can_access_agreement(a.id)
  )
);

create policy ag_update on public.agreement_groups
for update to authenticated
using (
  public.is_super_admin()
  or public.is_agreement_group_admin(id, auth.uid())
)
with check (
  public.is_super_admin()
  or public.is_agreement_group_admin(id, auth.uid())
);
