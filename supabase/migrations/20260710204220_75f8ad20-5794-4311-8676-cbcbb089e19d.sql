-- 1. Enum code_source
CREATE TYPE public.code_source AS ENUM ('agreement', 'manual', 'quotation');

-- 2. client_product_match.source: text -> code_source (datos de prueba, se truncan valores no válidos)
UPDATE public.client_product_match
  SET source = NULL
  WHERE source IS NOT NULL
    AND source NOT IN ('agreement', 'manual', 'quotation');

ALTER TABLE public.client_product_match
  ALTER COLUMN source DROP DEFAULT;

ALTER TABLE public.client_product_match
  ALTER COLUMN source TYPE public.code_source
  USING (COALESCE(source, 'manual')::public.code_source);

ALTER TABLE public.client_product_match
  ALTER COLUMN source SET DEFAULT 'manual'::public.code_source;

ALTER TABLE public.client_product_match
  ALTER COLUMN source SET NOT NULL;

-- 3. client_products: description y brand (valor vigente del código)
ALTER TABLE public.client_products
  ADD COLUMN description text,
  ADD COLUMN brand text;

-- 4. client_product_history: source y source_reference
ALTER TABLE public.client_product_history
  ADD COLUMN source public.code_source NOT NULL DEFAULT 'agreement'::public.code_source,
  ADD COLUMN source_reference uuid;
