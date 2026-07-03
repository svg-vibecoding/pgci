-- Fix: prevent_last_agreement_admin_removal
-- Distinguish cascade (parent gone) from manual member removal.
create or replace function public.prevent_last_agreement_admin_removal()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  admin_count integer;
begin
  -- If the parent agreement is being deleted (CASCADE), allow member removal.
  if tg_op = 'DELETE'
     and not exists (select 1 from public.agreements where id = old.agreement_id) then
    return old;
  end if;

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
$function$;

-- Fix: prevent_last_group_admin_removal
-- Distinguish cascade (parent group gone) from manual member removal.
create or replace function public.prevent_last_group_admin_removal()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count int;
begin
  -- If the parent group is being deleted (CASCADE), allow member removal.
  if not exists (select 1 from public.agreement_groups where id = old.agreement_group_id) then
    return old;
  end if;

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
$function$;