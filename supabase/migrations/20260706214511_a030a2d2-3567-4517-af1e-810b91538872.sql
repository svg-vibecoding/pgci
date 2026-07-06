
-- =============================================================================
-- Fase 2 — Historización de agreement_companies y agreement_group_members
-- Replica el patrón validado en agreement_members (piloto 2026-07-06).
-- Alcance estricto: solo estas dos tablas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) agreement_companies — schema
-- -----------------------------------------------------------------------------

alter table public.agreement_companies
  add column valid_from    timestamptz not null default now(),
  add column valid_until   timestamptz,
  add column started_by    uuid references auth.users(id) on delete set null,
  add column ended_by      uuid references auth.users(id) on delete set null,
  add column ended_reason  text;

-- Backfill: preserva la fecha real de entrada (created_at) y quien vinculó.
update public.agreement_companies
   set valid_from = created_at,
       started_by = linked_by
 where started_by is null;

alter table public.agreement_companies
  drop constraint agreement_companies_agreement_id_client_id_key;

create unique index agreement_companies_open_uniq
  on public.agreement_companies (agreement_id, client_id)
  where valid_until is null;

alter table public.agreement_companies
  add constraint agreement_companies_period_valid
    check (valid_until is null or valid_until >= valid_from),
  add constraint agreement_companies_closure_consistent
    check ((valid_until is null) = (ended_by is null));

-- -----------------------------------------------------------------------------
-- 2) agreement_group_members — schema
-- -----------------------------------------------------------------------------

alter table public.agreement_group_members
  add column valid_from    timestamptz not null default now(),
  add column valid_until   timestamptz,
  add column started_by    uuid references auth.users(id) on delete set null,
  add column ended_by      uuid references auth.users(id) on delete set null,
  add column ended_reason  text;

update public.agreement_group_members
   set valid_from = created_at,
       started_by = assigned_by
 where started_by is null;

alter table public.agreement_group_members
  drop constraint agreement_group_members_unique;

create unique index agreement_group_members_open_uniq
  on public.agreement_group_members (agreement_group_id, user_id)
  where valid_until is null;

alter table public.agreement_group_members
  add constraint agreement_group_members_period_valid
    check (valid_until is null or valid_until >= valid_from),
  add constraint agreement_group_members_closure_consistent
    check ((valid_until is null) = (ended_by is null));

-- -----------------------------------------------------------------------------
-- 3) Triggers de identidad (ambos nuevos — verificado que no existían)
-- -----------------------------------------------------------------------------

create or replace function public.prevent_agreement_company_identity_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.agreement_id <> old.agreement_id or new.client_id <> old.client_id then
    raise exception 'agreement_id and client_id cannot be changed';
  end if;
  return new;
end $$;

create trigger trg_prevent_agreement_company_identity_change
  before update on public.agreement_companies
  for each row execute function public.prevent_agreement_company_identity_change();

create or replace function public.prevent_agreement_group_member_identity_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.agreement_group_id <> old.agreement_group_id or new.user_id <> old.user_id then
    raise exception 'agreement_group_id and user_id cannot be changed';
  end if;
  return new;
end $$;

create trigger trg_prevent_agreement_group_member_identity_change
  before update on public.agreement_group_members
  for each row execute function public.prevent_agreement_group_member_identity_change();

-- -----------------------------------------------------------------------------
-- 4) Funciones: acceso, roles, importación, membresía de agrupador
-- -----------------------------------------------------------------------------

create or replace function public.get_agreement_role(p_agreement_id uuid)
 returns text language sql stable security definer set search_path = public
as $function$
  SELECT CASE WHEN public.is_super_admin() THEN 'super_admin'
    ELSE (
      SELECT am.role FROM public.agreement_members am
        JOIN public.profiles p ON p.user_id = am.user_id
       WHERE am.agreement_id = p_agreement_id
         AND am.user_id = auth.uid()
         AND am.valid_until IS NULL
         AND p.status = 'active'
         AND EXISTS (
           SELECT 1 FROM public.agreement_companies ac
            WHERE ac.agreement_id = p_agreement_id
              AND ac.valid_until IS NULL
              AND public.user_has_client_access(auth.uid(), ac.client_id)
         )
       LIMIT 1
    )
  END;
$function$;

create or replace function public.user_can_access_agreement(p_user_id uuid, p_agreement_id uuid)
 returns boolean language sql stable security definer set search_path = public
