CREATE OR REPLACE FUNCTION public.log_agreement_position_price_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- UPDATE cases
  IF OLD.status IS DISTINCT FROM 'active' AND NEW.status = 'active' THEN
    INSERT INTO public.agreement_position_price_history (
      position_id, sale_price, start_date, end_date, recorded_by, change_reason
    ) VALUES (
      NEW.id, NEW.sale_price, NEW.start_date, NEW.end_date, auth.uid(), 'initial'
    );
  ELSIF OLD.status = 'active' AND NEW.status = 'active' AND (
        NEW.sale_price IS DISTINCT FROM OLD.sale_price
     OR NEW.start_date IS DISTINCT FROM OLD.start_date
     OR NEW.end_date IS DISTINCT FROM OLD.end_date
  ) THEN
    INSERT INTO public.agreement_position_price_history (
      position_id, sale_price, start_date, end_date, recorded_by, change_reason
    ) VALUES (
      NEW.id, NEW.sale_price, NEW.start_date, NEW.end_date, auth.uid(), NULL
    );
  END IF;

  RETURN NEW;
END;
$$;