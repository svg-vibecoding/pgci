CREATE OR REPLACE FUNCTION public.create_agreement_tx(
  p_name           text,
  p_scope          text,
  p_unit_name      text,
  p_start_date     date,
  p_end_date       date,
  p_observations   text,
  p_group_id       uuid,
  p_client_ids     uuid[]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cid uuid;
  v_agreement_id uuid;
  v_clients uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING errcode = '42501';
  END IF;

  IF NOT (public.is_super_admin() OR public.can_create_agreements()) THEN
    RAISE EXCEPTION 'No tienes permiso para crear acuerdos' USING errcode = '42501';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT c), '{}') INTO v_clients
    FROM unnest(COALESCE(p_client_ids, '{}'::uuid[])) AS c
   WHERE c IS NOT NULL;

  IF array_length(v_clients, 1) IS NULL THEN
    RAISE EXCEPTION 'Debes indicar al menos un cliente cubierto'
      USING errcode = '22023';
  END IF;

  FOREACH v_cid IN ARRAY v_clients LOOP
    IF NOT public.can_create_agreements_for_client(v_cid) THEN
      RAISE EXCEPTION 'Sin permiso para crear acuerdos para el cliente %', v_cid
        USING errcode = '42501';
    END IF;
  END LOOP;

  IF p_scope NOT IN ('global', 'unit') THEN
    RAISE EXCEPTION 'scope inválido: %', p_scope USING errcode = '22023';
  END IF;
  IF p_scope = 'unit' AND (p_unit_name IS NULL OR btrim(p_unit_name) = '') THEN
    RAISE EXCEPTION 'unit_name es obligatorio cuando scope = unit'
      USING errcode = '22023';
  END IF;

  INSERT INTO public.agreements
    (name, scope, unit_name, start_date, end_date, observations, group_id, created_by)
  VALUES
    (btrim(p_name),
     p_scope,
     CASE WHEN p_scope = 'unit' THEN btrim(p_unit_name) ELSE NULL END,
     p_start_date, p_end_date, p_observations, p_group_id, v_uid)
  RETURNING id INTO v_agreement_id;

  FOREACH v_cid IN ARRAY v_clients LOOP
    INSERT INTO public.agreement_companies
      (agreement_id, client_id, started_by, linked_by)
    VALUES
      (v_agreement_id, v_cid, v_uid, v_uid)
    ON CONFLICT (agreement_id, client_id) WHERE (valid_until IS NULL) DO NOTHING;
  END LOOP;

  INSERT INTO public.agreement_members
    (agreement_id, user_id, role, assigned_by, started_by)
  VALUES
    (v_agreement_id, v_uid, 'agreement_admin', v_uid, v_uid)
  ON CONFLICT (agreement_id, user_id) WHERE (valid_until IS NULL) DO NOTHING;

  RETURN v_agreement_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_agreement_tx(
  text, text, text, date, date, text, uuid, uuid[]
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_agreement_tx(
  text, text, text, date, date, text, uuid, uuid[]
) TO authenticated;