as $function$
  SELECT
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE user_id = p_user_id AND role = 'super_admin' AND status = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM public.agreement_members am
        JOIN public.profiles p ON p.user_id = am.user_id
       WHERE am.user_id = p_user_id
         AND am.agreement_id = p_agreement_id
         AND am.valid_until IS NULL
         AND p.status = 'active'
         AND EXISTS (
           SELECT 1 FROM public.agreement_companies ac
            WHERE ac.agreement_id = p_agreement_id
              AND ac.valid_until IS NULL
              AND public.user_has_client_access(p_user_id, ac.client_id)
         )
    );
$function$;

create or replace function public.can_view_costs(p_agreement_id uuid)
 returns boolean language sql stable security definer set search_path = public
as $function$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.agreement_members am
      JOIN public.profiles p ON p.user_id = am.user_id
     WHERE am.agreement_id = p_agreement_id
       AND am.user_id = auth.uid()
       AND am.valid_until IS NULL
       AND am.can_view_costs = true
       AND p.status = 'active'
       AND EXISTS (
         SELECT 1 FROM public.agreement_companies ac
          WHERE ac.agreement_id = p_agreement_id
            AND ac.valid_until IS NULL
            AND public.user_has_client_access(auth.uid(), ac.client_id)
       )
  );
$function$;

create or replace function public.commit_agreement_import(p_agreement_id uuid, p_payload jsonb)
 returns jsonb language plpgsql security definer set search_path = public
as $function$
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
    from public.agreement_companies
   where agreement_id = p_agreement_id
     and valid_until is null;

  if v_companies_count = 0 then
    raise exception 'Acuerdo sin empresas vinculadas';
  elsif v_companies_count = 1 then
    select client_id into v_client_id
      from public.agreement_companies
     where agreement_id = p_agreement_id
       and valid_until is null;
  else
    v_client_id := nullif(p_payload->>'target_client_id','')::uuid;
    if v_client_id is null then
      raise exception 'Acuerdo con múltiples empresas: falta target_client_id en payload';
    end if;
    if not exists (select 1 from public.agreement_companies
                    where agreement_id = p_agreement_id
                      and client_id = v_client_id
                      and valid_until is null) then
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

create or replace function public.is_agreement_group_member(p_group_id uuid, p_user_id uuid)
 returns boolean language sql stable security definer set search_path = public
as $function$
  select exists (
    select 1 from public.agreement_group_members
     where agreement_group_id = p_group_id
       and user_id = p_user_id
       and valid_until is null
  );
$function$;

create or replace function public.is_agreement_group_admin(p_group_id uuid, p_user_id uuid)
 returns boolean language sql stable security definer set search_path = public
as $function$
  select exists (
    select 1 from public.agreement_group_members
     where agreement_group_id = p_group_id
       and user_id = p_user_id
       and role = 'agreement_group_admin'
       and valid_until is null
  );
$function$;

create or replace function public.prevent_last_group_admin_removal()
 returns trigger language plpgsql security definer set search_path = public
as $function$
declare
  v_count int;
  becoming_closed boolean;
begin
  -- Cascade: si el agrupador padre está siendo eliminado, permitir.
  if tg_op = 'DELETE'
     and not exists (select 1 from public.agreement_groups where id = old.agreement_group_id) then
    return old;
  end if;

  becoming_closed := (tg_op = 'UPDATE'
                      and old.valid_until is null
                      and new.valid_until is not null);

  if (tg_op = 'DELETE'   and old.role = 'agreement_group_admin' and old.valid_until is null)
     or (becoming_closed and old.role = 'agreement_group_admin')
     or (tg_op = 'UPDATE' and old.role = 'agreement_group_admin'
         and new.role <> 'agreement_group_admin'
         and old.valid_until is null
         and new.valid_until is null) then
    select count(*) into v_count
      from public.agreement_group_members
     where agreement_group_id = old.agreement_group_id
       and role = 'agreement_group_admin'
       and valid_until is null
       and id <> old.id;
    if v_count = 0 then
      raise exception 'No se puede eliminar el último agreement_group_admin del agrupador.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

create or replace function public.add_creator_as_group_admin()
 returns trigger language plpgsql security definer set search_path = public
