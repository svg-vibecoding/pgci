CREATE OR REPLACE FUNCTION public.compute_position_pending_reason(
  p_position_id  uuid,
  p_agreement_id uuid,
  p_product_id   uuid,
  p_sale_price   numeric,
  p_start_date   date,
  p_end_date     date
) RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_agr_start date; v_agr_end date;
  v_eff_start date; v_eff_end date;
  v_sku_active boolean;
  v_tokens text[] := ARRAY[]::text[];
begin
  select start_date, end_date into v_agr_start, v_agr_end
    from public.agreements where id = p_agreement_id;
  v_eff_start := coalesce(p_start_date, v_agr_start);
  v_eff_end   := coalesce(p_end_date,   v_agr_end);

  if p_product_id is null then
    v_tokens := array_append(v_tokens, 'no_sku');
  else
    select (status = 'active') into v_sku_active
      from public.products where id = p_product_id;
    if v_sku_active is distinct from true then
      v_tokens := array_append(v_tokens, 'sku_inactive');
    end if;
    if p_position_id is not null and public.position_has_sku_conflict(p_position_id) then
      v_tokens := array_append(v_tokens, 'sku_conflict');
    end if;
  end if;

  if p_sale_price is null or p_sale_price <= 0 then
    v_tokens := array_append(v_tokens, 'no_price');
  end if;

  if v_eff_start is null or v_eff_end is null then
    v_tokens := array_append(v_tokens, 'no_dates');
  elsif v_eff_end < current_date then
    v_tokens := array_append(v_tokens, 'expired');
  end if;

  return nullif(array_to_string(v_tokens, ','), '');
end $$;

