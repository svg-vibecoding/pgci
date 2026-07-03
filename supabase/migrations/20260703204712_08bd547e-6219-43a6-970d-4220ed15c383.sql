DROP TRIGGER IF EXISTS prevent_last_group_admin_removal_trigger ON public.agreement_group_members;

CREATE OR REPLACE FUNCTION public.prevent_last_group_admin_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_count int;
begin
  if not exists (select 1 from public.agreement_groups where id = old.agreement_group_id) then
    return old;
  end if;

  if old.role = 'agreement_group_admin'
     and (tg_op = 'DELETE' or (tg_op = 'UPDATE' and new.role <> 'agreement_group_admin')) then
    select count(*) into v_count
      from public.agreement_group_members
     where agreement_group_id = old.agreement_group_id
       and role = 'agreement_group_admin'
       and id <> old.id;
    if v_count = 0 then
      raise exception 'No se puede eliminar el último agreement_group_admin del agrupador.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;