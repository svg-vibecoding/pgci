begin;

-- ============================================================
-- BLOQUE A · Retiro del modelo de código único
-- ============================================================
drop index if exists public.agreement_positions_identity_with_cp_uq;
drop index if exists public.agreement_positions_identity_no_cp_uq;
drop index if exists public.idx_agreement_positions_client_product_id;
alter table public.agreement_positions
  drop constraint if exists agreement_positions_client_product_id_fkey;
alter table public.agreement_positions
  drop column if exists client_product_id,
  drop column if exists client_product_match_id;

drop index if exists public.idx_agreement_transit_lines_agreement_cp;
alter table public.agreement_transit_lines
  drop constraint if exists transit_capturable;
alter table public.agreement_transit_lines
  drop constraint if exists agreement_transit_lines_client_product_id_fkey;
alter table public.agreement_transit_lines
  drop column if exists client_product_id;

-- ============================================================
-- BLOQUE B · agreement_position_client_codes
-- ============================================================
create table public.agreement_position_client_codes (
  id                      uuid        primary key default gen_random_uuid(),
  agreement_position_id   uuid        not null references public.agreement_positions(id) on delete cascade,
  agreement_id            uuid        not null references public.agreements(id) on delete cascade,
  client_id               uuid        not null references public.clients(id) on delete restrict,
  client_product_id       uuid        not null references public.client_products(id) on delete restrict,
  client_product_match_id uuid                 references public.client_product_match(id) on delete restrict,
  valid_from              timestamptz not null default now(),
  valid_until             timestamptz,
  started_by              uuid                 references auth.users(id) on delete set null,
  ended_by                uuid                 references auth.users(id) on delete set null,
  ended_reason            text,
  constraint apcc_period_valid       check (valid_until is null or valid_until >= valid_from),
  constraint apcc_closure_consistent check ((valid_until is null) = (ended_by is null))
);
grant select, insert, update, delete on public.agreement_position_client_codes to authenticated;
grant all on public.agreement_position_client_codes to service_role;

-- ============================================================
-- BLOQUE C · agreement_transit_client_codes (NO se recrea transit_capturable)
-- ============================================================
create table public.agreement_transit_client_codes (
  id                      uuid        primary key default gen_random_uuid(),
  agreement_transit_id    uuid        not null references public.agreement_transit_lines(id) on delete cascade,
  agreement_id            uuid        not null references public.agreements(id) on delete cascade,
  client_id               uuid        not null references public.clients(id) on delete restrict,
  client_product_id       uuid        not null references public.client_products(id) on delete restrict,
  client_product_match_id uuid                 references public.client_product_match(id) on delete restrict,
  valid_from              timestamptz not null default now(),
  valid_until             timestamptz,
  started_by              uuid                 references auth.users(id) on delete set null,
  ended_by                uuid                 references auth.users(id) on delete set null,
  ended_reason            text,
  constraint atcc_period_valid       check (valid_until is null or valid_until >= valid_from),
  constraint atcc_closure_consistent check ((valid_until is null) = (ended_by is null))
);
grant select, insert, update, delete on public.agreement_transit_client_codes to authenticated;
grant all on public.agreement_transit_client_codes to service_role;

-- ============================================================
-- BLOQUE D · Índices
-- ============================================================
create unique index apcc_position_client_open_uq
  on public.agreement_position_client_codes (agreement_position_id, client_id)
  where valid_until is null;
create unique index atcc_transit_client_open_uq
  on public.agreement_transit_client_codes (agreement_transit_id, client_id)
  where valid_until is null;
create unique index apcc_agreement_client_product_open_uq
  on public.agreement_position_client_codes (agreement_id, client_product_id)
  where valid_until is null;
create index idx_apcc_position       on public.agreement_position_client_codes (agreement_position_id);
create index idx_apcc_client         on public.agreement_position_client_codes (client_id) where valid_until is null;
create index idx_apcc_client_product on public.agreement_position_client_codes (client_product_id);
create index idx_atcc_transit        on public.agreement_transit_client_codes (agreement_transit_id);
create index idx_atcc_client         on public.agreement_transit_client_codes (client_id) where valid_until is null;

-- ============================================================
-- BLOQUE E · Triggers de invariantes
-- ============================================================
create or replace function public.check_apcc_denormalization()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_agreement_id uuid; v_client_id uuid;
begin
  if tg_op = 'UPDATE' then
    if new.agreement_position_id <> old.agreement_position_id
       or new.agreement_id <> old.agreement_id
       or new.client_id <> old.client_id
       or new.client_product_id <> old.client_product_id then
      raise exception 'La identidad de la relación no puede cambiar. Cierre el período y abra uno nuevo.'
        using errcode='23514';
    end if;
    return new;
  end if;
  select ap.agreement_id into v_agreement_id
    from public.agreement_positions ap where ap.id=new.agreement_position_id;
  if v_agreement_id is null or v_agreement_id<>new.agreement_id then
    raise exception 'agreement_id no corresponde a la posición referenciada' using errcode='23514';
  end if;
  select cp.client_id into v_client_id
    from public.client_products cp where cp.id=new.client_product_id;
  if v_client_id is null or v_client_id<>new.client_id then
    raise exception 'client_id no corresponde al código de cliente referenciado' using errcode='23514';
  end if;
  return new;
end $fn$;
create trigger check_apcc_denormalization_trigger
  before insert or update on public.agreement_position_client_codes
  for each row execute function public.check_apcc_denormalization();

create or replace function public.check_atcc_denormalization()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_agreement_id uuid; v_client_id uuid;
begin
  if tg_op = 'UPDATE' then
    if new.agreement_transit_id <> old.agreement_transit_id
       or new.agreement_id <> old.agreement_id
       or new.client_id <> old.client_id
       or new.client_product_id <> old.client_product_id then
      raise exception 'La identidad de la relación no puede cambiar. Cierre el período y abra uno nuevo.'
        using errcode='23514';
    end if;
    return new;
  end if;
  select atl.agreement_id into v_agreement_id
    from public.agreement_transit_lines atl where atl.id=new.agreement_transit_id;
  if v_agreement_id is null or v_agreement_id<>new.agreement_id then
    raise exception 'agreement_id no corresponde a la línea en tránsito referenciada' using errcode='23514';
  end if;
  select cp.client_id into v_client_id
    from public.client_products cp where cp.id=new.client_product_id;
  if v_client_id is null or v_client_id<>new.client_id then
    raise exception 'client_id no corresponde al código de cliente referenciado' using errcode='23514';
  end if;
  return new;
