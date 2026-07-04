DROP POLICY IF EXISTS uca_insert ON public.user_client_access;
CREATE POLICY uca_insert ON public.user_client_access FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR (
      can_create_agreements = false
      AND can_manage_client_catalog = false
      AND can_manage_matching = false
      AND EXISTS (
        SELECT 1 FROM public.agreement_companies ac
         WHERE ac.client_id = user_client_access.client_id
           AND public.can_admin_agreement(ac.agreement_id)
      )
    )
  );