as $function$
begin
  if new.created_by is not null then
    insert into public.agreement_group_members
      (agreement_group_id, user_id, role, assigned_by, started_by)
    values
      (new.id, new.created_by, 'agreement_group_admin', new.created_by, new.created_by)
    on conflict (agreement_group_id, user_id) where valid_until is null do nothing;
  end if;
  return new;
end;
$function$;

-- -----------------------------------------------------------------------------
-- 5) Vista agreements_with_counts: companies_count filtra períodos abiertos.
-- -----------------------------------------------------------------------------

create or replace view public.agreements_with_counts as
 SELECT a.id,
    a.group_id,
    g.group_name,
    g.client_id AS group_client_id,
    gc.commercial_name AS group_client_commercial_name,
    gc.legal_name AS group_client_legal_name,
    gc.tax_id AS group_client_tax_id,
    a.name,
    a.scope,
    a.unit_name,
    a.status,
    a.start_date,
    a.end_date,
    a.observations,
    a.created_at,
    a.updated_at,
    a.created_by,
    ( SELECT am.role
           FROM agreement_members am
          WHERE am.agreement_id = a.id AND am.user_id = auth.uid() AND am.valid_until IS NULL
         LIMIT 1) AS my_role,
    COALESCE(counts.total, 0::bigint) AS lines_total,
    COALESCE(counts.active, 0::bigint) AS lines_active,
    COALESCE(counts.pending, 0::bigint) AS lines_pending,
    COALESCE(counts.review, 0::bigint) AS lines_review,
    COALESCE(counts.excluded, 0::bigint) AS lines_excluded,
    COALESCE(( SELECT count(*) AS count
           FROM agreement_members am2
          WHERE am2.agreement_id = a.id AND am2.valid_until IS NULL), 0::bigint) AS members_count,
    COALESCE(( SELECT count(*) AS count
           FROM agreement_companies ac
          WHERE ac.agreement_id = a.id AND ac.valid_until IS NULL), 0::bigint) AS companies_count
   FROM agreements a
     LEFT JOIN agreement_groups g ON g.id = a.group_id
     LEFT JOIN clients gc ON gc.id = g.client_id
     LEFT JOIN LATERAL ( SELECT count(*) FILTER (WHERE agreement_products.status <> 'excluded'::text) AS total,
            count(*) FILTER (WHERE agreement_products.status = 'active'::text) AS active,
            count(*) FILTER (WHERE agreement_products.status = 'pending'::text) AS pending,
            count(*) FILTER (WHERE agreement_products.status = 'requires_review'::text) AS review,
            count(*) FILTER (WHERE agreement_products.status = 'excluded'::text) AS excluded
           FROM agreement_products
          WHERE agreement_products.agreement_id = a.id) counts ON true;

-- -----------------------------------------------------------------------------
-- 6) RLS: cerrar hueco "empresa cerrada seguiría autorizando altas".
-- -----------------------------------------------------------------------------

drop policy if exists am_insert on public.agreement_members;
create policy am_insert on public.agreement_members
  for insert to authenticated
  with check (
    is_super_admin() OR (
      can_admin_agreement(agreement_id)
      AND EXISTS (
        SELECT 1 FROM public.agreement_companies ac
         WHERE ac.agreement_id = agreement_members.agreement_id
           AND ac.valid_until IS NULL
           AND user_has_client_access(agreement_members.user_id, ac.client_id)
      )
    )
  );

drop policy if exists am_update on public.agreement_members;
create policy am_update on public.agreement_members
  for update to authenticated
  using (is_super_admin() OR can_admin_agreement(agreement_id))
  with check (
    is_super_admin() OR (
      can_admin_agreement(agreement_id)
      AND EXISTS (
        SELECT 1 FROM public.agreement_companies ac
         WHERE ac.agreement_id = agreement_members.agreement_id
           AND ac.valid_until IS NULL
           AND user_has_client_access(agreement_members.user_id, ac.client_id)
      )
    )
  );

drop policy if exists uca_insert on public.user_client_access;
create policy uca_insert on public.user_client_access
  for insert to authenticated
  with check (
    is_super_admin() OR (
      can_create_agreements = false
      AND can_manage_client_catalog = false
      AND can_manage_matching = false
      AND EXISTS (
        SELECT 1 FROM public.agreement_companies ac
         WHERE ac.client_id = user_client_access.client_id
           AND ac.valid_until IS NULL
           AND can_admin_agreement(ac.agreement_id)
      )
    )
  );
