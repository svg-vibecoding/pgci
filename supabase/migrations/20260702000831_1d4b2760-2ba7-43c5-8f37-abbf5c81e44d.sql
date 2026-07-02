
-- ============================================================
-- 1.1 Crear tabla agreement_groups (sin políticas todavía)
-- ============================================================
CREATE TABLE public.agreement_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name text NOT NULL,
  client_id uuid NULL REFERENCES public.clients(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agreement_groups_client_id_idx ON public.agreement_groups(client_id);
CREATE INDEX agreement_groups_status_idx    ON public.agreement_groups(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agreement_groups TO authenticated;
GRANT ALL ON public.agreement_groups TO service_role;

ALTER TABLE public.agreement_groups ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_agreement_groups_updated_at
  BEFORE UPDATE ON public.agreement_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 1.2 + 1.3 agreements.group_id + backfill 1 grupo por acuerdo
-- ============================================================
ALTER TABLE public.agreements
  ADD COLUMN group_id uuid NULL REFERENCES public.agreement_groups(id) ON DELETE RESTRICT;

DO $$
DECLARE
  r record;
  v_group_id uuid;
  v_name     text;
BEGIN
  FOR r IN SELECT a.id AS agreement_id, a.client_id,
                  COALESCE(NULLIF(TRIM(c.commercial_name), ''), c.legal_name) AS grp_name
             FROM public.agreements a
             JOIN public.clients c ON c.id = a.client_id
  LOOP
    v_name := COALESCE(NULLIF(TRIM(r.grp_name), ''), 'Grupo sin nombre');
    INSERT INTO public.agreement_groups (group_name, client_id)
    VALUES (v_name, r.client_id)
    RETURNING id INTO v_group_id;

    UPDATE public.agreements SET group_id = v_group_id WHERE id = r.agreement_id;
  END LOOP;
END$$;

DO $$
DECLARE v_missing int;
BEGIN
  SELECT count(*) INTO v_missing FROM public.agreements WHERE group_id IS NULL;
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'Backfill agreements.group_id incompleto: % filas sin grupo', v_missing;
  END IF;
END$$;

ALTER TABLE public.agreements ALTER COLUMN group_id SET NOT NULL;
CREATE INDEX agreements_group_id_idx ON public.agreements(group_id);

-- Ahora sí las políticas de agreement_groups (group_id ya existe en agreements).
CREATE POLICY ag_select ON public.agreement_groups FOR SELECT
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.agreements a
       WHERE a.group_id = agreement_groups.id
         AND public.can_access_agreement(a.id)
    )
    OR (client_id IS NOT NULL AND public.has_client_access(client_id))
  );
CREATE POLICY ag_insert ON public.agreement_groups FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR (client_id IS NOT NULL AND public.can_create_agreements_for_client(client_id))
  );
CREATE POLICY ag_update ON public.agreement_groups FOR UPDATE
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY ag_delete ON public.agreement_groups FOR DELETE
  USING (public.is_super_admin());

-- ============================================================
-- 1.4 + 1.5 agreement_companies: FK real a clients, backfill
-- ============================================================
ALTER TABLE public.agreement_companies
  ADD COLUMN client_id uuid NULL REFERENCES public.clients(id) ON DELETE RESTRICT;

DO $$
DECLARE
  v_unresolved int;
  v_detail     text;
BEGIN
  UPDATE public.agreement_companies ac
     SET client_id = c.id
    FROM public.clients c
   WHERE c.tax_id = ac.tax_id
     AND ac.client_id IS NULL;

  SELECT count(*), string_agg(DISTINCT ac.tax_id, ', ')
    INTO v_unresolved, v_detail
    FROM public.agreement_companies ac
   WHERE ac.client_id IS NULL;

  IF v_unresolved > 0 THEN
    RAISE EXCEPTION 'agreement_companies: % filas sin client_id resoluble. tax_id no encontrados en clients: %',
      v_unresolved, v_detail;
  END IF;
END$$;

INSERT INTO public.agreement_companies (agreement_id, client_id, tax_id, tax_id_type, legal_name)
SELECT a.id, c.id, c.tax_id, c.tax_id_type, c.legal_name
  FROM public.agreements a
  JOIN public.clients c ON c.id = a.client_id
 WHERE NOT EXISTS (
         SELECT 1 FROM public.agreement_companies ac
          WHERE ac.agreement_id = a.id AND ac.client_id = c.id
       );

ALTER TABLE public.agreement_companies ALTER COLUMN client_id SET NOT NULL;

ALTER TABLE public.agreement_companies
  DROP CONSTRAINT agreement_companies_agreement_id_tax_id_tax_id_type_key;

ALTER TABLE public.agreement_companies
  ADD CONSTRAINT agreement_companies_agreement_id_client_id_key UNIQUE (agreement_id, client_id);

