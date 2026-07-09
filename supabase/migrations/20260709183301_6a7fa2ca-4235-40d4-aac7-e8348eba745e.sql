-- 1. Backfill: keep only the most recent open row per client_product_id
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY client_product_id ORDER BY created_at DESC, id DESC) AS rn
    FROM public.client_product_history
   WHERE valid_until IS NULL
)
UPDATE public.client_product_history cph
   SET valid_until = current_date
  FROM ranked
 WHERE cph.id = ranked.id
   AND ranked.rn > 1;

-- 2. Unique partial index (one open period per client_product_id)
CREATE UNIQUE INDEX IF NOT EXISTS client_product_history_one_open_per_cp
  ON public.client_product_history (client_product_id)
  WHERE valid_until IS NULL;

-- 3. _resolve_client_code: close current open period before inserting new one
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
        order by cph.valid_from desc, cph.created_at desc limit 1
     ) then
    update public.client_product_history
       set valid_until = current_date
     where client_product_id = v_cp
       and valid_until is null;

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

-- 4. _validate_client_codes (3-arg): deterministic tiebreaker
CREATE OR REPLACE FUNCTION public._validate_client_codes(p_agreement_id uuid, p_codes jsonb, p_position_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
-- NOTA DE MANTENIMIENTO:
-- La rama "sin cambios" compara el código entrante y la descripción entrante
-- contra lo vigente hoy en (p_position_id, client_id). Hoy _resolve_client_code
-- solo escribe client_code y description; si en el futuro _resolve_client_code
-- persiste campos adicionales para el par (posición, cliente), esos campos
-- DEBEN sumarse a esta comparación. De lo contrario, podrían modificarse sin
-- exigir can_manage_client_catalog sobre el cliente afectado.
declare
  v_norm jsonb;
  v_client_id uuid;
  v_in_code text;
  v_in_desc text;
  v_cur_code text;
  v_cur_desc text;
  v_unchanged boolean;
  r jsonb;
begin
  select coalesce(jsonb_agg(e), '[]'::jsonb) into v_norm
    from jsonb_array_elements(coalesce(p_codes, '[]'::jsonb)) e
   where nullif(trim(coalesce(e->>'client_code','')),'') is not null
     and (e->>'client_id') is not null;

  if (select count(*) <> count(distinct e->>'client_id') from jsonb_array_elements(v_norm) e) then
    raise exception 'Un mismo cliente aparece dos veces en la lista de códigos' using errcode='23505';
  end if;

  for r in select * from jsonb_array_elements(v_norm) loop
    v_client_id := (r->>'client_id')::uuid;
    if not exists (
      select 1 from public.agreement_companies
       where agreement_id=p_agreement_id and client_id=v_client_id and valid_until is null
    ) then
      raise exception 'El cliente % no está vinculado a este acuerdo', v_client_id using errcode='23503';
    end if;

    v_unchanged := false;
    if p_position_id is not null then
      v_in_code := nullif(trim(coalesce(r->>'client_code','')),'');
      v_in_desc := r->>'description';
      v_cur_code := null;
      v_cur_desc := null;

      select cp.client_code, apcc.client_product_id
        into v_cur_code, v_cur_desc
        from public.agreement_position_client_codes apcc
        join public.client_products cp on cp.id = apcc.client_product_id
       where apcc.agreement_position_id = p_position_id
         and apcc.client_id = v_client_id
         and apcc.valid_until is null
       limit 1;

      if v_cur_code is not null then
        select cph.description into v_cur_desc
          from public.agreement_position_client_codes apcc
          join public.client_product_history cph on cph.client_product_id = apcc.client_product_id
         where apcc.agreement_position_id = p_position_id
           and apcc.client_id = v_client_id
           and apcc.valid_until is null
           and cph.valid_until is null
         order by cph.valid_from desc, cph.created_at desc
         limit 1;

        if v_cur_code = v_in_code and v_cur_desc is not distinct from v_in_desc then
          v_unchanged := true;
        end if;
      end if;
    end if;

    if not v_unchanged then
      if not public.can_manage_client_catalog(v_client_id) then
        raise exception 'Sin permiso can_manage_client_catalog sobre el cliente %', v_client_id using errcode='42501';
      end if;
    end if;
  end loop;
  return v_norm;
end $function$;