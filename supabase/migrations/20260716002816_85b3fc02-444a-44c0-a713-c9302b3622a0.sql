
-- 1) Revertir guards P0001 en create_agreement_line
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
    case when v_eff_start is null or v_eff_end is null or v_eff_end < current_date then 'no_valid_window' end
  ], null), ','), '');

  insert into public.agreement_positions
    (agreement_id, product_id, sale_price, par_price, start_date, end_date,
     observations, status, pending_reason, created_by, updated_by)
  values
    (p_agreement_id, v_product_id, v_sale_price, v_par_price, v_start_date, v_end_date,
     v_observations, 'draft', v_pending_reason, v_user, v_user)
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

  return jsonb_build_object('position_id', v_line_id);
end;
$function$;

-- 2) Revertir guards P0001 en update_agreement_line
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
    update public.agreement_position_client_codes
       set valid_until = now(), ended_by = v_user, ended_reason = 'Cambio de SKU en la posición'
     where agreement_position_id = p_line_id and valid_until is null;
  end if;

  if v_has_codes then
    select coalesce(array_agg((e->>'client_id')::uuid), '{}') into v_desired_ids
      from jsonb_array_elements(v_codes) e;

    update public.agreement_position_client_codes
       set valid_until = now(), ended_by = v_user, ended_reason = 'Retirado del diff'
     where agreement_position_id = p_line_id and valid_until is null
       and client_id <> all (v_desired_ids);

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
        update public.agreement_position_client_codes
           set valid_until = now(), ended_by = v_user, ended_reason = 'Reemplazo por nuevo código'
         where id = v_open_id;
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

-- 3) Función de recálculo de conflicto de SKU
CREATE OR REPLACE FUNCTION public.recalc_sku_conflict(p_agreement_id uuid, p_product_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  v_total int;
  v_conflict boolean;
  v_new_reason text;
begin
  -- Salvaguarda contra recursión futura
  if pg_trigger_depth() > 3 then
    return;
  end if;
  if p_product_id is null then
    return;
  end if;

  -- Cuenta OCUPANTES (todas las posiciones del SKU, cualquier estado — incluye excluded, §4.6)
  select count(*) into v_total
    from public.agreement_positions
   where agreement_id = p_agreement_id
     and product_id   = p_product_id;

  if v_total < 2 then
    -- Sin conflicto posible: limpiar el token sku_conflict de las posiciones escribibles
    for r in
      select id, pending_reason
        from public.agreement_positions
       where agreement_id = p_agreement_id
         and product_id   = p_product_id
         and status in ('active','draft','requires_review')
         and pending_reason is not null
         and (',' || pending_reason || ',') like '%,sku_conflict,%'
    loop
      v_new_reason := nullif(
        array_to_string(
          array(select t from unnest(string_to_array(r.pending_reason, ',')) t
                 where t <> 'sku_conflict' and t <> ''),
          ','
        ),
        ''
      );
      update public.agreement_positions
         set pending_reason = v_new_reason,
             updated_at     = now()
       where id = r.id
         and pending_reason is distinct from v_new_reason;
    end loop;
    return;
  end if;

  -- Recorre TODAS las posiciones del SKU (incluye excluded para cálculo; no para escritura)
  for r in
    select id, status, pending_reason
      from public.agreement_positions
     where agreement_id = p_agreement_id
       and product_id   = p_product_id
  loop
    select not exists (
      select 1
        from public.agreement_position_client_codes self_c
       where self_c.agreement_position_id = r.id
         and self_c.valid_until is null
         and exists (
           select 1
             from public.agreement_position_client_codes other_c
             join public.agreement_positions other_p
               on other_p.id = other_c.agreement_position_id
            where other_p.agreement_id = p_agreement_id
              and other_p.product_id   = p_product_id
              and other_p.id <> r.id
              and other_c.valid_until is null
              and other_c.client_id    = self_c.client_id
         )
    ) into v_conflict;

    -- Solo se escribe sobre posiciones activas/en gestión/en revisión (nunca excluded/pending)
    if r.status not in ('active','draft','requires_review') then
      continue;
    end if;

    v_new_reason := nullif(
      array_to_string(
        array(select t from unnest(string_to_array(coalesce(r.pending_reason,''), ',')) t
               where t <> 'sku_conflict' and t <> ''),
        ','
      ),
      ''
    );
    if v_conflict then
      v_new_reason := case
        when v_new_reason is null or v_new_reason = '' then 'sku_conflict'
        else v_new_reason || ',sku_conflict'
      end;
    end if;

    if v_conflict then
      -- En conflicto: forzar requires_review + pending_reason con sku_conflict
      update public.agreement_positions
         set status         = 'requires_review',
             pending_reason = v_new_reason,
             updated_at     = now()
       where id = r.id
         and (status is distinct from 'requires_review'
              or pending_reason is distinct from v_new_reason);
    else
      -- Sin conflicto: solo limpiar el token; NUNCA promover status a active (recalc no sube)
      update public.agreement_positions
         set pending_reason = v_new_reason,
             updated_at     = now()
       where id = r.id
         and pending_reason is distinct from v_new_reason;
    end if;
  end loop;
end;
$function$;

-- 4) Trigger sobre agreement_position_client_codes
CREATE OR REPLACE FUNCTION public.recalc_sku_conflict_trg_codes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_agreement_id uuid;
  v_product_id uuid;
  v_position_id uuid;
