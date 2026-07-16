
CREATE TABLE public.archived_position_alternatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  archived_position_id uuid NOT NULL REFERENCES public.archived_positions(id) ON DELETE CASCADE,
  -- Materializado de products (congelado)
  product_id uuid,
  sku text,
  product_description text,
  product_brand text,
  -- Copiado (ya era valor)
  notes text,
  original_created_at timestamptz,
  original_created_by uuid
);

GRANT SELECT ON public.archived_position_alternatives TO authenticated;
GRANT ALL ON public.archived_position_alternatives TO service_role;

ALTER TABLE public.archived_position_alternatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver alternativas de fotos archivadas del acuerdo"
  ON public.archived_position_alternatives
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.archived_positions ap
      WHERE ap.id = archived_position_alternatives.archived_position_id
        AND public.can_access_agreement(ap.agreement_id)
    )
  );

CREATE INDEX archived_position_alternatives_archived_position_id_idx
  ON public.archived_position_alternatives (archived_position_id);