end $fn$;
create trigger check_atcc_denormalization_trigger
  before insert or update on public.agreement_transit_client_codes
  for each row execute function public.check_atcc_denormalization();

create or replace function public.check_position_identity_without_codes()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_conflict_id uuid;
begin
  if new.status = 'excluded' then return new; end if;
  if exists (
    select 1 from public.agreement_position_client_codes
     where agreement_position_id=new.id and valid_until is null
  ) then return new; end if;
  select ap.id into v_conflict_id
    from public.agreement_positions ap
   where ap.agreement_id=new.agreement_id
     and ap.product_id=new.product_id
     and ap.id<>new.id
     and ap.status<>'excluded'
     and not exists (
       select 1 from public.agreement_position_client_codes apcc
        where apcc.agreement_position_id=ap.id and apcc.valid_until is null
     )
   limit 1;
  if v_conflict_id is not null then
    raise exception 'Ya existe una posición de este SKU sin código de cliente en el acuerdo. Un SKU no se repite sin un código que lo distinga.'
      using errcode='23505';
  end if;
  return new;
end $fn$;
create trigger check_position_identity_without_codes_trigger
  after insert or update of product_id, status on public.agreement_positions
  for each row execute function public.check_position_identity_without_codes();

-- ============================================================
-- BLOQUE F · RLS
-- ============================================================
alter table public.agreement_transit_lines             enable row level security;
alter table public.agreement_position_price_history    enable row level security;
alter table public.agreement_position_exclusions       enable row level security;
alter table public.agreement_position_client_codes     enable row level security;
alter table public.agreement_transit_client_codes      enable row level security;

drop policy if exists atl_select on public.agreement_transit_lines;
create policy atl_select on public.agreement_transit_lines
  for select to authenticated using ( public.can_access_agreement(agreement_id) );
drop policy if exists atl_write on public.agreement_transit_lines;
create policy atl_write on public.agreement_transit_lines
  for all to authenticated
  using ( public.can_admin_agreement(agreement_id) )
  with check ( public.can_admin_agreement(agreement_id) );

drop policy if exists apph_select on public.agreement_position_price_history;
create policy apph_select on public.agreement_position_price_history
  for select to authenticated using (
    exists (select 1 from public.agreement_positions ap
             where ap.id=agreement_position_price_history.position_id
               and public.can_access_agreement(ap.agreement_id))
  );

drop policy if exists ape_select on public.agreement_position_exclusions;
create policy ape_select on public.agreement_position_exclusions
  for select to authenticated using (
    exists (select 1 from public.agreement_positions ap
             where ap.id=agreement_position_exclusions.position_id
               and public.can_access_agreement(ap.agreement_id))
  );

drop policy if exists apcc_select on public.agreement_position_client_codes;
create policy apcc_select on public.agreement_position_client_codes
  for select to authenticated
  using ( public.can_access_agreement(agreement_id) and public.has_client_access(client_id) );
drop policy if exists apcc_insert on public.agreement_position_client_codes;
create policy apcc_insert on public.agreement_position_client_codes
  for insert to authenticated
  with check ( public.can_admin_agreement(agreement_id) and public.can_manage_client_catalog(client_id) );
drop policy if exists apcc_update on public.agreement_position_client_codes;
create policy apcc_update on public.agreement_position_client_codes
  for update to authenticated
  using      ( public.can_admin_agreement(agreement_id) and public.can_manage_client_catalog(client_id) )
  with check ( public.can_admin_agreement(agreement_id) and public.can_manage_client_catalog(client_id) );

drop policy if exists atcc_select on public.agreement_transit_client_codes;
create policy atcc_select on public.agreement_transit_client_codes
  for select to authenticated
  using ( public.can_access_agreement(agreement_id) and public.has_client_access(client_id) );
drop policy if exists atcc_insert on public.agreement_transit_client_codes;
create policy atcc_insert on public.agreement_transit_client_codes
  for insert to authenticated
  with check ( public.can_admin_agreement(agreement_id) and public.can_manage_client_catalog(client_id) );
drop policy if exists atcc_update on public.agreement_transit_client_codes;
create policy atcc_update on public.agreement_transit_client_codes
  for update to authenticated
  using      ( public.can_admin_agreement(agreement_id) and public.can_manage_client_catalog(client_id) )
  with check ( public.can_admin_agreement(agreement_id) and public.can_manage_client_catalog(client_id) );
drop policy if exists atcc_delete on public.agreement_transit_client_codes;
create policy atcc_delete on public.agreement_transit_client_codes
  for delete to authenticated
  using ( public.can_admin_agreement(agreement_id) and public.can_manage_client_catalog(client_id) );

-- ============================================================
-- BLOQUE G · Funciones
-- ============================================================

-- G.0 · Validar y normalizar la lista client_codes (L-1..L-4)
create or replace function public._validate_client_codes(
  p_agreement_id uuid, p_codes jsonb
) returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
  v_norm jsonb;
  v_client_id uuid;
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
    if not public.can_manage_client_catalog(v_client_id) then
      raise exception 'Sin permiso can_manage_client_catalog sobre el cliente %', v_client_id using errcode='42501';
    end if;
  end loop;
  return v_norm;
end $fn$;

-- G.0.b · Resolver/crear (client_product, match); historia solo si cambió
create or replace function public._resolve_client_code(
  p_client_id uuid, p_client_code text, p_description text,
  p_product_id uuid, p_source text
) returns table(client_product_id uuid, client_product_match_id uuid)
language plpgsql security definer set search_path = public
as $fn$
declare v_cp uuid; v_match uuid;
begin
  insert into public.client_products (client_id, client_code, created_by)
       values (p_client_id, p_client_code, auth.uid())
  on conflict (client_id, client_code) do update set client_code=excluded.client_code
  returning id into v_cp;

  if p_description is not null
     and p_description is distinct from (
       select description from public.client_product_history
        where client_product_id = v_cp
        order by valid_from desc limit 1
     ) then
    insert into public.client_product_history (client_product_id, description, valid_from)
    values (v_cp, p_description, current_date);
  end if;

  if p_product_id is not null then
    select id into v_match from public.client_product_match
     where client_product_id=v_cp and product_id=p_product_id limit 1;
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
end $fn$;

