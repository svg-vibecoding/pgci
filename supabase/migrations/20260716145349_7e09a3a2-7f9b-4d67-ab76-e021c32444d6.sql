
CREATE OR REPLACE FUNCTION public.delete_agreement_position(p_position_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_agreement_id uuid;
  v_status text;
begin
  select agreement_id, status
    into v_agreement_id, v_status
    from public.agreement_positions
   where id = p_position_id;

  if v_agreement_id is null then
    raise exception 'Posición no encontrada' using errcode = 'P0002';
  end if;

  if not public.can_admin_agreement(v_agreement_id) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if v_status <> 'draft' then
    raise exception 'Solo se pueden eliminar posiciones en gestión.' using errcode = 'P0001';
  end if;

  -- Los drafts nunca se publicaron ni se excluyeron; borramos por seguridad si
  -- existieran filas huérfanas.
  delete from public.agreement_position_price_history where position_id = p_position_id;
  delete from public.agreement_position_exclusions where position_id = p_position_id;

  -- La relación con el acuerdo se borra. El trigger AFTER DELETE
  -- recalc_sku_conflict_trg_codes se dispara y libera los códigos para RN-MATCH-01.
  delete from public.agreement_position_client_codes where agreement_position_id = p_position_id;

  delete from public.agreement_positions where id = p_position_id;
end;
$$;

REVOKE ALL ON FUNCTION public.delete_agreement_position(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_agreement_position(uuid) TO authenticated;
