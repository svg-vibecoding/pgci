CREATE OR REPLACE FUNCTION public.position_has_sku_conflict(p_position_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Conflicto = existe AL MENOS UNA posición publicada del mismo SKU (distinta
  -- de mí) contra la cual NO existe ningún cliente que nos distinga (código en
  -- ambos lados). RN-MATCH-01 garantiza que si ambos lados tienen código para
  -- el mismo cliente, esos códigos son distintos entre posiciones.
  select exists (
    select 1
      from public.agreement_positions other_p
      join public.agreement_positions self_p on self_p.id = p_position_id
     where other_p.agreement_id  = self_p.agreement_id
       and other_p.product_id    = self_p.product_id
       and other_p.id           <> self_p.id
       and other_p.published_at is not null
       and not exists (
         select 1
           from public.agreement_position_client_codes self_c
           join public.agreement_position_client_codes other_c
                on other_c.agreement_position_id = other_p.id
               and other_c.client_id             = self_c.client_id
               and other_c.valid_until           is null
               and other_c.client_product_id    <> self_c.client_product_id
          where self_c.agreement_position_id = p_position_id
            and self_c.valid_until is null
       )
  );
$function$;

-- Backfill: recalcular sku_conflict para todos los pares (agreement, product)
-- con 2+ posiciones.
DO $$
declare r record;
begin
  for r in
    select agreement_id, product_id
      from public.agreement_positions
     where product_id is not null
     group by agreement_id, product_id
    having count(*) >= 2
  loop
    perform public.recalc_sku_conflict(r.agreement_id, r.product_id);
  end loop;
end $$;