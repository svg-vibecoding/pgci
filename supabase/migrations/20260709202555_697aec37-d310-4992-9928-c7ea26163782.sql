DO $$
DECLARE
  v_old_def text;
  v_new_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_old_def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE p.proname = 'create_agreement_line'
     AND n.nspname = 'public';

  v_new_def := replace(v_old_def,
    '  v_codes := public._validate_client_codes(p_agreement_id, p_payload->''client_codes'');',
    '  v_codes := public._validate_client_codes(p_agreement_id, p_payload->''client_codes'', null);');

  EXECUTE v_new_def;
END $$;

DROP FUNCTION IF EXISTS public._validate_client_codes(uuid, jsonb);