begin
  v_position_id := coalesce(NEW.agreement_position_id, OLD.agreement_position_id);
  select agreement_id, product_id
    into v_agreement_id, v_product_id
    from public.agreement_positions
   where id = v_position_id;
  if v_product_id is not null then
    perform public.recalc_sku_conflict(v_agreement_id, v_product_id);
  end if;
  return null;
end;
$function$;

DROP TRIGGER IF EXISTS trg_apcc_sku_conflict ON public.agreement_position_client_codes;
CREATE TRIGGER trg_apcc_sku_conflict
AFTER INSERT OR UPDATE OR DELETE ON public.agreement_position_client_codes
FOR EACH ROW EXECUTE FUNCTION public.recalc_sku_conflict_trg_codes();

-- 5) Trigger sobre agreement_positions (product_id o cambio hacia/desde excluded)
CREATE OR REPLACE FUNCTION public.recalc_sku_conflict_trg_positions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if TG_OP = 'INSERT' then
    if NEW.product_id is not null then
      perform public.recalc_sku_conflict(NEW.agreement_id, NEW.product_id);
    end if;
    return null;
  end if;

  if TG_OP = 'UPDATE' then
    if OLD.product_id is distinct from NEW.product_id then
      if OLD.product_id is not null then
        perform public.recalc_sku_conflict(OLD.agreement_id, OLD.product_id);
      end if;
      if NEW.product_id is not null then
        perform public.recalc_sku_conflict(NEW.agreement_id, NEW.product_id);
      end if;
    elsif ((OLD.status = 'excluded') is distinct from (NEW.status = 'excluded'))
       and NEW.product_id is not null then
      perform public.recalc_sku_conflict(NEW.agreement_id, NEW.product_id);
    end if;
  end if;
  return null;
end;
$function$;

DROP TRIGGER IF EXISTS trg_ap_sku_conflict ON public.agreement_positions;
CREATE TRIGGER trg_ap_sku_conflict
AFTER INSERT OR UPDATE OF product_id, status ON public.agreement_positions
FOR EACH ROW EXECUTE FUNCTION public.recalc_sku_conflict_trg_positions();

