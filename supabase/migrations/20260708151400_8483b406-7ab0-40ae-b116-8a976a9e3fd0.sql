CREATE OR REPLACE FUNCTION public.recalc_agreement_position_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_agr_start date;
  v_agr_end date;
  v_start date;
  v_end date;
  v_sku_active boolean;
begin
  if new.status = 'excluded' then
    return new;
  end if;

  select start_date, end_date
    into v_agr_start, v_agr_end
    from public.agreements
    where id = new.agreement_id;

  v_start := coalesce(new.start_date, v_agr_start);
  v_end   := coalesce(new.end_date,   v_agr_end);

  -- Producto inactivo → requires_review
  select (status = 'active') into v_sku_active
    from public.products where id = new.product_id;
  if v_sku_active is false then
    new.status := 'requires_review';
    return new;
  end if;

  -- Sin precio válido → requires_review
  if new.sale_price is null or new.sale_price <= 0 then
    new.status := 'requires_review';
    return new;
  end if;

  -- Sin vigencia efectiva (ni propia ni heredada) → requires_review
  if v_start is null or v_end is null then
    new.status := 'requires_review';
    return new;
  end if;

  -- Vigencia expirada → requires_review
  if v_end < current_date then
    new.status := 'requires_review';
    return new;
  end if;

  new.status := 'active';
  return new;
end;
$$;

-- Reclasificar filas existentes: forzar recomputo disparando el trigger BEFORE UPDATE
-- en las columnas vigiladas. Se re-asigna sale_price a sí mismo para activar el trigger.
UPDATE public.agreement_positions
SET sale_price = sale_price
WHERE status <> 'excluded';
