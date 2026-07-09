CREATE INDEX IF NOT EXISTS idx_uca_user_open
  ON public.user_client_access (user_id)
  WHERE valid_until IS NULL;

CREATE INDEX IF NOT EXISTS idx_agreement_members_user_open
  ON public.agreement_members (user_id)
  WHERE valid_until IS NULL;