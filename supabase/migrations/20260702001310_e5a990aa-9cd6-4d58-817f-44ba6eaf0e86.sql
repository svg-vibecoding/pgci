
-- ============================================================
-- 2.1 agreement_members: reemplazar dependencia de get_agreement_client_id
-- ============================================================
DROP POLICY IF EXISTS am_insert ON public.agreement_members;
DROP POLICY IF EXISTS am_update ON public.agreement_members;

CREATE POLICY am_insert ON public.agreement_members FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.can_admin_agreement(agreement_id)
      AND EXISTS (
        SELECT 1 FROM public.agreement_companies ac
         WHERE ac.agreement_id = agreement_members.agreement_id
           AND public.user_has_client_access(agreement_members.user_id, ac.client_id)
      )
    )
  );

CREATE POLICY am_update ON public.agreement_members FOR UPDATE
  USING (public.is_super_admin() OR public.can_admin_agreement(agreement_id))
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.can_admin_agreement(agreement_id)
      AND EXISTS (
        SELECT 1 FROM public.agreement_companies ac
         WHERE ac.agreement_id = agreement_members.agreement_id
           AND public.user_has_client_access(agreement_members.user_id, ac.client_id)
      )
    )
  );

-- ============================================================
-- 2.2 agreement_companies: exigir acceso al cliente al escribir
-- ============================================================
DROP POLICY IF EXISTS agco_insert ON public.agreement_companies;
DROP POLICY IF EXISTS agco_update ON public.agreement_companies;
DROP POLICY IF EXISTS agco_delete ON public.agreement_companies;

CREATE POLICY agco_insert ON public.agreement_companies FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR (public.can_admin_agreement(agreement_id) AND public.has_client_access(client_id))
  );

CREATE POLICY agco_update ON public.agreement_companies FOR UPDATE
  USING (public.is_super_admin() OR public.can_admin_agreement(agreement_id))
  WITH CHECK (
    public.is_super_admin()
    OR (public.can_admin_agreement(agreement_id) AND public.has_client_access(client_id))
  );

CREATE POLICY agco_delete ON public.agreement_companies FOR DELETE
  USING (
    public.is_super_admin()
    OR (public.can_admin_agreement(agreement_id) AND public.has_client_access(client_id))
  );

-- ============================================================
-- 2.3 agreements INSERT: autorización basada en agrupador
-- ============================================================
DROP POLICY IF EXISTS agreements_insert ON public.agreements;
CREATE POLICY agreements_insert ON public.agreements FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.agreement_groups g
       WHERE g.id = agreements.group_id
         AND g.client_id IS NOT NULL
         AND public.can_create_agreements_for_client(g.client_id)
    )
  );

-- ============================================================
-- 2.4 Eliminar shim get_agreement_client_id — ya no aplica
-- ============================================================
DROP FUNCTION IF EXISTS public.get_agreement_client_id(uuid);
