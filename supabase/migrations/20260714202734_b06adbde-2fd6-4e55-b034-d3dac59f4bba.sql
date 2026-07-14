-- 1) Extender publish_positions para rechazar productos inactivos con token sku_inactive
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

    v_reason := nullif(array_to_string(array_remove(array[
      case when v_pos.product_id is null then 'no_sku' end,
      case when v_pos.product_id is not null and coalesce(v_sku_active, false) is not true then 'sku_inactive' end,
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

-- 2) Limpieza de dato corrupto: posición SKU 227000054 (Corona EPP) que quedó
-- con published_at sellado por el bug. Volver a draft, sin marca de publicación.
UPDATE public.agreement_positions
   SET status = 'draft',
       published_at = null,
       published_by = null,
       pending_reason = 'sku_inactive'
 WHERE id = 'e92d6420-2319-4d42-85af-3d1d923f5208';
