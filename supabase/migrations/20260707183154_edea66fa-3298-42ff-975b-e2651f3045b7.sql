-- Cambio 1: EXECUTE hardening
REVOKE ALL ON FUNCTION public.update_agreement_line(uuid, text, jsonb, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.update_agreement_line(uuid, text, jsonb, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.exclude_agreement_position(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.exclude_agreement_position(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.reactivate_agreement_position(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.reactivate_agreement_position(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.recalc_agreement_position_status() FROM public;
REVOKE ALL ON FUNCTION public.recalc_agreement_position_status() FROM authenticated;

REVOKE ALL ON FUNCTION public.log_agreement_position_price_change() FROM public;
REVOKE ALL ON FUNCTION public.log_agreement_position_price_change() FROM authenticated;

-- Cambio 2: rol explícito TO authenticated en las políticas nuevas
DROP POLICY atl_select ON public.agreement_transit_lines;
CREATE POLICY atl_select ON public.agreement_transit_lines
  FOR SELECT TO authenticated
  USING (can_access_agreement(agreement_id));

DROP POLICY atl_write ON public.agreement_transit_lines;
CREATE POLICY atl_write ON public.agreement_transit_lines
  FOR ALL TO authenticated
  USING (can_admin_agreement(agreement_id))
  WITH CHECK (can_admin_agreement(agreement_id));

DROP POLICY apph_select ON public.agreement_position_price_history;
CREATE POLICY apph_select ON public.agreement_position_price_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.agreement_positions p
     WHERE p.id = agreement_position_price_history.position_id
       AND can_access_agreement(p.agreement_id)
  ));

DROP POLICY ape_select ON public.agreement_position_exclusions;
CREATE POLICY ape_select ON public.agreement_position_exclusions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.agreement_positions p
     WHERE p.id = agreement_position_exclusions.position_id
       AND can_access_agreement(p.agreement_id)
  ));

-- Verificación defensiva de RLS (idempotente)
ALTER TABLE public.agreement_transit_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreement_position_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreement_position_exclusions ENABLE ROW LEVEL SECURITY;