CREATE INDEX agreement_companies_client_id_idx ON public.agreement_companies(client_id);

ALTER TABLE public.agreement_companies
  DROP COLUMN tax_id,
  DROP COLUMN tax_id_type,
  DROP COLUMN legal_name;

-- ============================================================
-- Reescritura de funciones dependientes de agreements.client_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_agreement_client_id(p_agreement_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT client_id FROM public.agreement_companies
   WHERE agreement_id = p_agreement_id
   ORDER BY created_at ASC
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_agreement(p_user_id uuid, p_agreement_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
         AND p.status = 'active'
         AND EXISTS (
           SELECT 1 FROM public.agreement_companies ac
            WHERE ac.agreement_id = p_agreement_id
              AND public.user_has_client_access(p_user_id, ac.client_id)
         )
    );
$$;

CREATE OR REPLACE FUNCTION public.get_agreement_role(p_agreement_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE WHEN public.is_super_admin() THEN 'super_admin'
    ELSE (
      SELECT am.role FROM public.agreement_members am
        JOIN public.profiles p ON p.user_id = am.user_id
       WHERE am.agreement_id = p_agreement_id
         AND am.user_id = auth.uid()
         AND p.status = 'active'
         AND EXISTS (
           SELECT 1 FROM public.agreement_companies ac
            WHERE ac.agreement_id = p_agreement_id
              AND public.user_has_client_access(auth.uid(), ac.client_id)
         )
       LIMIT 1
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_view_costs(p_agreement_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.agreement_members am
      JOIN public.profiles p ON p.user_id = am.user_id
     WHERE am.agreement_id = p_agreement_id
       AND am.user_id = auth.uid()
       AND am.can_view_costs = true
       AND p.status = 'active'
       AND EXISTS (
         SELECT 1 FROM public.agreement_companies ac
          WHERE ac.agreement_id = p_agreement_id
            AND public.user_has_client_access(auth.uid(), ac.client_id)
       )
  );
$$;

CREATE OR REPLACE FUNCTION public.commit_agreement_import(p_agreement_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
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

-- ============================================================
-- Vista, políticas y trigger dependientes → drop y recreate
-- ============================================================
DROP VIEW IF EXISTS public.agreements_with_counts;

DROP TRIGGER IF EXISTS trg_check_agreement_client_access ON public.agreements;
DROP FUNCTION IF EXISTS public.check_agreement_client_access();

DROP POLICY IF EXISTS agreements_insert ON public.agreements;
CREATE POLICY agreements_insert ON public.agreements FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 1.6 Drop agreements.client_id
ALTER TABLE public.agreements DROP COLUMN client_id;

-- 1.7 Recrear vista agreements_with_counts
CREATE VIEW public.agreements_with_counts AS
SELECT a.id,
       a.group_id,
       g.group_name,
       g.client_id AS group_client_id,
       gc.commercial_name AS group_client_commercial_name,
       gc.legal_name      AS group_client_legal_name,
       gc.tax_id          AS group_client_tax_id,
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
       ( SELECT am.role FROM public.agreement_members am
          WHERE am.agreement_id = a.id AND am.user_id = auth.uid()
          LIMIT 1) AS my_role,
       COALESCE(counts.total,    0::bigint) AS lines_total,
       COALESCE(counts.active,   0::bigint) AS lines_active,
       COALESCE(counts.pending,  0::bigint) AS lines_pending,
       COALESCE(counts.review,   0::bigint) AS lines_review,
       COALESCE(counts.excluded, 0::bigint) AS lines_excluded,
       COALESCE((SELECT count(*) FROM public.agreement_members am2
                  WHERE am2.agreement_id = a.id), 0::bigint) AS members_count,
       COALESCE((SELECT count(*) FROM public.agreement_companies ac
                  WHERE ac.agreement_id = a.id), 0::bigint) AS companies_count
  FROM public.agreements a
  JOIN public.agreement_groups g ON g.id = a.group_id
  LEFT JOIN public.clients gc ON gc.id = g.client_id
  LEFT JOIN LATERAL (
     SELECT count(*) FILTER (WHERE agreement_products.status <> 'excluded') AS total,
            count(*) FILTER (WHERE agreement_products.status = 'active')    AS active,
            count(*) FILTER (WHERE agreement_products.status = 'pending')   AS pending,
            count(*) FILTER (WHERE agreement_products.status = 'requires_review') AS review,
            count(*) FILTER (WHERE agreement_products.status = 'excluded')  AS excluded
       FROM public.agreement_products
      WHERE agreement_products.agreement_id = a.id
  ) counts ON true;

GRANT SELECT ON public.agreements_with_counts TO authenticated;
GRANT ALL    ON public.agreements_with_counts TO service_role;
