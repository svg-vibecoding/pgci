-- =============================================================================
-- PGCI 03.00.03 — Permisos granulares catálogo/matching + 03.20.04 §1-2
-- =============================================================================

-- 03.00.03 §1 — Nuevas columnas
alter table public.user_client_access
  add column if not exists can_manage_client_catalog boolean not null default false,
  add column if not exists can_manage_matching        boolean not null default false;

comment on column public.user_client_access.can_manage_client_catalog is
  'Gestionar client_products (códigos y descripciones del cliente). Booleano por cliente, default false. super_admin tiene bypass propio y no depende de esta columna.';
comment on column public.user_client_access.can_manage_matching is
  'Gestionar client_product_match (código de cliente → SKU Jaivaná) para los clientes asignados. Booleano por cliente, default false. Independiente de can_manage_client_catalog y de can_create_agreements.';

-- 03.00.03 §2 — UPDATE en user_client_access
drop policy if exists uca_update on public.user_client_access;
create policy uca_update on public.user_client_access for update to authenticated
  using ( public.is_super_admin() )
  with check ( public.is_super_admin() );

-- 03.00.03 §3 — Funciones auxiliares
create or replace function public.can_manage_client_catalog(p_client_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or exists (
    select 1 from public.user_client_access uca
      join public.profiles p on p.user_id = uca.user_id
     where uca.user_id = auth.uid()
       and uca.client_id = p_client_id
       and uca.can_manage_client_catalog = true
       and p.status = 'active'
  );
$$;

create or replace function public.can_manage_matching(p_client_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or exists (
    select 1 from public.user_client_access uca
      join public.profiles p on p.user_id = uca.user_id
     where uca.user_id = auth.uid()
       and uca.client_id = p_client_id
       and uca.can_manage_matching = true
       and p.status = 'active'
  );
$$;

revoke execute on function public.can_manage_client_catalog(uuid) from public;
revoke execute on function public.can_manage_matching(uuid)        from public;
grant  execute on function public.can_manage_client_catalog(uuid) to authenticated;
grant  execute on function public.can_manage_matching(uuid)        to authenticated;
revoke execute on function public.can_manage_client_catalog(uuid) from anon, sandbox_exec;
revoke execute on function public.can_manage_matching(uuid)        from anon, sandbox_exec;

-- 03.00.03 §4 — client_products RLS
drop policy if exists "client_products_insert" on public.client_products;
create policy "client_products_insert" on public.client_products
  for insert to authenticated
  with check (public.can_manage_client_catalog(client_id));

drop policy if exists "client_products_update" on public.client_products;
create policy "client_products_update" on public.client_products
  for update to authenticated
  using (public.can_manage_client_catalog(client_id))
  with check (public.can_manage_client_catalog(client_id));

drop policy if exists "client_products_delete" on public.client_products;
create policy "client_products_delete" on public.client_products
  for delete to authenticated
  using (public.can_manage_client_catalog(client_id));

-- 03.00.03 §5 — client_product_history RLS
drop policy if exists "client_product_history_insert" on public.client_product_history;
create policy "client_product_history_insert" on public.client_product_history
  for insert to authenticated
  with check (
    exists (
      select 1 from public.client_products cp
       where cp.id = client_product_id
         and public.can_manage_client_catalog(cp.client_id)
    )
  );

drop policy if exists "client_product_history_update" on public.client_product_history;
create policy "client_product_history_update" on public.client_product_history
  for update to authenticated
  using (
    exists (
      select 1 from public.client_products cp
       where cp.id = client_product_id
         and public.can_manage_client_catalog(cp.client_id)
    )
  )
  with check (
    exists (
      select 1 from public.client_products cp
       where cp.id = client_product_id
         and public.can_manage_client_catalog(cp.client_id)
    )
  );

drop policy if exists "client_product_history_delete" on public.client_product_history;
create policy "client_product_history_delete" on public.client_product_history
  for delete to authenticated
  using (
    exists (
      select 1 from public.client_products cp
       where cp.id = client_product_id
         and public.can_manage_client_catalog(cp.client_id)
    )
  );

-- 03.00.03 §6 — client_product_match RLS
drop policy if exists "client_product_match_insert" on public.client_product_match;
create policy "client_product_match_insert" on public.client_product_match
  for insert to authenticated
  with check (
    exists (
      select 1 from public.client_products cp
       where cp.id = client_product_id
         and public.can_manage_matching(cp.client_id)
    )
  );

drop policy if exists "client_product_match_update" on public.client_product_match;
create policy "client_product_match_update" on public.client_product_match
  for update to authenticated
  using (
    exists (
      select 1 from public.client_products cp
       where cp.id = client_product_id
         and public.can_manage_matching(cp.client_id)
    )
  )
  with check (
    exists (
      select 1 from public.client_products cp
       where cp.id = client_product_id
         and public.can_manage_matching(cp.client_id)
    )
  );

drop policy if exists "client_product_match_delete" on public.client_product_match;
create policy "client_product_match_delete" on public.client_product_match
  for delete to authenticated
  using (
    exists (
      select 1 from public.client_products cp
       where cp.id = client_product_id
         and public.can_manage_matching(cp.client_id)
    )
  );

-- =============================================================================
-- 03.20.04 §1 — Índice único parcial sobre agreement_products
-- =============================================================================
create unique index if not exists agreement_products_agreement_client_product_uq
  on public.agreement_products (agreement_id, client_product_id)
  where client_product_id is not null and status <> 'excluded';

-- =============================================================================
-- 03.20.04 §2 — Patch a commit_agreement_import
--   §2.1: security definer
--   §2.2: nueva resolución de línea existente por client_product_id
-- =============================================================================
CREATE OR REPLACE FUNCTION public.commit_agreement_import(p_agreement_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_client_id        uuid;
  v_companies_count  integer;
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

  select count(*) into v_companies_count
    from public.agreement_companies where agreement_id = p_agreement_id;

  if v_companies_count = 0 then
    raise exception 'Acuerdo sin empresas vinculadas';
  elsif v_companies_count = 1 then
    select client_id into v_client_id
      from public.agreement_companies where agreement_id = p_agreement_id;
  else
    v_client_id := nullif(p_payload->>'target_client_id','')::uuid;
    if v_client_id is null then
      raise exception 'Acuerdo con múltiples empresas: falta target_client_id en payload';
    end if;
    if not exists (select 1 from public.agreement_companies
                    where agreement_id = p_agreement_id and client_id = v_client_id) then
      raise exception 'target_client_id no está vinculado al acuerdo';
    end if;
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

    -- §2.2 — resolución nueva: con índice único (agreement_id, client_product_id)
    -- WHERE status <> 'excluded', la línea no-excluida por código de cliente es única.
    v_existing_line_id := null;
    if v_client_product_id is not null then
      select id into v_existing_line_id
        from public.agreement_products
       where agreement_id = p_agreement_id
         and client_product_id = v_client_product_id
         and status <> 'excluded'
       limit 1;
    elsif v_product_id is not null then
      select id into v_existing_line_id
        from public.agreement_products
       where agreement_id = p_agreement_id
         and product_id = v_product_id
         and client_product_id is null
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