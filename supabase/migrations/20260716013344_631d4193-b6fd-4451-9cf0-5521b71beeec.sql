CREATE OR REPLACE FUNCTION public.recalc_sku_conflict(p_agreement_id uuid, p_product_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  v_pub_count int;
  v_conflict boolean;
  v_new_reason text;
begin
  if pg_trigger_depth() > 3 then return; end if;
  if p_product_id is null then return; end if;

  select count(*) into v_pub_count
    from public.agreement_positions
   where agreement_id = p_agreement_id
     and product_id   = p_product_id
     and published_at is not null;

  for r in
    select id, status, pending_reason, published_at
      from public.agreement_positions
     where agreement_id = p_agreement_id
       and product_id   = p_product_id
       and status in ('active','draft','requires_review')
  loop
    if v_pub_count = 0
       or (r.published_at is not null and v_pub_count <= 1) then
      v_conflict := false;
    else
      select not exists (
        select 1
          from public.agreement_position_client_codes self_c
         where self_c.agreement_position_id = r.id
           and self_c.valid_until is null
           and exists (
             select 1
               from public.agreement_position_client_codes other_c
               join public.agreement_positions other_p
                 on other_p.id = other_c.agreement_position_id
              where other_p.agreement_id  = p_agreement_id
                and other_p.product_id    = p_product_id
                and other_p.id           <> r.id
                and other_p.published_at is not null
                and other_c.valid_until   is null
                and other_c.client_id     = self_c.client_id
                and other_c.client_product_id <> self_c.client_product_id
           )
      ) into v_conflict;
    end if;

    v_new_reason := nullif(
      array_to_string(
        array(select t from unnest(string_to_array(coalesce(r.pending_reason,''), ',')) t
               where t <> 'sku_conflict' and t <> ''),
        ','
      ),
      ''
    );
    if v_conflict then
      v_new_reason := case
        when v_new_reason is null or v_new_reason = '' then 'sku_conflict'
        else v_new_reason || ',sku_conflict'
      end;
    end if;

    if v_conflict and r.published_at is not null then
      update public.agreement_positions
         set status         = 'requires_review',
             pending_reason = v_new_reason,
             updated_at     = now()
       where id = r.id
         and (status is distinct from 'requires_review'
              or pending_reason is distinct from v_new_reason);
    else
      update public.agreement_positions
         set pending_reason = v_new_reason,
             updated_at     = now()
       where id = r.id
         and pending_reason is distinct from v_new_reason;
    end if;
  end loop;
end;
$function$;

-- Backfill: recalcular todos los pares (agreement_id, product_id) con posiciones no excluidas
DO $$
declare r record;
begin
  for r in
    select distinct agreement_id, product_id
      from public.agreement_positions
     where product_id is not null
       and status <> 'excluded'
  loop
    perform public.recalc_sku_conflict(r.agreement_id, r.product_id);
  end loop;
end $$;