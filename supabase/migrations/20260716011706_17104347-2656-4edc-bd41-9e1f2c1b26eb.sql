
-- 1) recalc_sku_conflict: los COMPETIDORES son solo posiciones PUBLICADAS
--    (published_at is not null: active | requires_review | excluded).
--    Los drafts no compiten; se marcan a sí mismos pero no degradan a otros.
--    Solo se degrada a 'requires_review' cuando la posición evaluada YA está publicada.
CREATE OR REPLACE FUNCTION public.recalc_sku_conflict(p_agreement_id uuid, p_product_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  v_pub_count int;
  v_conflict boolean;
  v_new_reason text;
begin
  if pg_trigger_depth() > 3 then return; end if;
  if p_product_id is null then return; end if;

  select count(*) into v_pub_count
    from public.agreement_positions
   where agreement_id = p_agreement_id
     and product_id   = p_product_id
     and published_at is not null;

  for r in
    select id, status, pending_reason, published_at
      from public.agreement_positions
     where agreement_id = p_agreement_id
       and product_id   = p_product_id
       and status in ('active','draft','requires_review')
  loop
    -- Nº de competidores efectivos para r = v_pub_count menos r si r ya es publicada.
    if v_pub_count = 0
       or (r.published_at is not null and v_pub_count <= 1) then
      v_conflict := false;
    else
      select not exists (
        select 1
          from public.agreement_position_client_codes self_c
         where self_c.agreement_position_id = r.id
           and self_c.valid_until is null
           and not exists (
             select 1
               from public.agreement_position_client_codes other_c
               join public.agreement_positions other_p
                 on other_p.id = other_c.agreement_position_id
              where other_p.agreement_id  = p_agreement_id
                and other_p.product_id    = p_product_id
                and other_p.id           <> r.id
                and other_p.published_at is not null
                and other_c.valid_until   is null
                and other_c.client_id     = self_c.client_id
           )
      ) into v_conflict;
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

    if v_conflict and r.published_at is not null then
      -- Publicada en conflicto: degradar a requires_review + token
      update public.agreement_positions
         set status         = 'requires_review',
             pending_reason = v_new_reason,
             updated_at     = now()
       where id = r.id
         and (status is distinct from 'requires_review'
              or pending_reason is distinct from v_new_reason);
    else
      -- Draft (con o sin conflicto): sólo marca token, no cambia status.
      -- Publicada sin conflicto: limpia token, conserva status (recalc no promueve).
      update public.agreement_positions
         set pending_reason = v_new_reason,
             updated_at     = now()
       where id = r.id
         and pending_reason is distinct from v_new_reason;
    end if;
  end loop;
end;
$function$;

-- 2) Trigger sobre agreement_positions: también recalcular cuando cambia
--    published_at (publicar/despublicar cambia el conjunto competidor).
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
    elsif (
        ((OLD.status = 'excluded') is distinct from (NEW.status = 'excluded'))
        or ((OLD.published_at is null) is distinct from (NEW.published_at is null))
      ) and NEW.product_id is not null then
      perform public.recalc_sku_conflict(NEW.agreement_id, NEW.product_id);
    end if;
  end if;
  return null;
end;
$function$;

-- 3) publish_positions: al evaluar el conflicto para publicar X, considerar
--    SOLO hermanas publicadas (published_at is not null) como competidoras.
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
          where ap2.agreement_id  = v_pos.agreement_id
            and ap2.product_id    = v_pos.product_id
            and ap2.id           <> v_id
            and ap2.published_at is not null) >= 1
        and not exists (
          select 1
            from public.agreement_position_client_codes self_c
           where self_c.agreement_position_id = v_id
             and self_c.valid_until is null
             and not exists (
               select 1
                 from public.agreement_position_client_codes other_c
                 join public.agreement_positions other_p on other_p.id = other_c.agreement_position_id
                where other_p.agreement_id  = v_pos.agreement_id
                  and other_p.product_id    = v_pos.product_id
                  and other_p.id           <> v_id
                  and other_p.published_at is not null
                  and other_c.valid_until   is null
                  and other_c.client_id     = self_c.client_id
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

-- 4) Recalcular estado actual: cualquier posición publicada que hoy tenga
--    sku_conflict solamente porque un draft la degradó debe recuperar su estado
--    coherente. Barrido idempotente sobre todos los (agreement_id, product_id).
DO $$
declare pair record;
begin
  for pair in
    select distinct agreement_id, product_id
      from public.agreement_positions
     where product_id is not null
  loop
    perform public.recalc_sku_conflict(pair.agreement_id, pair.product_id);
  end loop;
end $$;
