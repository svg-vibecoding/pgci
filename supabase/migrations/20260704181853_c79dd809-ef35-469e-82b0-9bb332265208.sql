CREATE OR REPLACE FUNCTION public.check_agreement_group_reassignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    IF new.group_id IS NOT NULL THEN
      IF NOT public.is_super_admin()
         AND NOT public.is_agreement_group_admin(new.group_id, auth.uid()) THEN
        RAISE EXCEPTION 'Se requiere ser admin del agrupador destino para asignar este acuerdo'
          USING errcode = '42501';
      END IF;
    END IF;
    RETURN new;
  END IF;

  IF new.group_id IS DISTINCT FROM old.group_id THEN
    IF new.group_id IS NOT NULL THEN
      IF NOT public.is_super_admin()
         AND NOT public.is_agreement_group_admin(new.group_id, auth.uid()) THEN
        RAISE EXCEPTION 'Se requiere ser admin del agrupador destino para asignar este acuerdo'
          USING errcode = '42501';
      END IF;
    END IF;
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS check_agreement_group_reassignment_trigger ON public.agreements;
CREATE TRIGGER check_agreement_group_reassignment_trigger
  BEFORE INSERT OR UPDATE ON public.agreements
  FOR EACH ROW EXECUTE FUNCTION public.check_agreement_group_reassignment();