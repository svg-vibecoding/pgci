
-- RPCs para exponer perfiles de participantes de un acuerdo/agrupador sin abrir profiles globalmente.

CREATE OR REPLACE FUNCTION public.get_agreement_participants(p_agreement_id uuid)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  status text,
  erp_user_code text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_access_agreement(p_agreement_id) THEN
    RAISE EXCEPTION 'Forbidden' USING errcode = '42501';
  END IF;

  RETURN QUERY
  WITH ids AS (
    SELECT am.user_id     AS uid FROM public.agreement_members am     WHERE am.agreement_id = p_agreement_id AND am.user_id IS NOT NULL
    UNION
    SELECT am.assigned_by         FROM public.agreement_members am     WHERE am.agreement_id = p_agreement_id AND am.assigned_by IS NOT NULL
    UNION
    SELECT am.started_by          FROM public.agreement_members am     WHERE am.agreement_id = p_agreement_id AND am.started_by IS NOT NULL
    UNION
    SELECT am.ended_by            FROM public.agreement_members am     WHERE am.agreement_id = p_agreement_id AND am.ended_by IS NOT NULL
    UNION
    SELECT ac.linked_by           FROM public.agreement_companies ac   WHERE ac.agreement_id = p_agreement_id AND ac.linked_by IS NOT NULL
    UNION
    SELECT ac.started_by          FROM public.agreement_companies ac   WHERE ac.agreement_id = p_agreement_id AND ac.started_by IS NOT NULL
    UNION
    SELECT ac.ended_by            FROM public.agreement_companies ac   WHERE ac.agreement_id = p_agreement_id AND ac.ended_by IS NOT NULL
    UNION
    SELECT a.created_by           FROM public.agreements a             WHERE a.id = p_agreement_id            AND a.created_by IS NOT NULL
  )
  SELECT p.user_id, p.full_name, p.email, p.status, p.erp_user_code
    FROM public.profiles p
    JOIN ids ON ids.uid = p.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_agreement_participants(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_agreement_participants(uuid) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.get_agreement_group_participants(p_group_id uuid)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  status text,
  erp_user_code text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_super_admin() OR public.is_agreement_group_member(p_group_id, auth.uid())) THEN
    RAISE EXCEPTION 'Forbidden' USING errcode = '42501';
  END IF;

  RETURN QUERY
  WITH ids AS (
    SELECT gm.user_id     AS uid FROM public.agreement_group_members gm WHERE gm.agreement_group_id = p_group_id AND gm.user_id IS NOT NULL
    UNION
    SELECT gm.assigned_by         FROM public.agreement_group_members gm WHERE gm.agreement_group_id = p_group_id AND gm.assigned_by IS NOT NULL
    UNION
    SELECT gm.started_by          FROM public.agreement_group_members gm WHERE gm.agreement_group_id = p_group_id AND gm.started_by IS NOT NULL
    UNION
    SELECT gm.ended_by            FROM public.agreement_group_members gm WHERE gm.agreement_group_id = p_group_id AND gm.ended_by IS NOT NULL
    UNION
    SELECT g.created_by           FROM public.agreement_groups g         WHERE g.id = p_group_id                   AND g.created_by IS NOT NULL
  )
  SELECT p.user_id, p.full_name, p.email, p.status, p.erp_user_code
    FROM public.profiles p
    JOIN ids ON ids.uid = p.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_agreement_group_participants(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_agreement_group_participants(uuid) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.list_assignable_users_for_agreement(p_agreement_id uuid)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_admin_agreement(p_agreement_id) THEN
    RAISE EXCEPTION 'Forbidden' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT DISTINCT p.user_id, p.full_name, p.email, p.status
    FROM public.profiles p
    JOIN public.user_client_access uca ON uca.user_id = p.user_id
    JOIN public.agreement_companies ac
      ON ac.client_id = uca.client_id
   WHERE ac.agreement_id = p_agreement_id
     AND ac.valid_until  IS NULL
     AND uca.valid_until IS NULL
     AND p.status        = 'active'
     AND p.role          = 'platform_user'
   ORDER BY p.full_name;
END;
$$;

REVOKE ALL ON FUNCTION public.list_assignable_users_for_agreement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_assignable_users_for_agreement(uuid) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.list_assignable_users_for_agreement_group(p_group_id uuid)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  IF NOT (public.is_super_admin() OR public.is_agreement_group_admin(p_group_id, auth.uid())) THEN
    RAISE EXCEPTION 'Forbidden' USING errcode = '42501';
  END IF;

  SELECT client_id INTO v_client_id FROM public.agreement_groups WHERE id = p_group_id;

  RETURN QUERY
  SELECT DISTINCT p.user_id, p.full_name, p.email, p.status
    FROM public.profiles p
    JOIN public.user_client_access uca ON uca.user_id = p.user_id
   WHERE (v_client_id IS NULL OR uca.client_id = v_client_id)
     AND uca.valid_until IS NULL
     AND p.status        = 'active'
     AND p.role          = 'platform_user'
   ORDER BY p.full_name;
END;
$$;

REVOKE ALL ON FUNCTION public.list_assignable_users_for_agreement_group(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_assignable_users_for_agreement_group(uuid) TO authenticated, service_role;