-- ============================================================
-- G.1 · create_agreement_line
-- ============================================================
create or replace function public.create_agreement_line(
  p_agreement_id uuid, p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
  v_user uuid := auth.uid();
  v_agr_start date; v_agr_end date;
  v_sku text; v_product_id uuid;
  v_description text;
  v_sale_price numeric; v_par_price numeric;
  v_start_date date; v_end_date date;
  v_eff_start date; v_eff_end date;
  v_observations text;
  v_codes jsonb;
  v_is_position boolean;
  v_line_id uuid;
  v_cp uuid; v_match uuid;
  v_conflict_pos uuid; v_conflict_sku text;
  v_client_id uuid; v_client_code text; v_row_desc text;
  r jsonb;
begin
  if not public.can_admin_agreement(p_agreement_id) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  select start_date, end_date into v_agr_start, v_agr_end
    from public.agreements where id=p_agreement_id;

  v_sku          := nullif(trim(coalesce(p_payload->>'sku','')),'');
  v_description  := nullif(trim(coalesce(p_payload->>'description','')),'');
  v_sale_price   := nullif(p_payload->>'sale_price','')::numeric;
  v_par_price    := nullif(p_payload->>'par_price','')::numeric;
  v_start_date   := nullif(p_payload->>'start_date','')::date;
  v_end_date     := nullif(p_payload->>'end_date','')::date;
  v_observations := nullif(trim(coalesce(p_payload->>'observations','')),'');

  v_codes := public._validate_client_codes(p_agreement_id, p_payload->'client_codes');

  if v_sku is null and v_description is null and jsonb_array_length(v_codes) = 0 then
    raise exception 'La línea no tiene nada que capturar: falta SKU, descripción o al menos un código de cliente válido'
      using errcode='23514';
  end if;

  if v_sku is not null then
    select id into v_product_id from public.products where sku=v_sku limit 1;
    if v_product_id is null then
      raise exception 'SKU % no existe en el catálogo', v_sku using errcode='P0002';
    end if;
  end if;

  v_eff_start := coalesce(v_start_date, v_agr_start);
  v_eff_end   := coalesce(v_end_date,   v_agr_end);
  v_is_position := v_product_id is not null
                   and v_sale_price is not null and v_sale_price > 0
                   and v_eff_start is not null and v_eff_end is not null;

  if v_is_position then
    for r in select * from jsonb_array_elements(v_codes) loop
      v_client_id   := (r->>'client_id')::uuid;
      v_client_code := trim(r->>'client_code');
      select id into v_cp from public.client_products
       where client_id=v_client_id and client_code=v_client_code;
      if v_cp is not null then
        v_conflict_pos := null; v_conflict_sku := null;
        select apcc.agreement_position_id, p.sku
          into v_conflict_pos, v_conflict_sku
          from public.agreement_position_client_codes apcc
          join public.agreement_positions ap on ap.id=apcc.agreement_position_id
          left join public.products p on p.id=ap.product_id
         where apcc.agreement_id=p_agreement_id
           and apcc.client_product_id=v_cp
           and apcc.valid_until is null;
        if v_conflict_pos is not null then
          raise exception 'El código % (cliente %) ya está fijado al SKU % en otra posición del acuerdo (RN-MATCH-01)',
            v_client_code, v_client_id, coalesce(v_conflict_sku,'<sin SKU>') using errcode='23505';
        end if;
      end if;
    end loop;

    insert into public.agreement_positions
      (agreement_id, product_id, sale_price, par_price, start_date, end_date,
       observations, status, created_by, updated_by)
    values
      (p_agreement_id, v_product_id, v_sale_price, v_par_price, v_start_date, v_end_date,
       v_observations, 'excluded', v_user, v_user)
    returning id into v_line_id;

    for r in select * from jsonb_array_elements(v_codes) loop
      v_client_id   := (r->>'client_id')::uuid;
      v_client_code := trim(r->>'client_code');
      v_row_desc    := nullif(trim(coalesce(r->>'description','')),'');
      select client_product_id, client_product_match_id into v_cp, v_match
        from public._resolve_client_code(v_client_id, v_client_code, v_row_desc,
                                         v_product_id, 'manual');
      insert into public.agreement_position_client_codes
        (agreement_position_id, agreement_id, client_id, client_product_id,
         client_product_match_id, started_by)
      values (v_line_id, p_agreement_id, v_client_id, v_cp, v_match, v_user);
    end loop;

    update public.agreement_positions set status='active' where id=v_line_id;

    return jsonb_build_object('line_id', v_line_id, 'kind', 'position');
  end if;

  insert into public.agreement_transit_lines
    (agreement_id, product_id, sku_raw, description, sale_price, par_price,
     start_date, end_date, observations, pending_reason, created_by, updated_by)
  values
    (p_agreement_id, v_product_id, v_sku, v_description,
     v_sale_price, v_par_price, v_start_date, v_end_date, v_observations,
     array_to_string(array_remove(array[
       case when v_product_id is null then 'no_sku' end,
       case when v_sale_price is null or v_sale_price<=0 then 'no_price' end,
       case when v_eff_start is null or v_eff_end is null then 'no_dates' end
     ], null), ','),
     v_user, v_user)
  returning id into v_line_id;

  for r in select * from jsonb_array_elements(v_codes) loop
    v_client_id   := (r->>'client_id')::uuid;
    v_client_code := trim(r->>'client_code');
    v_row_desc    := nullif(trim(coalesce(r->>'description','')),'');
    select client_product_id, client_product_match_id into v_cp, v_match
      from public._resolve_client_code(v_client_id, v_client_code, v_row_desc,
                                       v_product_id, 'manual');
    insert into public.agreement_transit_client_codes
      (agreement_transit_id, agreement_id, client_id, client_product_id,
       client_product_match_id, started_by)
    values (v_line_id, p_agreement_id, v_client_id, v_cp, v_match, v_user);
  end loop;

  return jsonb_build_object('line_id', v_line_id, 'kind', 'transit');
end $fn$;

-- ============================================================
-- G.2 · update_agreement_line
-- ============================================================
create or replace function public.update_agreement_line(
  p_line_id uuid, p_kind text, p_patch jsonb, p_confirm_n_conflict boolean default false
) returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
  v_user uuid := auth.uid();
  v_agreement_id uuid;
  v_agr_start date; v_agr_end date;
  v_row_pos public.agreement_positions%rowtype;
  v_row_tr  public.agreement_transit_lines%rowtype;
  v_has_sku    boolean := p_patch ? 'sku';
  v_has_price  boolean := p_patch ? 'sale_price';
  v_has_par    boolean := p_patch ? 'par_price';
  v_has_start  boolean := p_patch ? 'start_date';
  v_has_end    boolean := p_patch ? 'end_date';
  v_has_obs    boolean := p_patch ? 'observations';
  v_has_codes  boolean := p_patch ? 'client_codes';
  v_sku text; v_new_product_id uuid;
  v_sale_price numeric; v_par_price numeric;
  v_start_date date; v_end_date date;
  v_observations text;
  v_codes jsonb;
  v_desired_ids uuid[];
  v_client_id uuid; v_client_code text; v_row_desc text;
  v_cp uuid; v_match uuid;
  v_open_id uuid; v_open_cp uuid;
  v_conflict_pos uuid; v_conflict_sku text;
  v_eff_start date; v_eff_end date;
  v_promoted_id uuid;
  r jsonb;
begin
  if p_kind not in ('position','transit') then
    raise exception 'p_kind inválido' using errcode='22023';
  end if;
  if p_kind='position' then
    select * into v_row_pos from public.agreement_positions where id=p_line_id;
    if not found then raise exception 'Posición no encontrada' using errcode='P0002'; end if;
    v_agreement_id := v_row_pos.agreement_id;
  else
    select * into v_row_tr from public.agreement_transit_lines where id=p_line_id;
    if not found then raise exception 'Línea en tránsito no encontrada' using errcode='P0002'; end if;
    v_agreement_id := v_row_tr.agreement_id;
  end if;
  if not public.can_admin_agreement(v_agreement_id) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  select start_date, end_date into v_agr_start, v_agr_end
    from public.agreements where id=v_agreement_id;

  if v_has_sku   then v_sku          := nullif(trim(coalesce(p_patch->>'sku','')),''); end if;
  if v_has_price then v_sale_price   := nullif(p_patch->>'sale_price','')::numeric; end if;
  if v_has_par   then v_par_price    := nullif(p_patch->>'par_price','')::numeric; end if;
  if v_has_start then v_start_date   := nullif(p_patch->>'start_date','')::date; end if;
  if v_has_end   then v_end_date     := nullif(p_patch->>'end_date','')::date; end if;
  if v_has_obs   then v_observations := nullif(trim(coalesce(p_patch->>'observations','')),''); end if;

  if v_has_sku then
    if v_sku is null then v_new_product_id := null;
    else
      select id into v_new_product_id from public.products where sku=v_sku limit 1;
      if v_new_product_id is null then
        raise exception 'SKU % no existe en el catálogo', v_sku using errcode='P0002';
      end if;
    end if;
  else
    v_new_product_id := case when p_kind='position' then v_row_pos.product_id else v_row_tr.product_id end;
  end if;

  if v_has_codes then
    v_codes := public._validate_client_codes(v_agreement_id, p_patch->'client_codes');
  end if;

  if p_kind='position' then
    update public.agreement_positions set
      product_id   = case when v_has_sku   then v_new_product_id else product_id end,
      sale_price   = case when v_has_price then v_sale_price     else sale_price end,
      par_price    = case when v_has_par   then v_par_price      else par_price end,
      start_date   = case when v_has_start then v_start_date     else start_date end,
      end_date     = case when v_has_end   then v_end_date       else end_date end,
      observations = case when v_has_obs   then v_observations   else observations end,
      updated_by   = v_user
    where id=p_line_id;

    if v_has_sku and v_new_product_id is distinct from v_row_pos.product_id then
      if not v_has_codes then
        select coalesce(jsonb_agg(jsonb_build_object(
                 'client_id', apcc.client_id,
                 'client_code', cp.client_code,
                 'description', null)), '[]'::jsonb)
          into v_codes
          from public.agreement_position_client_codes apcc
          join public.client_products cp on cp.id=apcc.client_product_id
         where apcc.agreement_position_id=p_line_id and apcc.valid_until is null;
        v_has_codes := true;
      end if;
      update public.agreement_position_client_codes
         set valid_until=now(), ended_by=v_user, ended_reason='Cambio de SKU en la posición'
       where agreement_position_id=p_line_id and valid_until is null;
    end if;

    if v_has_codes then
      select coalesce(array_agg((e->>'client_id')::uuid),'{}') into v_desired_ids
        from jsonb_array_elements(v_codes) e;

      update public.agreement_position_client_codes
         set valid_until=now(), ended_by=v_user, ended_reason='Retirado del diff'
       where agreement_position_id=p_line_id and valid_until is null
         and client_id <> all (v_desired_ids);

      for r in select * from jsonb_array_elements(v_codes) loop
        v_client_id   := (r->>'client_id')::uuid;
        v_client_code := trim(r->>'client_code');
        v_row_desc    := nullif(trim(coalesce(r->>'description','')),'');
        select client_product_id, client_product_match_id into v_cp, v_match
          from public._resolve_client_code(v_client_id, v_client_code, v_row_desc,
                                           v_new_product_id, 'manual');

        v_open_id := null; v_open_cp := null;
        select apcc.id, apcc.client_product_id into v_open_id, v_open_cp
          from public.agreement_position_client_codes apcc
         where apcc.agreement_position_id=p_line_id
           and apcc.client_id=v_client_id
           and apcc.valid_until is null;

        if v_open_id is not null and v_open_cp=v_cp then
          continue;
        end if;
        if v_open_id is not null then
          update public.agreement_position_client_codes
             set valid_until=now(), ended_by=v_user, ended_reason='Reemplazo por nuevo código'
           where id=v_open_id;
        end if;

        v_conflict_pos := null; v_conflict_sku := null;
        select apcc.agreement_position_id, p.sku
          into v_conflict_pos, v_conflict_sku
          from public.agreement_position_client_codes apcc
          join public.agreement_positions ap on ap.id=apcc.agreement_position_id
          left join public.products p on p.id=ap.product_id
         where apcc.agreement_id=v_agreement_id
           and apcc.client_product_id=v_cp
           and apcc.valid_until is null
           and apcc.agreement_position_id<>p_line_id;
        if v_conflict_pos is not null then
          raise exception 'El código % (cliente %) ya está fijado al SKU % en otra posición del acuerdo (RN-MATCH-01)',
            v_client_code, v_client_id, coalesce(v_conflict_sku,'<sin SKU>') using errcode='23505';
        end if;

        insert into public.agreement_position_client_codes
          (agreement_position_id, agreement_id, client_id, client_product_id,
           client_product_match_id, started_by)
        values (p_line_id, v_agreement_id, v_client_id, v_cp, v_match, v_user);
      end loop;
    end if;

    if not exists (
      select 1 from public.agreement_position_client_codes
       where agreement_position_id=p_line_id and valid_until is null
    ) then
      if exists (
        select 1 from public.agreement_positions ap2
         where ap2.agreement_id=v_agreement_id
           and ap2.product_id  =v_new_product_id
           and ap2.id          <>p_line_id
           and ap2.status      <>'excluded'
           and not exists (
             select 1 from public.agreement_position_client_codes apcc
              where apcc.agreement_position_id=ap2.id and apcc.valid_until is null
           )
      ) then
        raise exception 'Ya existe otra posición vigente de este SKU sin códigos de cliente en el acuerdo. Un SKU no se repite sin un código que lo distinga.'
          using errcode='23505';
      end if;
    end if;

    return jsonb_build_object('promoted', false, 'position_id', p_line_id);
  end if;

  update public.agreement_transit_lines set
    product_id   = case when v_has_sku   then v_new_product_id else product_id end,
    sku_raw      = case when v_has_sku   then v_sku            else sku_raw end,
    sale_price   = case when v_has_price then v_sale_price     else sale_price end,
    par_price    = case when v_has_par   then v_par_price      else par_price end,
    start_date   = case when v_has_start then v_start_date     else start_date end,
    end_date     = case when v_has_end   then v_end_date       else end_date end,
    observations = case when v_has_obs   then v_observations   else observations end,
    updated_by   = v_user
  where id=p_line_id;
  select * into v_row_tr from public.agreement_transit_lines where id=p_line_id;

  if v_has_codes then
    select coalesce(array_agg((e->>'client_id')::uuid),'{}') into v_desired_ids
      from jsonb_array_elements(v_codes) e;
    update public.agreement_transit_client_codes
       set valid_until=now(), ended_by=v_user, ended_reason='Retirado del diff'
     where agreement_transit_id=p_line_id and valid_until is null
       and client_id <> all (v_desired_ids);

    for r in select * from jsonb_array_elements(v_codes) loop
      v_client_id   := (r->>'client_id')::uuid;
      v_client_code := trim(r->>'client_code');
      v_row_desc    := nullif(trim(coalesce(r->>'description','')),'');
      select client_product_id, client_product_match_id into v_cp, v_match
        from public._resolve_client_code(v_client_id, v_client_code, v_row_desc,
                                         v_row_tr.product_id, 'manual');

      v_open_id := null; v_open_cp := null;
      select id, client_product_id into v_open_id, v_open_cp
        from public.agreement_transit_client_codes
       where agreement_transit_id=p_line_id and client_id=v_client_id and valid_until is null;
      if v_open_id is not null and v_open_cp=v_cp then continue; end if;
      if v_open_id is not null then
        update public.agreement_transit_client_codes
           set valid_until=now(), ended_by=v_user, ended_reason='Reemplazo por nuevo código'
         where id=v_open_id;
      end if;
      insert into public.agreement_transit_client_codes
        (agreement_transit_id, agreement_id, client_id, client_product_id,
         client_product_match_id, started_by)
      values (p_line_id, v_agreement_id, v_client_id, v_cp, v_match, v_user);
    end loop;
  end if;

  v_eff_start := coalesce(v_row_tr.start_date, v_agr_start);
  v_eff_end   := coalesce(v_row_tr.end_date,   v_agr_end);
  if v_row_tr.product_id is null
     or v_row_tr.sale_price is null or v_row_tr.sale_price<=0
     or v_eff_start is null or v_eff_end is null then
    update public.agreement_transit_lines set
      pending_reason = array_to_string(array_remove(array[
        case when v_row_tr.product_id is null then 'no_sku' end,
        case when v_row_tr.sale_price is null or v_row_tr.sale_price<=0 then 'no_price' end,
        case when v_eff_start is null or v_eff_end is null then 'no_dates' end
      ], null), ',')
    where id=p_line_id;
    return jsonb_build_object('promoted', false, 'transit_id', p_line_id);
  end if;

  for v_client_id, v_cp in
    select client_id, client_product_id
      from public.agreement_transit_client_codes
     where agreement_transit_id=p_line_id and valid_until is null
  loop
    v_conflict_pos := null; v_conflict_sku := null;
    select apcc.agreement_position_id, p.sku into v_conflict_pos, v_conflict_sku
      from public.agreement_position_client_codes apcc
      join public.agreement_positions ap on ap.id=apcc.agreement_position_id
      left join public.products p on p.id=ap.product_id
     where apcc.agreement_id=v_agreement_id
       and apcc.client_product_id=v_cp
       and apcc.valid_until is null;
    if v_conflict_pos is not null then
      update public.agreement_transit_lines
         set pending_reason = format(
               'Promoción bloqueada: el código del cliente %s ya está fijado al SKU %s en otra posición del acuerdo',
               v_client_id::text, coalesce(v_conflict_sku,'<sin SKU>'))
       where id=p_line_id;
      return jsonb_build_object(
        'promoted', false,
        'transit_id', p_line_id,
        'blocked', true,
        'block_reason', jsonb_build_object(
          'code','rn_match_01',
          'client_id', v_client_id,
          'client_product_id', v_cp,
          'conflicting_position_id', v_conflict_pos,
          'conflicting_sku', v_conflict_sku
        )
      );
    end if;
  end loop;

  if not exists (
    select 1 from public.agreement_transit_client_codes
     where agreement_transit_id=p_line_id and valid_until is null
  ) then
    if exists (
      select 1 from public.agreement_positions ap2
       where ap2.agreement_id=v_agreement_id
         and ap2.product_id  =v_row_tr.product_id
         and ap2.status      <>'excluded'
         and not exists (
           select 1 from public.agreement_position_client_codes apcc
            where apcc.agreement_position_id=ap2.id and apcc.valid_until is null
         )
    ) then
      update public.agreement_transit_lines
         set pending_reason='Promoción bloqueada: ya existe otra posición vigente de este SKU sin códigos de cliente'
       where id=p_line_id;
      return jsonb_build_object(
        'promoted', false, 'transit_id', p_line_id,
        'blocked', true,
        'block_reason', jsonb_build_object('code','identity_no_codes')
      );
    end if;
  end if;

  insert into public.agreement_positions
    (agreement_id, product_id, sale_price, par_price, start_date, end_date,
     observations, status, created_by, updated_by)
  values
    (v_agreement_id, v_row_tr.product_id, v_row_tr.sale_price, v_row_tr.par_price,
     v_row_tr.start_date, v_row_tr.end_date, v_row_tr.observations, 'excluded', v_user, v_user)
  returning id into v_promoted_id;

  insert into public.agreement_position_client_codes
    (agreement_position_id, agreement_id, client_id, client_product_id,
     client_product_match_id, started_by)
  select v_promoted_id, v_agreement_id, atcc.client_id, atcc.client_product_id,
         atcc.client_product_match_id, v_user
    from public.agreement_transit_client_codes atcc
   where atcc.agreement_transit_id=p_line_id and atcc.valid_until is null;

  update public.agreement_positions set status='active' where id=v_promoted_id;

  delete from public.agreement_transit_lines where id=p_line_id;

  return jsonb_build_object('promoted', true, 'position_id', v_promoted_id);
end $fn$;

-- ============================================================
-- G.3 · exclude_agreement_position
-- ============================================================
create or replace function public.exclude_agreement_position(
  p_position_id uuid, p_reason text
) returns void
language plpgsql security definer set search_path = public
as $fn$
declare v_agreement_id uuid;
begin
  select agreement_id into v_agreement_id
    from public.agreement_positions where id=p_position_id;
  if v_agreement_id is null then
    raise exception 'Posición no encontrada' using errcode='P0002';
  end if;
  if not public.can_admin_agreement(v_agreement_id) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  update public.agreement_positions set status='excluded'
   where id=p_position_id and status<>'excluded';
  insert into public.agreement_position_exclusions
    (position_id, exclusion_reason, started_by)
  values (p_position_id, coalesce(p_reason,''), auth.uid())
  on conflict (position_id) where valid_until is null do nothing;
  update public.agreement_position_client_codes
     set valid_until=now(), ended_by=auth.uid(), ended_reason='posición excluida'
   where agreement_position_id=p_position_id and valid_until is null;
end $fn$;

-- ============================================================
-- G.4 · reactivate_agreement_position
-- ============================================================
create or replace function public.reactivate_agreement_position(
  p_position_id uuid, p_reason text default null
) returns void
language plpgsql security definer set search_path = public
as $fn$
declare
  v_agreement_id uuid;
  v_product_id uuid;
  v_to_reopen jsonb;
  v_conflict_pos uuid; v_conflict_sku text;
  v_client_id uuid; v_cp uuid; v_prev_match uuid; v_match uuid;
  r jsonb;
begin
  select agreement_id, product_id into v_agreement_id, v_product_id
    from public.agreement_positions where id=p_position_id;
  if v_agreement_id is null then
    raise exception 'Posición no encontrada' using errcode='P0002';
  end if;
  if not public.can_admin_agreement(v_agreement_id) then
    raise exception 'Forbidden' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'client_id', x.client_id,
           'client_product_id', x.client_product_id,
           'client_product_match_id', x.client_product_match_id)), '[]'::jsonb)
    into v_to_reopen
    from (
      select distinct on (apcc.client_id)
             apcc.client_id, apcc.client_product_id, apcc.client_product_match_id
        from public.agreement_position_client_codes apcc
       where apcc.agreement_position_id=p_position_id
         and apcc.ended_reason='posición excluida'
         and exists (
           select 1 from public.agreement_companies ac
            where ac.agreement_id=v_agreement_id
              and ac.client_id   =apcc.client_id
              and ac.valid_until is null
         )
       order by apcc.client_id, apcc.valid_until desc
    ) x;

  for r in select * from jsonb_array_elements(v_to_reopen) loop
    v_client_id := (r->>'client_id')::uuid;
    v_cp        := (r->>'client_product_id')::uuid;
    v_conflict_pos := null; v_conflict_sku := null;
    select apcc.agreement_position_id, p.sku into v_conflict_pos, v_conflict_sku
      from public.agreement_position_client_codes apcc
      join public.agreement_positions ap on ap.id=apcc.agreement_position_id
      left join public.products p on p.id=ap.product_id
     where apcc.agreement_id=v_agreement_id
       and apcc.client_product_id=v_cp
       and apcc.valid_until is null;
    if v_conflict_pos is not null then
      raise exception 'No se puede reactivar: el código del cliente % ya está fijado al SKU % en otra posición del acuerdo',
        v_client_id, coalesce(v_conflict_sku,'<sin SKU>') using errcode='23505';
    end if;
  end loop;

  for r in select * from jsonb_array_elements(v_to_reopen) loop
    v_client_id  := (r->>'client_id')::uuid;
    v_cp         := (r->>'client_product_id')::uuid;
    v_prev_match := nullif(r->>'client_product_match_id','')::uuid;
    v_match := null;
    if v_product_id is not null then
      select id into v_match from public.client_product_match
       where client_product_id=v_cp and product_id=v_product_id limit 1;
    end if;
    insert into public.agreement_position_client_codes
      (agreement_position_id, agreement_id, client_id, client_product_id,
       client_product_match_id, started_by)
    values (p_position_id, v_agreement_id, v_client_id, v_cp,
            coalesce(v_match, v_prev_match), auth.uid());
  end loop;

  update public.agreement_position_exclusions
     set valid_until=now(), ended_by=auth.uid(), ended_reason=p_reason
   where position_id=p_position_id and valid_until is null;

  update public.agreement_positions set status='active'
   where id=p_position_id and status='excluded';
