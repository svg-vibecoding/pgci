CREATE OR REPLACE FUNCTION public.update_agreement_line(p_line_id uuid, p_patch jsonb, p_confirm_n_conflict boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_agreement_id uuid;
  v_row_pos public.agreement_positions%rowtype;
  v_is_draft boolean;
  v_has_sku    boolean := p_patch ? 'sku';
  v_has_price  boolean := p_patch ? 'sale_price';
  v_has_par    boolean := p_patch ? 'par_price';
  v_has_start  boolean := p_patch ? 'start_date';
  v_has_end    boolean := p_patch ? 'end_date';
  v_has_obs    boolean := p_patch ? 'observations';
  v_has_codes  boolean := p_patch ? 'client_codes';
  v_sku text; v_new_product_id uuid;
  v_sale_price numeric; v_par_price numeric;
  v_start_date date; v_end_date date;
  v_observations text;
  v_codes jsonb;
  v_desired_ids uuid[];
  v_client_id uuid; v_client_code text; v_row_desc text;
  v_cp uuid; v_match uuid;
  v_open_id uuid; v_open_cp uuid;
  v_conflict_pos uuid; v_conflict_sku text;
  r jsonb;
begin
  select * into v_row_pos from public.agreement_positions where id = p_line_id;
  if not found then
    raise exception 'Posición no encontrada' using errcode = 'P0002';
  end if;
  v_agreement_id := v_row_pos.agreement_id;
  v_is_draft := v_row_pos.published_at is null;

  if not public.can_admin_agreement(v_agreement_id) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if v_has_sku   then v_sku          := nullif(trim(coalesce(p_patch->>'sku','')),''); end if;
  if v_has_price then v_sale_price   := nullif(p_patch->>'sale_price','')::numeric; end if;
  if v_has_par   then v_par_price    := nullif(p_patch->>'par_price','')::numeric; end if;
  if v_has_start then v_start_date   := nullif(p_patch->>'start_date','')::date; end if;
  if v_has_end   then v_end_date     := nullif(p_patch->>'end_date','')::date; end if;
  if v_has_obs   then v_observations := nullif(trim(coalesce(p_patch->>'observations','')),''); end if;

  if v_has_sku then
    if v_sku is null then
      v_new_product_id := null;
    else
      select id into v_new_product_id from public.products where sku = v_sku limit 1;
      if v_new_product_id is null then
        raise exception 'SKU % no existe en el catálogo', v_sku using errcode = 'P0002';
      end if;
    end if;
  else
    v_new_product_id := v_row_pos.product_id;
  end if;

  if v_has_codes then
    v_codes := public._validate_client_codes(
      v_agreement_id,
      p_patch->'client_codes',
      p_line_id
    );
  end if;

  update public.agreement_positions set
    product_id   = case when v_has_sku   then v_new_product_id else product_id end,
    sale_price   = case when v_has_price then v_sale_price     else sale_price end,
    par_price    = case when v_has_par   then v_par_price      else par_price end,
    start_date   = case when v_has_start then v_start_date     else start_date end,
    end_date     = case when v_has_end   then v_end_date       else end_date end,
    observations = case when v_has_obs   then v_observations   else observations end,
    updated_by   = v_user
  where id = p_line_id;

  if v_has_sku and v_new_product_id is distinct from v_row_pos.product_id then
    if not v_has_codes then
      select coalesce(jsonb_agg(jsonb_build_object(
               'client_id', apcc.client_id,
               'client_code', cp.client_code,
               'description', null)), '[]'::jsonb)
        into v_codes
        from public.agreement_position_client_codes apcc
        join public.client_products cp on cp.id = apcc.client_product_id
       where apcc.agreement_position_id = p_line_id and apcc.valid_until is null;
      v_has_codes := true;
    end if;
    -- Cambio de SKU: preserva comportamiento actual (cerrar; en drafts esto
    -- queda para el flujo R-09; el reemplazo de apcc por SKU no es alcance).
    update public.agreement_position_client_codes
       set valid_until = now(), ended_by = v_user, ended_reason = 'Cambio de SKU en la posición'
     where agreement_position_id = p_line_id and valid_until is null;
  end if;

  if v_has_codes then
    select coalesce(array_agg((e->>'client_id')::uuid), '{}') into v_desired_ids
      from jsonb_array_elements(v_codes) e;

    -- Diff declarativo: los clientes ausentes se retiran de la posición.
    --   · Publicada → CERRAR el período (queda como historia).
    --   · Draft     → BORRAR la fila (un draft no historiza).
    if v_is_draft then
      delete from public.agreement_position_client_codes
       where agreement_position_id = p_line_id and valid_until is null
         and client_id <> all (v_desired_ids);
    else
      update public.agreement_position_client_codes
         set valid_until = now(), ended_by = v_user, ended_reason = 'Retirado del diff'
       where agreement_position_id = p_line_id and valid_until is null
         and client_id <> all (v_desired_ids);
    end if;

    for r in select * from jsonb_array_elements(v_codes) loop
      v_client_id   := (r->>'client_id')::uuid;
      v_client_code := trim(r->>'client_code');
      v_row_desc    := nullif(trim(coalesce(r->>'description','')),'');
      select client_product_id, client_product_match_id into v_cp, v_match
        from public._resolve_client_code(v_client_id, v_client_code, v_row_desc,
                                         v_new_product_id, 'agreement', null, v_agreement_id);

      v_open_id := null; v_open_cp := null;
      select apcc.id, apcc.client_product_id into v_open_id, v_open_cp
        from public.agreement_position_client_codes apcc
       where apcc.agreement_position_id = p_line_id
         and apcc.client_id = v_client_id
         and apcc.valid_until is null;

      if v_open_id is not null and v_open_cp = v_cp then
        continue;
      end if;
      if v_open_id is not null then
        -- Reemplazo de código: en drafts borra la fila abierta; en publicadas
        -- cierra el período para preservar historia.
        if v_is_draft then
          delete from public.agreement_position_client_codes where id = v_open_id;
        else
          update public.agreement_position_client_codes
             set valid_until = now(), ended_by = v_user, ended_reason = 'Reemplazo por nuevo código'
           where id = v_open_id;
        end if;
      end if;

      v_conflict_pos := null; v_conflict_sku := null;
      select apcc.agreement_position_id, p.sku
        into v_conflict_pos, v_conflict_sku
        from public.agreement_position_client_codes apcc
        join public.agreement_positions ap on ap.id = apcc.agreement_position_id
        left join public.products p on p.id = ap.product_id
       where apcc.agreement_id = v_agreement_id
         and apcc.client_product_id = v_cp
         and apcc.valid_until is null
         and apcc.agreement_position_id <> p_line_id;
      if v_conflict_pos is not null then
        raise exception 'El código % (cliente %) ya está fijado al SKU % en otra posición del acuerdo (RN-MATCH-01)',
          v_client_code, v_client_id, coalesce(v_conflict_sku, '<sin SKU>') using errcode = '23505';
      end if;

      insert into public.agreement_position_client_codes
        (agreement_position_id, agreement_id, client_id, client_product_id,
         client_product_match_id, started_by)
      values (p_line_id, v_agreement_id, v_client_id, v_cp, v_match, v_user);
    end loop;
  end if;

  return jsonb_build_object('position_id', p_line_id);
end;
$function$;