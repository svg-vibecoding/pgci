
CREATE OR REPLACE FUNCTION public.archive_agreement_position(
  p_position_id uuid,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pos            agreement_positions%ROWTYPE;
  v_archived_id    uuid;
  v_reason         text := btrim(coalesce(p_reason, ''));
BEGIN
  -- 1) Validaciones
  IF v_reason = '' THEN
    RAISE EXCEPTION 'Archivar exige un motivo.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_pos
    FROM public.agreement_positions
   WHERE id = p_position_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La posición no existe.' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.can_admin_agreement(v_pos.agreement_id) THEN
    RAISE EXCEPTION 'No autorizado para archivar posiciones de este acuerdo.'
      USING ERRCODE = '42501';
  END IF;

  IF v_pos.published_at IS NULL THEN
    RAISE EXCEPTION 'Un registro en gestión no se archiva, se elimina.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_pos.status NOT IN ('active','requires_review','excluded') THEN
    RAISE EXCEPTION 'Solo se archivan posiciones publicadas (active, requires_review, excluded).'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2) Crear la foto (materializando SKU/descr/marca desde products)
  INSERT INTO public.archived_positions (
    agreement_id, original_position_id,
    sku, product_description, product_brand,
    sale_price, par_price, start_date, end_date, observations,
    original_status, archived_at, archived_by, archive_reason,
    original_created_at, original_published_at
  )
  SELECT
    v_pos.agreement_id, v_pos.id,
    p.sku,
    COALESCE(p.commercial_description, p.erp_description),
    COALESCE(p.commercial_brand, p.erp_brand),
    v_pos.sale_price, v_pos.par_price, v_pos.start_date, v_pos.end_date, v_pos.observations,
    v_pos.status, now(), auth.uid(), v_reason,
    v_pos.created_at, v_pos.published_at
  FROM (SELECT 1) x
  LEFT JOIN public.products p ON p.id = v_pos.product_id
  RETURNING id INTO v_archived_id;

  -- 3a) Códigos: TODOS los períodos, materializando cliente y código
  INSERT INTO public.archived_position_codes (
    archived_position_id, client_id, client_name, client_code, code_description,
    valid_from, valid_until, ended_reason
  )
  SELECT
    v_archived_id,
    apcc.client_id,
    c.commercial_name,
    cp.client_code,
    cp.description,
    apcc.valid_from,
    apcc.valid_until,
    apcc.ended_reason
  FROM public.agreement_position_client_codes apcc
  LEFT JOIN public.clients c          ON c.id  = apcc.client_id
  LEFT JOIN public.client_products cp ON cp.id = apcc.client_product_id
  WHERE apcc.agreement_position_id = v_pos.id;

  -- 3b) Historial de precios: copia íntegra
  INSERT INTO public.archived_position_price_history (
    archived_position_id, sale_price, start_date, end_date,
    change_reason, recorded_at, recorded_by
  )
  SELECT
    v_archived_id, ph.sale_price, ph.start_date, ph.end_date,
    ph.change_reason, ph.recorded_at, ph.recorded_by
  FROM public.agreement_position_price_history ph
  WHERE ph.position_id = v_pos.id;

  -- 3c) Períodos de exclusión: copia íntegra
  INSERT INTO public.archived_position_exclusions (
    archived_position_id, exclusion_reason, valid_from, valid_until,
    started_by, ended_by, ended_reason
  )
  SELECT
    v_archived_id, ex.exclusion_reason, ex.valid_from, ex.valid_until,
    ex.started_by, ex.ended_by, ex.ended_reason
  FROM public.agreement_position_exclusions ex
  WHERE ex.position_id = v_pos.id;

  -- 3d) Alternativas: materializando SKU/descr/marca del alternativo
  INSERT INTO public.archived_position_alternatives (
    archived_position_id, product_id, sku, product_description, product_brand,
    notes, original_created_at, original_created_by
  )
  SELECT
    v_archived_id,
    alt.product_id,
    p.sku,
    COALESCE(p.commercial_description, p.erp_description),
    COALESCE(p.commercial_brand, p.erp_brand),
    alt.notes, alt.created_at, alt.created_by
  FROM public.agreement_position_alternatives alt
  LEFT JOIN public.products p ON p.id = alt.product_id
  WHERE alt.agreement_position_id = v_pos.id;

  -- 4) Borrar la posición viva y todo lo que cuelga
  DELETE FROM public.agreement_position_price_history WHERE position_id           = v_pos.id;
  DELETE FROM public.agreement_position_exclusions    WHERE position_id           = v_pos.id;
  DELETE FROM public.agreement_position_alternatives  WHERE agreement_position_id = v_pos.id;
  DELETE FROM public.agreement_position_client_codes  WHERE agreement_position_id = v_pos.id;
  DELETE FROM public.agreement_positions              WHERE id                    = v_pos.id;

  RETURN v_archived_id;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_agreement_position(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_agreement_position(uuid, text) TO authenticated;