CREATE OR REPLACE FUNCTION public.compute_position_pending_reason(p_position_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select public.compute_position_pending_reason(
    ap.id, ap.agreement_id, ap.product_id, ap.sale_price, ap.start_date, ap.end_date
  )
  from public.agreement_positions ap
  where ap.id = p_position_id;
$$;

CREATE OR REPLACE FUNCTION public.recalc_agreement_position_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_reason text;
begin
  if TG_OP = 'INSERT' then
    return new;
  end if;

  if new.status not in ('active','draft','requires_review') then
    return new;
  end if;

  v_reason := public.compute_position_pending_reason(
    new.id, new.agreement_id, new.product_id,
    new.sale_price, new.start_date, new.end_date
  );

  new.pending_reason := v_reason;

  if new.status = 'active' and v_reason is not null then
    new.status := 'requires_review';
  end if;

  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.publish_positions(p_position_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_pos public.agreement_positions%rowtype;
  v_agr_start date; v_agr_end date;
  v_eff_start date; v_eff_end date;
  v_reason text;
  v_published int := 0;
  v_not_publishable int := 0;
  v_skipped int := 0;
  v_details jsonb := '[]'::jsonb;
  v_last_price numeric; v_last_start date; v_last_end date;
  v_has_history boolean;
begin
  if p_position_ids is null then
    return jsonb_build_object('published',0,'not_publishable',0,'skipped',0,'details','[]'::jsonb);
  end if;

  foreach v_id in array p_position_ids loop
    select * into v_pos from public.agreement_positions where id = v_id;
    if not found then
      v_skipped := v_skipped + 1;
      v_details := v_details || jsonb_build_object('position_id',v_id,'result','omitida','reason','no_encontrada');
      continue;
    end if;

    if not public.can_admin_agreement(v_pos.agreement_id) then
      v_skipped := v_skipped + 1;
      v_details := v_details || jsonb_build_object('position_id',v_id,'result','omitida','reason','sin_permiso');
      continue;
    end if;

    if v_pos.status not in ('draft', 'requires_review') then
      v_skipped := v_skipped + 1;
      v_details := v_details || jsonb_build_object('position_id',v_id,'result','omitida','reason','estado_no_publicable');
      continue;
    end if;

    v_reason := public.compute_position_pending_reason(
      v_pos.id, v_pos.agreement_id, v_pos.product_id,
      v_pos.sale_price, v_pos.start_date, v_pos.end_date
    );

    if v_reason is not null then
      update public.agreement_positions
         set pending_reason = v_reason, updated_by = v_user
       where id = v_id;
      v_not_publishable := v_not_publishable + 1;
      v_details := v_details || jsonb_build_object('position_id',v_id,'result','no_publicable','reason',v_reason);
      continue;
    end if;

    select start_date, end_date into v_agr_start, v_agr_end
      from public.agreements where id = v_pos.agreement_id;
    v_eff_start := coalesce(v_pos.start_date, v_agr_start);
    v_eff_end   := coalesce(v_pos.end_date,   v_agr_end);

    update public.agreement_positions
       set status='active', published_at=now(), published_by=v_user,
           updated_by=v_user, pending_reason=null
     where id = v_id;

    select sale_price, start_date, end_date
      into v_last_price, v_last_start, v_last_end
      from public.agreement_position_price_history
     where position_id = v_id
     order by recorded_at desc limit 1;
    v_has_history := found;

    if not v_has_history then
      insert into public.agreement_position_price_history
        (position_id, sale_price, start_date, end_date, recorded_by, change_reason)
      values (v_id, v_pos.sale_price, v_eff_start, v_eff_end, v_user, 'initial');
    elsif v_last_price is distinct from v_pos.sale_price
       or v_last_start is distinct from v_eff_start
       or v_last_end   is distinct from v_eff_end then
      insert into public.agreement_position_price_history
        (position_id, sale_price, start_date, end_date, recorded_by, change_reason)
      values (v_id, v_pos.sale_price, v_eff_start, v_eff_end, v_user, 'reactivation');
    end if;

    v_published := v_published + 1;
    v_details := v_details || jsonb_build_object('position_id',v_id,'result','publicada','reason',null);
  end loop;

  return jsonb_build_object(
    'published', v_published, 'not_publishable', v_not_publishable,
    'skipped', v_skipped, 'details', v_details
  );
end
$$;

CREATE OR REPLACE FUNCTION public.create_agreement_line(p_agreement_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_user uuid := auth.uid();
  v_sku text; v_product_id uuid;
  v_description text;
  v_sale_price numeric; v_par_price numeric;
  v_start_date date; v_end_date date;
  v_observations text;
  v_codes jsonb;
  v_line_id uuid;
  v_cp uuid; v_match uuid;
  v_conflict_pos uuid; v_conflict_sku text;
  v_client_id uuid; v_client_code text; v_row_desc text;
  r jsonb;
begin
  if not public.can_admin_agreement(p_agreement_id) then
    raise exception 'Forbidden' using errcode='42501';
  end if;

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

  insert into public.agreement_positions
    (agreement_id, product_id, sale_price, par_price, start_date, end_date,
     observations, status, pending_reason, created_by, updated_by)
  values
    (p_agreement_id, v_product_id, v_sale_price, v_par_price, v_start_date, v_end_date,
     v_observations, 'draft', null, v_user, v_user)
  returning id into v_line_id;

  for r in select * from jsonb_array_elements(v_codes) loop
    v_client_id   := (r->>'client_id')::uuid;
    v_client_code := trim(r->>'client_code');
    v_row_desc    := nullif(trim(coalesce(r->>'description','')),'');
    select client_product_id, client_product_match_id into v_cp, v_match
      from public._resolve_client_code(v_client_id, v_client_code, v_row_desc,
                                       v_product_id, 'agreement', null, p_agreement_id);

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
        v_client_code, v_client_id, coalesce(v_conflict_sku, '<sin SKU>') using errcode = '23505';
    end if;

    insert into public.agreement_position_client_codes
      (agreement_position_id, agreement_id, client_id, client_product_id,
       client_product_match_id, started_by)
    values (v_line_id, p_agreement_id, v_client_id, v_cp, v_match, v_user);
  end loop;

  update public.agreement_positions
     set pending_reason = public.compute_position_pending_reason(v_line_id)
   where id = v_line_id;

  return jsonb_build_object('position_id', v_line_id);
end;
$$;

CREATE OR REPLACE FUNCTION public.recalc_sku_conflict(p_agreement_id uuid, p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  r record;
  v_new_reason text;
  v_has_conflict boolean;
begin
  if pg_trigger_depth() > 3 then return; end if;
  if p_product_id is null then return; end if;

  for r in
    select id, status, pending_reason, published_at
      from public.agreement_positions
     where agreement_id = p_agreement_id
       and product_id   = p_product_id
       and status in ('active','draft','requires_review')
  loop
    v_new_reason := public.compute_position_pending_reason(r.id);
    v_has_conflict := v_new_reason is not null
                      and 'sku_conflict' = any(string_to_array(v_new_reason, ','));

    if v_has_conflict and r.published_at is not null then
      update public.agreement_positions
         set status         = 'requires_review',
             pending_reason = v_new_reason,
             updated_at     = now()
       where id = r.id
         and (status is distinct from 'requires_review'
              or pending_reason is distinct from v_new_reason);
    else
      update public.agreement_positions
         set pending_reason = v_new_reason,
             updated_at     = now()
       where id = r.id
         and pending_reason is distinct from v_new_reason;
    end if;
  end loop;
end;
$$;

UPDATE public.agreement_positions
   SET pending_reason = public.compute_position_pending_reason(id)
 WHERE status IN ('active','draft','requires_review');
