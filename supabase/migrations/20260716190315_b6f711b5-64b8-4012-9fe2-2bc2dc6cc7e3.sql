-- 1) Nuevas columnas en historial de precios
ALTER TABLE public.agreement_position_price_history
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id),
  ADD COLUMN IF NOT EXISTS sku_change_kind text
    CHECK (sku_change_kind IN ('sku_changed','sku_corrected')),
  ADD COLUMN IF NOT EXISTS sku_change_note text;

-- 2) Etiqueta en códigos cerrados por cambio de SKU
ALTER TABLE public.agreement_position_client_codes
  ADD COLUMN IF NOT EXISTS sku_change_kind text
    CHECK (sku_change_kind IN ('sku_changed','sku_corrected'));

-- 3) Backfill product_id en filas existentes (verificado: nunca hubo cambios de SKU)
UPDATE public.agreement_position_price_history ph
   SET product_id = ap.product_id
  FROM public.agreement_positions ap
 WHERE ph.position_id = ap.id
   AND ph.product_id IS NULL;

-- 4) Trigger: no disparar cuando además cambia el SKU (la RPC escribe el corte)
CREATE OR REPLACE FUNCTION public.log_agreement_position_price_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Corte por cambio de SKU: lo escribe update_agreement_line (cierre + apertura
  -- etiquetados con product_id y sku_change_kind). Este trigger debe cederle el
  -- paso; si no, se insertaría una tercera fila sin product_id ni etiqueta
  -- cuando el usuario cambia SKU y precio a la vez.
  IF TG_OP = 'UPDATE' AND NEW.product_id IS DISTINCT FROM OLD.product_id THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'active' AND NEW.status = 'active' AND (
        NEW.sale_price IS DISTINCT FROM OLD.sale_price
     OR NEW.start_date IS DISTINCT FROM OLD.start_date
     OR NEW.end_date IS DISTINCT FROM OLD.end_date
  ) THEN
    INSERT INTO public.agreement_position_price_history (
      position_id, product_id, sale_price, start_date, end_date, recorded_by, change_reason
    ) VALUES (
      NEW.id, NEW.product_id, NEW.sale_price, NEW.start_date, NEW.end_date, auth.uid(), NULL
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- 5) publish_positions: escribir product_id en las filas 'initial' y 'reactivation'
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
        (position_id, product_id, sale_price, start_date, end_date, recorded_by, change_reason)
      values (v_id, v_pos.product_id, v_pos.sale_price, v_eff_start, v_eff_end, v_user, 'initial');
    elsif v_last_price is distinct from v_pos.sale_price
       or v_last_start is distinct from v_eff_start
       or v_last_end   is distinct from v_eff_end then
      insert into public.agreement_position_price_history
        (position_id, product_id, sale_price, start_date, end_date, recorded_by, change_reason)
      values (v_id, v_pos.product_id, v_pos.sale_price, v_eff_start, v_eff_end, v_user, 'reactivation');
    end if;

    v_published := v_published + 1;
    v_details := v_details || jsonb_build_object('position_id',v_id,'result','publicada','reason',null);
  end loop;

  return jsonb_build_object(
    'published', v_published, 'not_publishable', v_not_publishable,
    'skipped', v_skipped, 'details', v_details
  );
end
$function$;

-- 6) update_agreement_line: exigir etiqueta, cerrar + abrir tramo de precio
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
  v_is_published boolean;
  v_sku_actually_changed boolean := false;
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
  v_sku_change_kind text;
  v_sku_change_note text;
  v_new_price numeric; v_new_start date; v_new_end date;
  r jsonb;
begin
  select * into v_row_pos from public.agreement_positions where id = p_line_id;
  if not found then
    raise exception 'Posición no encontrada' using errcode = 'P0002';
  end if;
  v_agreement_id := v_row_pos.agreement_id;
  v_is_draft := v_row_pos.published_at is null;
  v_is_published := not v_is_draft;

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

  v_sku_actually_changed := v_has_sku
    and v_new_product_id is distinct from v_row_pos.product_id;

  -- R-09: si el SKU realmente cambia en una posición publicada, exigir etiqueta
  -- parseable y nota si es corrección. En drafts el cambio es edición normal.
  v_sku_change_kind := nullif(trim(coalesce(p_patch->>'sku_change_kind','')),'');
  v_sku_change_note := nullif(trim(coalesce(p_patch->>'sku_change_note','')),'');
  if v_sku_actually_changed and v_is_published then
    if v_sku_change_kind is null
       or v_sku_change_kind not in ('sku_changed','sku_corrected') then
      raise exception 'Debes indicar si el cambio de SKU es un cambio real o una corrección'
        using errcode = '22023';
    end if;
    if v_sku_change_kind = 'sku_corrected' and v_sku_change_note is null then
      raise exception 'La corrección de SKU exige una nota que explique el motivo'
        using errcode = '22023';
    end if;
  else
    -- Ignorar etiqueta/nota cuando no aplica.
    v_sku_change_kind := null;
    v_sku_change_note := null;
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

  if v_sku_actually_changed then
    -- Reemplazo de códigos vigentes: preservar historia si es publicada, borrar si draft.
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
       set valid_until    = now(),
           ended_by       = v_user,
           ended_reason   = 'Cambio de SKU en la posición',
           sku_change_kind = v_sku_change_kind
     where agreement_position_id = p_line_id and valid_until is null;

    -- R-09: cortar el tramo de precio en publicadas (draft no historiza).
    if v_is_published then
      -- Cierre del SKU viejo (valores previos a este UPDATE).
      insert into public.agreement_position_price_history
        (position_id, product_id, sale_price, start_date, end_date,
         recorded_by, change_reason, sku_change_kind, sku_change_note)
      values
        (p_line_id, v_row_pos.product_id, v_row_pos.sale_price,
         v_row_pos.start_date, v_row_pos.end_date,
         v_user, null, v_sku_change_kind, v_sku_change_note);

      -- Apertura del SKU nuevo (valores efectivos tras el UPDATE).
      v_new_price := case when v_has_price then v_sale_price else v_row_pos.sale_price end;
      v_new_start := case when v_has_start then v_start_date else v_row_pos.start_date end;
      v_new_end   := case when v_has_end   then v_end_date   else v_row_pos.end_date end;
      insert into public.agreement_position_price_history
        (position_id, product_id, sale_price, start_date, end_date,
         recorded_by, change_reason, sku_change_kind, sku_change_note)
      values
        (p_line_id, v_new_product_id, v_new_price,
         v_new_start, v_new_end,
         v_user, 'sku_open', null, null);
    end if;
  end if;

  if v_has_codes then
    select coalesce(array_agg((e->>'client_id')::uuid), '{}') into v_desired_ids
      from jsonb_array_elements(v_codes) e;

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

-- NOTA (follow-up, fuera de alcance R-09):
-- archive_agreement_position no copia product_id / sku_change_kind / sku_change_note
-- a archived_position_price_history. Hoy no rompe (columnas listadas explícitamente)
-- pero la foto pierde esa etiqueta. Propagar al archivar queda como pendiente del
-- propietario de las fotos.