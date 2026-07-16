
-- 1) archived_positions — la foto
CREATE TABLE public.archived_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
  original_position_id uuid NOT NULL,
  -- Materializado desde products (congelado)
  sku text,
  product_description text,
  product_brand text,
  -- Copiado (ya era valor)
  sale_price numeric,
  par_price numeric,
  start_date date,
  end_date date,
  observations text,
  original_status text NOT NULL,
  -- Acto de archivar
  archived_at timestamptz NOT NULL DEFAULT now(),
  archived_by uuid,
  archive_reason text NOT NULL,
  -- Origen
  original_created_at timestamptz,
  original_published_at timestamptz
);

GRANT SELECT ON public.archived_positions TO authenticated;
GRANT ALL ON public.archived_positions TO service_role;

ALTER TABLE public.archived_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver fotos archivadas del acuerdo"
  ON public.archived_positions
  FOR SELECT
  TO authenticated
  USING (public.can_access_agreement(agreement_id));

CREATE INDEX archived_positions_agreement_id_idx
  ON public.archived_positions (agreement_id);
CREATE INDEX archived_positions_sku_idx
  ON public.archived_positions (sku);


-- 2) archived_position_codes — todos los períodos de códigos
CREATE TABLE public.archived_position_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  archived_position_id uuid NOT NULL REFERENCES public.archived_positions(id) ON DELETE CASCADE,
  client_id uuid,
  client_name text,
  client_code text,
  code_description text,
  valid_from timestamptz,
  valid_until timestamptz,
  ended_reason text
);

GRANT SELECT ON public.archived_position_codes TO authenticated;
GRANT ALL ON public.archived_position_codes TO service_role;

ALTER TABLE public.archived_position_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver códigos de fotos archivadas del acuerdo"
  ON public.archived_position_codes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.archived_positions ap
      WHERE ap.id = archived_position_codes.archived_position_id
        AND public.can_access_agreement(ap.agreement_id)
    )
  );

CREATE INDEX archived_position_codes_archived_position_id_idx
  ON public.archived_position_codes (archived_position_id);


-- 3) archived_position_price_history — copia íntegra
CREATE TABLE public.archived_position_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  archived_position_id uuid NOT NULL REFERENCES public.archived_positions(id) ON DELETE CASCADE,
  sale_price numeric,
  start_date date,
  end_date date,
  change_reason text,
  recorded_at timestamptz,
  recorded_by uuid
);

GRANT SELECT ON public.archived_position_price_history TO authenticated;
GRANT ALL ON public.archived_position_price_history TO service_role;

ALTER TABLE public.archived_position_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver historial de precios de fotos archivadas del acuerdo"
  ON public.archived_position_price_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.archived_positions ap
      WHERE ap.id = archived_position_price_history.archived_position_id
        AND public.can_access_agreement(ap.agreement_id)
    )
  );

CREATE INDEX archived_position_price_history_archived_position_id_idx
  ON public.archived_position_price_history (archived_position_id);


-- 4) archived_position_exclusions — períodos de exclusión
CREATE TABLE public.archived_position_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  archived_position_id uuid NOT NULL REFERENCES public.archived_positions(id) ON DELETE CASCADE,
  exclusion_reason text,
  valid_from timestamptz,
  valid_until timestamptz,
  started_by uuid,
  ended_by uuid,
  ended_reason text
);

GRANT SELECT ON public.archived_position_exclusions TO authenticated;
GRANT ALL ON public.archived_position_exclusions TO service_role;

ALTER TABLE public.archived_position_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver exclusiones de fotos archivadas del acuerdo"
  ON public.archived_position_exclusions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.archived_positions ap
      WHERE ap.id = archived_position_exclusions.archived_position_id
        AND public.can_access_agreement(ap.agreement_id)
    )
  );

CREATE INDEX archived_position_exclusions_archived_position_id_idx
  ON public.archived_position_exclusions (archived_position_id);
