CREATE OR REPLACE FUNCTION public._resolve_client_code(p_client_id uuid, p_client_code text, p_description text, p_product_id uuid, p_source text)
 RETURNS TABLE(client_product_id uuid, client_product_match_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_cp uuid; v_match uuid;
begin
  insert into public.client_products (client_id, client_code, created_by)
       values (p_client_id, p_client_code, auth.uid())
  on conflict (client_id, client_code) do update set client_code=excluded.client_code
  returning id into v_cp;

  if p_description is not null
     and p_description is distinct from (
       select cph.description from public.client_product_history cph
        where cph.client_product_id = v_cp
        order by cph.valid_from desc limit 1
     ) then
    insert into public.client_product_history (client_product_id, description, valid_from)
    values (v_cp, p_description, current_date);
  end if;

  if p_product_id is not null then
    select cpm.id into v_match from public.client_product_match cpm
     where cpm.client_product_id = v_cp and cpm.product_id = p_product_id limit 1;
    if v_match is null then
      insert into public.client_product_match
           (client_product_id, product_id, valid_from, source, created_by)
           values (v_cp, p_product_id, current_date, p_source, auth.uid())
      returning id into v_match;
    end if;
  end if;
  client_product_id := v_cp;
  client_product_match_id := v_match;
  return next;
end $function$;

REVOKE EXECUTE ON FUNCTION public._resolve_client_code(uuid, text, text, uuid, text) FROM authenticated;