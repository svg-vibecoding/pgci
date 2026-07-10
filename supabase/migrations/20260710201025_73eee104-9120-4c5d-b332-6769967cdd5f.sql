CREATE TABLE public.product_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  erp_description text,
  erp_brand text,
  commercial_description text,
  commercial_brand text,
  brand_reference text,
  valid_from date NOT NULL DEFAULT current_date,
  valid_until date,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_history TO authenticated;
GRANT ALL ON public.product_history TO service_role;

ALTER TABLE public.product_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_history_select"
  ON public.product_history
  FOR SELECT
  TO authenticated
  USING (is_active_user(auth.uid()));

CREATE POLICY "product_history_insert"
  ON public.product_history
  FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "product_history_update"
  ON public.product_history
  FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "product_history_delete"
  ON public.product_history
  FOR DELETE
  TO authenticated
  USING (is_super_admin());

CREATE UNIQUE INDEX product_history_one_open_per_product
  ON public.product_history (product_id)
  WHERE valid_until IS NULL;

CREATE INDEX product_history_product_idx
  ON public.product_history (product_id);