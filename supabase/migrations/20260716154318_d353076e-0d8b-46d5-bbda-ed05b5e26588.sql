CREATE OR REPLACE FUNCTION public.check_rn_match_01()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_conflict_id uuid;
  v_client_code text;
  v_sku text;
begin
  -- RN-MATCH-01 protege vigencia simultánea: un código no puede estar
  -- vigente en dos posiciones del mismo acuerdo al mismo tiempo.
  -- Relaciones cerradas (valid_until no nulo) son historia y no ocupan.
  if NEW.valid_until is not null then
    return NEW;
  end if;

  select apcc.id
    into v_conflict_id
  from public.agreement_position_client_codes apcc
  where apcc.agreement_id = NEW.agreement_id
    and apcc.client_product_id = NEW.client_product_id
    and apcc.agreement_position_id <> NEW.agreement_position_id
    and apcc.id <> NEW.id
    and apcc.valid_until is null
  limit 1;

  if v_conflict_id is not null then
    select cp.client_code into v_client_code
    from public.client_products cp
    where cp.id = NEW.client_product_id;

    select p.sku into v_sku
    from public.agreement_position_client_codes apcc
    join public.agreement_positions ap on ap.id = apcc.agreement_position_id
    left join public.products p on p.id = ap.product_id
    where apcc.id = v_conflict_id
      and apcc.valid_until is null;

    raise exception 'El código de cliente % ya está asignado a la posición SKU % de este acuerdo (RN-MATCH-01).',
      coalesce(v_client_code, '(sin código)'),
      coalesce(v_sku, '(sin SKU)')
      using errcode = '23505';
  end if;

  return NEW;
end;
$function$;