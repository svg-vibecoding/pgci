
CREATE OR REPLACE FUNCTION public.recalc_agreement_position_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_agr_start date;
  v_agr_end date;
  v_start date;
  v_end date;
  v_sku_active boolean;
begin
  -- En INSERT: nunca tocar el estado. Nace en el estado dado (default 'draft').
  if TG_OP = 'INSERT' then
    return new;
  end if;

  -- En UPDATE: solo actuar si viene como 'active'. Los demás estados no se tocan.
  if new.status <> 'active' then
    return new;
  end if;

  select start_date, end_date
    into v_agr_start, v_agr_end
    from public.agreements
    where id = new.agreement_id;

  v_start := coalesce(new.start_date, v_agr_start);
  v_end   := coalesce(new.end_date,   v_agr_end);

  select (status = 'active') into v_sku_active
    from public.products where id = new.product_id;

  if v_sku_active is distinct from true
     or new.sale_price is null or new.sale_price <= 0
     or v_start is null or v_end is null
     or v_end < current_date then
    new.status := 'requires_review';
    return new;
  end if;

  -- Requisitos ok: dejar 'active' sin cambio. El trigger nunca sube.
  return new;
end;
$function$;
