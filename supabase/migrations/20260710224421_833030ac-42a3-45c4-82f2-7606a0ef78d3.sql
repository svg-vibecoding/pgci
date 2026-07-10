
-- 1. Neutralizar commit_agreement_import (mantener firma)
CREATE OR REPLACE FUNCTION public.commit_agreement_import(p_agreement_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  raise exception 'commit_agreement_import está en reescritura para el modelo multi-cliente y ciclo de vida (R-09). No usar hasta el paso de importación.'
    using errcode = 'P0001';
end
$function$;

-- 2. Trigger + función de guard de denormalización
DROP TRIGGER IF EXISTS check_atcc_denormalization_trigger ON public.agreement_transit_client_codes;
DROP FUNCTION IF EXISTS public.check_atcc_denormalization();

-- 3. Políticas RLS de las tablas de tránsito
DROP POLICY IF EXISTS atcc_select ON public.agreement_transit_client_codes;
DROP POLICY IF EXISTS atcc_insert ON public.agreement_transit_client_codes;
DROP POLICY IF EXISTS atcc_update ON public.agreement_transit_client_codes;
DROP POLICY IF EXISTS atcc_delete ON public.agreement_transit_client_codes;
DROP POLICY IF EXISTS atl_select  ON public.agreement_transit_lines;
DROP POLICY IF EXISTS atl_write   ON public.agreement_transit_lines;

-- 4 y 5. Drop de las tablas (hijo primero)
DROP TABLE IF EXISTS public.agreement_transit_client_codes;
DROP TABLE IF EXISTS public.agreement_transit_lines;
