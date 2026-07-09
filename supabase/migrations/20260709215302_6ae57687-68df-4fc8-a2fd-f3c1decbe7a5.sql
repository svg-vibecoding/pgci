CREATE OR REPLACE FUNCTION public.exclude_agreement_position(p_position_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_agreement_id uuid;
begin
  select agreement_id into v_agreement_id
    from public.agreement_positions where id=p_position_id;
  if v_agreement_id is null then
    raise exception 'Posición no encontrada' using errcode='P0002';
  end if;
  if not public.can_admin_agreement(v_agreement_id) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  update public.agreement_positions set status='excluded'
   where id=p_position_id and status<>'excluded';
  insert into public.agreement_position_exclusions
    (position_id, exclusion_reason, started_by)
  values (p_position_id, coalesce(p_reason,''), auth.uid())
  on conflict (position_id) where valid_until is null do nothing;
end $function$;

CREATE OR REPLACE FUNCTION public.reactivate_agreement_position(p_position_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_agreement_id uuid;
begin
  select agreement_id into v_agreement_id
    from public.agreement_positions where id=p_position_id;
  if v_agreement_id is null then
    raise exception 'Posición no encontrada' using errcode='P0002';
  end if;
  if not public.can_admin_agreement(v_agreement_id) then
    raise exception 'Forbidden' using errcode='42501';
  end if;

  update public.agreement_position_exclusions
     set valid_until=now(), ended_by=auth.uid(), ended_reason=p_reason
   where position_id=p_position_id and valid_until is null;

  update public.agreement_positions set status='active'
   where id=p_position_id and status='excluded';
end $function$;