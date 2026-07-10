CREATE OR REPLACE FUNCTION public.create_agreement_line(p_agreement_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_agr_start date; v_agr_end date;
  v_sku text; v_product_id uuid;
  v_description text;
  v_sale_price numeric; v_par_price numeric;
  v_start_date date; v_end_date date;
  v_eff_start date; v_eff_end date;
  v_observations text;
  v_codes jsonb;
  v_line_id uuid;
  v_cp uuid; v_match uuid;
  v_conflict_pos uuid; v_conflict_sku text;
  v_client_id uuid; v_client_code text; v_row_desc text;
  v_pending_reason text;
  r jsonb;
begin
  if not public.can_admin_agreement(p_agreement_id) then
    raise exception 'Forbidden' using errcode='42501';
  end if;

  select start_date, end_date into v_agr_start, v_agr_end
    from public.agreements where id = p_agreement_id;

  v_sku          := nullif(trim(coalesce(p_payload->>'sku','')),'');
  v_description  := nullif(trim(coalesce(p_payload->>'description','')),'');
  v_sale_price   := nullif(p_payload->>'sale_price','')::numeric;
  v_par_price    := nullif(p_payload->>'par_price','')::numeric;
  v_start_date   := nullif(p_payload->>'start_date','')::date;
  v_end_date     := nullif(p_payload->>'end_date','')::date;
  v_observations := nullif(trim(coalesce(p_payload->>'observations','')),'');

  v_codes := public._validate_client_codes(p_agreement_id, p_payload->'client_codes', null);

  if v_sku is null and v_description is null and jsonb_array_length(v_codes) = 0 then
    raise exception 'La línea no tiene nada que capturar: falta SKU, descripción o al menos un código de cliente válido'
      using errcode='23514';
  end if;

  if v_sku is not null then
    select id into v_product_id from public.products where sku = v_sku limit 1;
    if v_product_id is null then
      raise exception 'SKU % no existe en el catálogo', v_sku using errcode='P0002';
    end if;
  end if;

  v_eff_start := coalesce(v_start_date, v_agr_start);
  v_eff_end   := coalesce(v_end_date,   v_agr_end);

  v_pending_reason := nullif(array_to_string(array_remove(array[
    case when v_product_id is null then 'no_sku' end,
    case when v_sale_price is null or v_sale_price <= 0 then 'no_price' end,
    case when v_eff_start is null or v_eff_end is null then 'no_dates' end
  ], null), ','), '');

  if v_product_id is not null then
    for r in select * from jsonb_array_elements(v_codes) loop
      v_client_id   := (r->>'client_id')::uuid;
      v_client_code := trim(r->>'client_code');
      select id into v_cp from public.client_products
       where client_id = v_client_id and client_code = v_client_code;
      if v_cp is not null then
        v_conflict_pos := null; v_conflict_sku := null;
        select apcc.agreement_position_id, p.sku
          into v_conflict_pos, v_conflict_sku
          from public.agreement_position_client_codes apcc
          join public.agreement_positions ap on ap.id = apcc.agreement_position_id
          left join public.products p on p.id = ap.product_id
         where apcc.agreement_id = p_agreement_id
           and apcc.client_product_id = v_cp
           and apcc.valid_until is null;
        if v_conflict_pos is not null then
          raise exception 'El código % (cliente %) ya está fijado al SKU % en otra posición del acuerdo (RN-MATCH-01)',
            v_client_code, v_client_id, coalesce(v_conflict_sku,'<sin SKU>') using errcode='23505';
        end if;
      end if;
    end loop;
  end if;

  insert into public.agreement_positions
    (agreement_id, product_id, sale_price, par_price, start_date, end_date,
     observations, sku_raw, description, pending_reason, status, created_by, updated_by)
  values
    (p_agreement_id, v_product_id, v_sale_price, v_par_price, v_start_date, v_end_date,
     v_observations, v_sku, v_description, v_pending_reason, 'draft', v_user, v_user)
  returning id into v_line_id;

  for r in select * from jsonb_array_elements(v_codes) loop
    v_client_id   := (r->>'client_id')::uuid;
    v_client_code := trim(r->>'client_code');
    v_row_desc    := nullif(trim(coalesce(r->>'description','')),'');
    select client_product_id, client_product_match_id into v_cp, v_match
      from public._resolve_client_code(v_client_id, v_client_code, v_row_desc,
                                       v_product_id, 'agreement', null, p_agreement_id);
    insert into public.agreement_position_client_codes
      (agreement_position_id, agreement_id, client_id, client_product_id,
       client_product_match_id, started_by)
    values (v_line_id, p_agreement_id, v_client_id, v_cp, v_match, v_user);
  end loop;

  return jsonb_build_object('line_id', v_line_id, 'kind', 'position');
end $function$;