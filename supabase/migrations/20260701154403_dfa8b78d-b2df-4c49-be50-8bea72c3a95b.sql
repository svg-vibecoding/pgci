
-- 1) Nueva columna de enlace directo a client_products (permite guardar
-- el código del cliente aunque no exista SKU Jaivaná todavía).
ALTER TABLE public.agreement_products
  ADD COLUMN IF NOT EXISTS client_product_id uuid
  REFERENCES public.client_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agreement_products_client_product_id
  ON public.agreement_products(client_product_id);

-- 2) Backfill: filas existentes con match ya resuelto heredan el client_product_id.
UPDATE public.agreement_products ap
SET client_product_id = cpm.client_product_id
FROM public.client_product_match cpm
WHERE ap.client_product_match_id = cpm.id
  AND ap.client_product_id IS NULL;

-- 3) Actualizar commit_agreement_import para poblar client_product_id siempre
-- que exista client_code, con o sin producto.
CREATE OR REPLACE FUNCTION public.commit_agreement_import(p_agreement_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_client_id        uuid;
  v_resolutions      jsonb := coalesce(p_payload->'price_resolutions', '{}'::jsonb);
  v_rows             jsonb := coalesce(p_payload->'rows', '[]'::jsonb);
  v_row              jsonb;
  v_sku              text;
  v_client_code      text;
  v_description      text;
  v_product_id       uuid;
  v_client_product_id uuid;
  v_match_id         uuid;
  v_sale_price       numeric;
  v_par_price        numeric;
  v_start_date       date;
  v_end_date         date;
  v_observations     text;
  v_existing_line_id uuid;
  v_inserted         integer := 0;
  v_updated          integer := 0;
  v_skipped          integer := 0;
  v_by_status        jsonb;
  v_propagated       integer := 0;
  v_sku_key          text;
  v_user             uuid := auth.uid();
begin
  if not public.can_admin_agreement(p_agreement_id) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select client_id into v_client_id from public.agreements where id = p_agreement_id;
  if v_client_id is null then
    raise exception 'Acuerdo no encontrado';
  end if;

  for v_row in select * from jsonb_array_elements(v_rows) loop
    v_sku          := nullif(trim(coalesce(v_row->>'sku', '')), '');
    v_client_code  := nullif(trim(coalesce(v_row->>'client_code', '')), '');
    v_description  := nullif(trim(coalesce(v_row->>'description', '')), '');
    v_sale_price   := nullif(v_row->>'sale_price', '')::numeric;
    v_par_price    := nullif(v_row->>'par_price', '')::numeric;
    v_start_date   := nullif(v_row->>'start_date', '')::date;
    v_end_date     := nullif(v_row->>'end_date', '')::date;
    v_observations := nullif(trim(coalesce(v_row->>'observations', '')), '');

    v_product_id := null;
    if v_sku is not null then
      select id into v_product_id from public.products where sku = v_sku limit 1;
    end if;

    v_client_product_id := null;
    v_match_id := null;
    if v_client_code is not null then
      insert into public.client_products (client_id, client_code, created_by)
      values (v_client_id, v_client_code, v_user)
      on conflict (client_id, client_code) do update set client_code = excluded.client_code
      returning id into v_client_product_id;

      if v_description is not null then
        insert into public.client_product_history
          (client_product_id, description, valid_from)
        values (v_client_product_id, v_description, current_date);
      end if;

      if v_product_id is not null then
        select id into v_match_id
          from public.client_product_match
         where client_product_id = v_client_product_id
           and product_id = v_product_id
         limit 1;

        if v_match_id is null then
          insert into public.client_product_match
            (client_product_id, product_id, valid_from, source, created_by)
          values (v_client_product_id, v_product_id, current_date, 'import', v_user)
          returning id into v_match_id;
        end if;
      end if;
    end if;

    v_existing_line_id := null;
    if v_match_id is not null then
      select id into v_existing_line_id
        from public.agreement_products
       where agreement_id = p_agreement_id
         and client_product_match_id = v_match_id
       limit 1;
    elsif v_client_product_id is not null and v_product_id is null then
      select id into v_existing_line_id
        from public.agreement_products
       where agreement_id = p_agreement_id
         and client_product_id = v_client_product_id
         and product_id is null
       limit 1;
    elsif v_product_id is not null then
      select id into v_existing_line_id
        from public.agreement_products
       where agreement_id = p_agreement_id
         and product_id = v_product_id
         and client_product_match_id is null
       limit 1;
    end if;

    if v_existing_line_id is null then
      insert into public.agreement_products (
        agreement_id, product_id, client_product_match_id, client_product_id,
        sale_price, par_price, start_date, end_date,
        observations, created_by, updated_by
      ) values (
        p_agreement_id, v_product_id, v_match_id, v_client_product_id,
        v_sale_price, v_par_price, v_start_date, v_end_date,
        v_observations, v_user, v_user
      );
      v_inserted := v_inserted + 1;
    else
      update public.agreement_products set
        product_id              = coalesce(v_product_id, product_id),
        client_product_match_id = coalesce(v_match_id, client_product_match_id),
        client_product_id       = coalesce(v_client_product_id, client_product_id),
        sale_price              = coalesce(v_sale_price, sale_price),
        par_price               = coalesce(v_par_price, par_price),
        start_date              = coalesce(v_start_date, start_date),
        end_date                = coalesce(v_end_date, end_date),
        observations            = coalesce(v_observations, observations),
        updated_by              = v_user,
        updated_at              = now()
      where id = v_existing_line_id
        and status <> 'excluded';
      v_updated := v_updated + 1;
    end if;
  end loop;

  for v_sku_key in select jsonb_object_keys(v_resolutions) loop
    if (v_resolutions->>v_sku_key) = 'applyAll' then
      select id into v_product_id from public.products where sku = v_sku_key limit 1;
      if v_product_id is not null then
        select max(nullif(value->>'sale_price','')::numeric)
          into v_sale_price
          from jsonb_array_elements(v_rows) as value
         where value->>'sku' = v_sku_key
           and nullif(value->>'sale_price','') is not null;

        if v_sale_price is not null then
          update public.agreement_products
             set sale_price = v_sale_price,
                 updated_by = v_user,
                 updated_at = now()
           where agreement_id = p_agreement_id
             and product_id   = v_product_id
             and status <> 'excluded'
             and (sale_price is distinct from v_sale_price);
          get diagnostics v_propagated = row_count;
        end if;
      end if;
    end if;
  end loop;

  select jsonb_object_agg(status, cnt) into v_by_status
    from (
      select status, count(*) as cnt
        from public.agreement_products
       where agreement_id = p_agreement_id
       group by status
    ) s;

  return jsonb_build_object(
    'inserted',        v_inserted,
    'updated',         v_updated,
    'skipped',         v_skipped,
    'propagated_n1',   v_propagated,
    'by_status',       coalesce(v_by_status, '{}'::jsonb)
  );
end$function$;
