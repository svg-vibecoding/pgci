CREATE OR REPLACE FUNCTION public._validate_client_codes(p_agreement_id uuid, p_codes jsonb, p_position_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
-- NOTA DE MANTENIMIENTO:
-- La rama "sin cambios" compara el código entrante y la descripción entrante
-- contra lo vigente hoy en (p_position_id, client_id). Hoy _resolve_client_code
-- solo escribe client_code y description; si en el futuro _resolve_client_code
-- persiste campos adicionales para el par (posición, cliente), esos campos
-- DEBEN sumarse a esta comparación. De lo contrario, podrían modificarse sin
-- exigir can_manage_client_catalog sobre el cliente afectado.
declare
  v_norm jsonb;
  v_client_id uuid;
  v_in_code text;
  v_in_desc text;
  v_cur_code text;
  v_cur_desc text;
  v_unchanged boolean;
  r jsonb;
begin
  select coalesce(jsonb_agg(e), '[]'::jsonb) into v_norm
    from jsonb_array_elements(coalesce(p_codes, '[]'::jsonb)) e
   where nullif(trim(coalesce(e->>'client_code','')),'') is not null
     and (e->>'client_id') is not null;

  if (select count(*) <> count(distinct e->>'client_id') from jsonb_array_elements(v_norm) e) then
    raise exception 'Un mismo cliente aparece dos veces en la lista de códigos' using errcode='23505';
  end if;

  for r in select * from jsonb_array_elements(v_norm) loop
    v_client_id := (r->>'client_id')::uuid;
    if not exists (
      select 1 from public.agreement_companies
       where agreement_id=p_agreement_id and client_id=v_client_id and valid_until is null
    ) then
      raise exception 'El cliente % no está vinculado a este acuerdo', v_client_id using errcode='23503';
    end if;

    v_unchanged := false;
    if p_position_id is not null then
      v_in_code := nullif(trim(coalesce(r->>'client_code','')),'');
      v_in_desc := r->>'description';
      v_cur_code := null;
      v_cur_desc := null;

      select cp.client_code, apcc.client_product_id
        into v_cur_code, v_cur_desc  -- v_cur_desc reused below
        from public.agreement_position_client_codes apcc
        join public.client_products cp on cp.id = apcc.client_product_id
       where apcc.agreement_position_id = p_position_id
         and apcc.client_id = v_client_id
         and apcc.valid_until is null
       limit 1;

      if v_cur_code is not null then
        select cph.description into v_cur_desc
          from public.agreement_position_client_codes apcc
          join public.client_product_history cph on cph.client_product_id = apcc.client_product_id
         where apcc.agreement_position_id = p_position_id
           and apcc.client_id = v_client_id
           and apcc.valid_until is null
           and cph.valid_until is null
         order by cph.valid_from desc
         limit 1;

        if v_cur_code = v_in_code and v_cur_desc is not distinct from v_in_desc then
          v_unchanged := true;
        end if;
      end if;
    end if;

    if not v_unchanged then
      if not public.can_manage_client_catalog(v_client_id) then
        raise exception 'Sin permiso can_manage_client_catalog sobre el cliente %', v_client_id using errcode='42501';
      end if;
    end if;
  end loop;
  return v_norm;
end $function$;

CREATE OR REPLACE FUNCTION public.update_agreement_line(p_line_id uuid, p_kind text, p_patch jsonb, p_confirm_n_conflict boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_agreement_id uuid;
  v_agr_start date; v_agr_end date;
  v_row_pos public.agreement_positions%rowtype;
  v_row_tr  public.agreement_transit_lines%rowtype;
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
  v_eff_start date; v_eff_end date;
  v_promoted_id uuid;
  r jsonb;
begin
  if p_kind not in ('position','transit') then
    raise exception 'p_kind inválido' using errcode='22023';
  end if;
  if p_kind='position' then
    select * into v_row_pos from public.agreement_positions where id=p_line_id;
    if not found then raise exception 'Posición no encontrada' using errcode='P0002'; end if;
    v_agreement_id := v_row_pos.agreement_id;
  else
    select * into v_row_tr from public.agreement_transit_lines where id=p_line_id;
    if not found then raise exception 'Línea en tránsito no encontrada' using errcode='P0002'; end if;
    v_agreement_id := v_row_tr.agreement_id;
  end if;
  if not public.can_admin_agreement(v_agreement_id) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  select start_date, end_date into v_agr_start, v_agr_end
    from public.agreements where id=v_agreement_id;

  if v_has_sku   then v_sku          := nullif(trim(coalesce(p_patch->>'sku','')),''); end if;
  if v_has_price then v_sale_price   := nullif(p_patch->>'sale_price','')::numeric; end if;
  if v_has_par   then v_par_price    := nullif(p_patch->>'par_price','')::numeric; end if;
  if v_has_start then v_start_date   := nullif(p_patch->>'start_date','')::date; end if;
  if v_has_end   then v_end_date     := nullif(p_patch->>'end_date','')::date; end if;
  if v_has_obs   then v_observations := nullif(trim(coalesce(p_patch->>'observations','')),''); end if;

  if v_has_sku then
    if v_sku is null then v_new_product_id := null;
    else
      select id into v_new_product_id from public.products where sku=v_sku limit 1;
      if v_new_product_id is null then
        raise exception 'SKU % no existe en el catálogo', v_sku using errcode='P0002';
      end if;
    end if;
  else
    v_new_product_id := case when p_kind='position' then v_row_pos.product_id else v_row_tr.product_id end;
  end if;

  if v_has_codes then
    v_codes := public._validate_client_codes(
      v_agreement_id,
      p_patch->'client_codes',
      case when p_kind='position' then p_line_id else null end
    );
  end if;

  -- resto del cuerpo sin cambios
  perform public._update_agreement_line_body(p_line_id, p_kind, p_patch, p_confirm_n_conflict, v_codes, v_has_codes, v_has_sku, v_has_price, v_has_par, v_has_start, v_has_end, v_has_obs, v_new_product_id, v_sale_price, v_par_price, v_start_date, v_end_date, v_observations);
  return jsonb_build_object('ok', true);
end $function$;
