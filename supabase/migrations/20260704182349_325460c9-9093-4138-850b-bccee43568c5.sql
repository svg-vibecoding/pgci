DROP POLICY IF EXISTS agco_insert ON public.agreement_companies;
CREATE POLICY agco_insert ON public.agreement_companies FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR (public.can_admin_agreement(agreement_id) AND public.can_create_agreements_for_client(client_id))
  );

DROP POLICY IF EXISTS agco_update ON public.agreement_companies;
CREATE POLICY agco_update ON public.agreement_companies FOR UPDATE
  USING (public.is_super_admin() OR public.can_admin_agreement(agreement_id))
  WITH CHECK (
    public.is_super_admin()
    OR (public.can_admin_agreement(agreement_id) AND public.can_create_agreements_for_client(client_id))
  );