end $fn$;

CREATE OR REPLACE FUNCTION public.commit_agreement_import(p_agreement_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_client_id uuid;
  v_companies_count integer;
  v_agr_start date; v_agr_end date;
  v_resolutions jsonb := coalesce(p_payload->'price_resolutions', '{}'::jsonb);
  v_rows jsonb := coalesce(p_payload->'rows', '[]'::jsonb);
  v_row jsonb;
  v_sku text; v_client_code text; v_description text;
  v_product_id uuid;
  v_client_product_id uuid; v_match_id uuid;
  v_sale_price numeric; v_par_price numeric;
  v_start_date date; v_end_date date;
  v_eff_start date; v_eff_end date;
  v_observations text;
  v_pending_reasons text[]; v_pending_reason text;
  v_is_position boolean;
  v_existing_id uuid; v_existing_status text;
  v_transit_id uuid;
  v_inserted_positions int := 0;
  v_updated_positions int := 0;
  v_transit_inserted int := 0;
  v_transit_updated int := 0;
  v_transit_deleted_on_promote int := 0;
  v_propagated int := 0;
  v_by_status jsonb;
  v_sku_key text;
begin
  raise exception 'Importación en mantenimiento — disponible en la próxima versión' using errcode = 'P0001';
  if not public.can_admin_agreement(p_agreement_id) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select count(*) into v_companies_count from public.agreement_companies
   where agreement_id = p_agreement_id and valid_until is null;
  if v_companies_count = 0 then raise exception 'Acuerdo sin empresas vinculadas'; end if;
  if v_companies_count = 1 then
    select client_id into v_client_id from public.agreement_companies
     where agreement_id = p_agreement_id and valid_until is null;
  else
    v_client_id := nullif(p_payload->>'target_client_id','')::uuid;
    if v_client_id is null then raise exception 'Acuerdo con múltiples empresas: falta target_client_id'; end if;
    if not exists (select 1 from public.agreement_companies
                    where agreement_id = p_agreement_id and client_id = v_client_id and valid_until is null) then
      raise exception 'target_client_id no está vinculado al acuerdo';
    end if;
  end if;

  select start_date, end_date into v_agr_start, v_agr_end from public.agreements where id = p_agreement_id;

  for v_row in select * from jsonb_array_elements(v_rows) loop
    v_sku          := nullif(trim(coalesce(v_row->>'sku','')), '');
    v_client_code  := nullif(trim(coalesce(v_row->>'client_code','')), '');
    v_description  := nullif(trim(coalesce(v_row->>'description','')), '');
    v_sale_price   := nullif(v_row->>'sale_price','')::numeric;
    v_par_price    := nullif(v_row->>'par_price','')::numeric;
    v_start_date   := nullif(v_row->>'start_date','')::date;
    v_end_date     := nullif(v_row->>'end_date','')::date;
    v_observations := nullif(trim(coalesce(v_row->>'observations','')), '');

    v_product_id := null;
    if v_sku is not null then
      select id into v_product_id from public.products where sku = v_sku limit 1;
    end if;

    v_client_product_id := null; v_match_id := null;
    if v_client_code is not null then
      insert into public.client_products (client_id, client_code, created_by)
      values (v_client_id, v_client_code, v_user)
      on conflict (client_id, client_code) do update set client_code = excluded.client_code
      returning id into v_client_product_id;
      if v_description is not null then
        insert into public.client_product_history (client_product_id, description, valid_from)
        values (v_client_product_id, v_description, current_date);
      end if;
      if v_product_id is not null then
        select id into v_match_id from public.client_product_match
         where client_product_id = v_client_product_id and product_id = v_product_id limit 1;
        if v_match_id is null then
          insert into public.client_product_match (client_product_id, product_id, valid_from, source, created_by)
          values (v_client_product_id, v_product_id, current_date, 'import', v_user)
          returning id into v_match_id;
        end if;
      end if;
    end if;

    v_eff_start := coalesce(v_start_date, v_agr_start);
    v_eff_end   := coalesce(v_end_date,   v_agr_end);

    v_is_position := v_product_id is not null
                     and v_sale_price is not null and v_sale_price > 0
                     and v_eff_start is not null
                     and v_eff_end is not null;

    if v_is_position then
      v_existing_id := null; v_existing_status := null;
      if v_client_product_id is null then
        select id, status into v_existing_id, v_existing_status
          from public.agreement_positions
         where agreement_id = p_agreement_id
           and product_id = v_product_id
           and client_product_id is null
         limit 1;
      else
        select id, status into v_existing_id, v_existing_status
          from public.agreement_positions
         where agreement_id = p_agreement_id
           and product_id = v_product_id
           and client_product_id = v_client_product_id
         limit 1;
      end if;

      if v_existing_id is not null and v_existing_status = 'excluded' then
        perform public.reactivate_agreement_position(v_existing_id, 'Reingreso por importación');
      end if;

      if v_existing_id is null then
        insert into public.agreement_positions (
          agreement_id, product_id, client_product_match_id, client_product_id,
          sale_price, par_price, start_date, end_date,
          observations, created_by, updated_by
        ) values (
          p_agreement_id, v_product_id, v_match_id, v_client_product_id,
          v_sale_price, v_par_price, v_start_date, v_end_date,
          v_observations, v_user, v_user
        );
        v_inserted_positions := v_inserted_positions + 1;
      else
        update public.agreement_positions set
          client_product_match_id = coalesce(v_match_id, client_product_match_id),
          sale_price   = v_sale_price,
          par_price    = coalesce(v_par_price, par_price),
          start_date   = coalesce(v_start_date, start_date),
          end_date     = coalesce(v_end_date, end_date),
          observations = coalesce(v_observations, observations),
          updated_by   = v_user,
          updated_at   = now()
        where id = v_existing_id;
        v_updated_positions := v_updated_positions + 1;
      end if;

      v_transit_id := null;
      if v_client_product_id is not null then
        select id into v_transit_id from public.agreement_transit_lines
         where agreement_id = p_agreement_id and client_product_id = v_client_product_id limit 1;
      end if;
      if v_transit_id is null and v_product_id is not null then
        select id into v_transit_id from public.agreement_transit_lines
         where agreement_id = p_agreement_id and product_id = v_product_id limit 1;
      end if;
      if v_transit_id is null and v_sku is not null then
        select id into v_transit_id from public.agreement_transit_lines
         where agreement_id = p_agreement_id and nullif(trim(sku_raw),'') = v_sku limit 1;
      end if;
      if v_transit_id is null and v_description is not null then
        select id into v_transit_id from public.agreement_transit_lines
         where agreement_id = p_agreement_id and nullif(trim(description),'') = v_description limit 1;
      end if;
      if v_transit_id is not null then
        delete from public.agreement_transit_lines where id = v_transit_id;
        v_transit_deleted_on_promote := v_transit_deleted_on_promote + 1;
      end if;

    else
      v_pending_reasons := array[]::text[];
      if v_product_id is null then v_pending_reasons := array_append(v_pending_reasons, 'no_sku'); end if;
      if v_sale_price is null or v_sale_price <= 0 then v_pending_reasons := array_append(v_pending_reasons, 'no_price'); end if;
      if v_eff_start is null or v_eff_end is null then v_pending_reasons := array_append(v_pending_reasons, 'no_dates'); end if;
      v_pending_reason := array_to_string(v_pending_reasons, ',');

      v_transit_id := null;
      if v_client_product_id is not null then
        select id into v_transit_id from public.agreement_transit_lines
         where agreement_id = p_agreement_id and client_product_id = v_client_product_id limit 1;
      end if;
      if v_transit_id is null and v_product_id is not null then
        select id into v_transit_id from public.agreement_transit_lines
         where agreement_id = p_agreement_id and product_id = v_product_id limit 1;
      end if;
      if v_transit_id is null and v_sku is not null then
        select id into v_transit_id from public.agreement_transit_lines
         where agreement_id = p_agreement_id and nullif(trim(sku_raw),'') = v_sku limit 1;
      end if;
      if v_transit_id is null and v_description is not null then
        select id into v_transit_id from public.agreement_transit_lines
         where agreement_id = p_agreement_id and nullif(trim(description),'') = v_description limit 1;
      end if;

      if v_transit_id is null then
        insert into public.agreement_transit_lines (
          agreement_id, product_id, client_product_id,
          sku_raw, description, sale_price, par_price,
          start_date, end_date, observations, pending_reason,
          created_by, updated_by
        ) values (
          p_agreement_id, v_product_id, v_client_product_id,
          v_sku, v_description, v_sale_price, v_par_price,
          v_start_date, v_end_date, v_observations, v_pending_reason,
          v_user, v_user
        );
        v_transit_inserted := v_transit_inserted + 1;
      else
        update public.agreement_transit_lines set
          product_id        = coalesce(v_product_id, product_id),
          client_product_id = coalesce(v_client_product_id, client_product_id),
          sku_raw           = coalesce(v_sku, sku_raw),
          description       = coalesce(v_description, description),
          sale_price        = coalesce(v_sale_price, sale_price),
          par_price         = coalesce(v_par_price, par_price),
          start_date        = coalesce(v_start_date, start_date),
          end_date          = coalesce(v_end_date, end_date),
          observations      = coalesce(v_observations, observations),
          pending_reason    = v_pending_reason,
          updated_by        = v_user
        where id = v_transit_id;
        v_transit_updated := v_transit_updated + 1;
      end if;
    end if;
  end loop;

  for v_sku_key in select jsonb_object_keys(v_resolutions) loop
    if (v_resolutions->>v_sku_key) = 'applyAll' then
      select id into v_product_id from public.products where sku = v_sku_key limit 1;
      if v_product_id is not null then
        select max(nullif(value->>'sale_price','')::numeric) into v_sale_price
          from jsonb_array_elements(v_rows) as value
         where value->>'sku' = v_sku_key and nullif(value->>'sale_price','') is not null;
        if v_sale_price is not null and v_sale_price > 0 then
          update public.agreement_positions
             set sale_price = v_sale_price, updated_by = v_user, updated_at = now()
           where agreement_id = p_agreement_id
             and product_id = v_product_id
             and status <> 'excluded'
             and sale_price is distinct from v_sale_price;
          get diagnostics v_propagated = row_count;
        end if;
      end if;
    end if;
  end loop;

  select jsonb_object_agg(status, cnt) into v_by_status from (
    select status, count(*) as cnt from public.agreement_positions
     where agreement_id = p_agreement_id group by status
  ) s;

  return jsonb_build_object(
    'inserted_positions', v_inserted_positions,
    'updated_positions',  v_updated_positions,
    'transit_inserted',   v_transit_inserted,
    'transit_updated',    v_transit_updated,
    'transit_deleted_on_promote', v_transit_deleted_on_promote,
    'propagated_n1',      v_propagated,
    'by_status',          coalesce(v_by_status, '{}'::jsonb)
  );
end;
$function$;

-- ============================================================
-- BLOQUE H · Hardening EXECUTE
-- ============================================================
revoke all on function public.create_agreement_line(uuid, jsonb)                    from public;
revoke all on function public.update_agreement_line(uuid, text, jsonb, boolean)     from public;
revoke all on function public.exclude_agreement_position(uuid, text)                from public;
revoke all on function public.reactivate_agreement_position(uuid, text)             from public;
grant execute on function public.create_agreement_line(uuid, jsonb)                 to authenticated;
grant execute on function public.update_agreement_line(uuid, text, jsonb, boolean)  to authenticated;
grant execute on function public.exclude_agreement_position(uuid, text)             to authenticated;
grant execute on function public.reactivate_agreement_position(uuid, text)          to authenticated;

revoke all on function public.recalc_agreement_position_status()                    from public;
revoke all on function public.log_agreement_position_price_change()                 from public;
revoke all on function public.check_apcc_denormalization()                          from public;
revoke all on function public.check_atcc_denormalization()                          from public;
revoke all on function public.check_position_identity_without_codes()               from public;
revoke all on function public._validate_client_codes(uuid, jsonb)                   from public;
revoke all on function public._resolve_client_code(uuid, text, text, uuid, text)    from public;

commit;