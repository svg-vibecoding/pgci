ALTER TABLE public.agreement_products
  ADD COLUMN product_id uuid REFERENCES public.products(id) ON DELETE CASCADE;

CREATE INDEX idx_agreement_products_product_id
  ON public.agreement_products(product_id);