-- 6) publish_positions: agregar token sku_conflict a los motivos
CREATE OR REPLACE FUNCTION public.publish_positions(p_position_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_pos public.agreement_positions%rowtype;
  v_agr_start date;
  v_agr_end date;
  v_eff_start date;
  v_eff_end date;
  v_reason text;
  v_published int := 0;
  v_not_publishable int := 0;
  v_skipped int := 0;
  v_details jsonb := '[]'::jsonb;
  v_last_price numeric;
  v_last_start date;
  v_last_end date;
  v_has_history boolean;
  v_sku_active boolean;
  v_in_conflict boolean;
begin
  if p_position_ids is null then
    return jsonb_build_object(
      'published', 0, 'not_publishable', 0, 'skipped', 0, 'details', '[]'::jsonb
    );
  end if;

  foreach v_id in array p_position_ids loop
    select * into v_pos from public.agreement_positions where id = v_id;
    if not found then
      v_skipped := v_skipped + 1;
      v_details := v_details || jsonb_build_object(
        'position_id', v_id, 'result', 'omitida', 'reason', 'no_encontrada'
      );
      continue;
    end if;

    if not public.can_admin_agreement(v_pos.agreement_id) then
      v_skipped := v_skipped + 1;
      v_details := v_details || jsonb_build_object(
        'position_id', v_id, 'result', 'omitida', 'reason', 'sin_permiso'
      );
      continue;
    end if;

    if v_pos.status not in ('draft', 'requires_review') then
      v_skipped := v_skipped + 1;
      v_details := v_details || jsonb_build_object(
        'position_id', v_id, 'result', 'omitida', 'reason', 'estado_no_publicable'
      );
      continue;
    end if;

    select start_date, end_date into v_agr_start, v_agr_end
      from public.agreements where id = v_pos.agreement_id;

    v_eff_start := coalesce(v_pos.start_date, v_agr_start);
    v_eff_end   := coalesce(v_pos.end_date,   v_agr_end);

    v_sku_active := null;
    if v_pos.product_id is not null then
      select (status = 'active') into v_sku_active
        from public.products where id = v_pos.product_id;
    end if;

    v_in_conflict := false;
    if v_pos.product_id is not null then
      select (
        (select count(*) from public.agreement_positions ap2
          where ap2.agreement_id = v_pos.agreement_id
            and ap2.product_id   = v_pos.product_id) >= 2
        and not exists (
          select 1
            from public.agreement_position_client_codes self_c
           where self_c.agreement_position_id = v_id
             and self_c.valid_until is null
             and exists (
               select 1
                 from public.agreement_position_client_codes other_c
                 join public.agreement_positions other_p on other_p.id = other_c.agreement_position_id
                where other_p.agreement_id = v_pos.agreement_id
                  and other_p.product_id   = v_pos.product_id
                  and other_p.id <> v_id
                  and other_c.valid_until is null
                  and other_c.client_id    = self_c.client_id
             )
        )
      ) into v_in_conflict;
    end if;

    v_reason := nullif(array_to_string(array_remove(array[
      case when v_pos.product_id is null then 'no_sku' end,
      case when v_pos.product_id is not null and coalesce(v_sku_active, false) is not true then 'sku_inactive' end,
      case when v_in_conflict then 'sku_conflict' end,
      case when v_pos.sale_price is null or v_pos.sale_price <= 0 then 'no_price' end,
      case when v_eff_start is null or v_eff_end is null then 'no_dates' end,
      case when v_eff_end is not null and v_eff_end < current_date then 'expired' end
    ], null), ','), '');

    if v_reason is not null then
      update public.agreement_positions
         set pending_reason = v_reason,
             updated_by = v_user
       where id = v_id;
      v_not_publishable := v_not_publishable + 1;
      v_details := v_details || jsonb_build_object(
        'position_id', v_id, 'result', 'no_publicable', 'reason', v_reason
      );
      continue;
    end if;

    update public.agreement_positions
       set status = 'active',
           published_at = now(),
           published_by = v_user,
           updated_by = v_user,
           pending_reason = null
     where id = v_id;

    select sale_price, start_date, end_date
      into v_last_price, v_last_start, v_last_end
      from public.agreement_position_price_history
     where position_id = v_id
     order by recorded_at desc
     limit 1;

    v_has_history := found;

    if not v_has_history then
      insert into public.agreement_position_price_history (
        position_id, sale_price, start_date, end_date, recorded_by, change_reason
      ) values (
        v_id, v_pos.sale_price, v_eff_start, v_eff_end, v_user, 'initial'
      );
    elsif v_last_price is distinct from v_pos.sale_price
       or v_last_start is distinct from v_eff_start
       or v_last_end   is distinct from v_eff_end then
      insert into public.agreement_position_price_history (
        position_id, sale_price, start_date, end_date, recorded_by, change_reason
      ) values (
        v_id, v_pos.sale_price, v_eff_start, v_eff_end, v_user, 'reactivation'
      );
    end if;

    v_published := v_published + 1;
    v_details := v_details || jsonb_build_object(
      'position_id', v_id, 'result', 'publicada', 'reason', null
    );
  end loop;

  return jsonb_build_object(
    'published', v_published,
    'not_publishable', v_not_publishable,
    'skipped', v_skipped,
    'details', v_details
  );
end
$function$;

-- 7) Backfill: aplicar recálculo a todos los pares (acuerdo, sku) con 2+ posiciones
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT agreement_id, product_id
      FROM public.agreement_positions
     WHERE product_id IS NOT NULL
     GROUP BY agreement_id, product_id
    HAVING count(*) >= 2
  LOOP
    PERFORM public.recalc_sku_conflict(r.agreement_id, r.product_id);
  END LOOP;
END $$;
