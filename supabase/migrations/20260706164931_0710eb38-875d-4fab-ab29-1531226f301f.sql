ALTER TABLE public.agreement_companies
  ADD COLUMN linked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;