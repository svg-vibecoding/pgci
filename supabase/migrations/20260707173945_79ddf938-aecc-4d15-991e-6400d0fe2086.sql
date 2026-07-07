-- =============================================================================
-- PGCI 03.21 — Separación posiciones vs tránsito
-- =============================================================================

-- --- 1.1 RENAMES ------------------------------------------------------------
alter table public.agreement_products rename to agreement_positions;
alter table public.agreement_product_alternatives rename to agreement_position_alternatives;
alter table public.agreement_position_alternatives rename column agreement_product_id to agreement_position_id;
alter table public.agreement_costs rename column agreement_product_id to agreement_position_id;

alter index public.agreement_products_pkey rename to agreement_positions_pkey;
alter index public.agreement_products_agreement_client_product_uq rename to agreement_positions_agreement_client_product_uq_old;
alter index public.idx_agreement_products_agreement_id rename to idx_agreement_positions_agreement_id;
alter index public.idx_agreement_products_product_id rename to idx_agreement_positions_product_id;
alter index public.idx_agreement_products_client_product_id rename to idx_agreement_positions_client_product_id;
alter index public.idx_agreement_products_status rename to idx_agreement_positions_status;

alter index public.agreement_product_alternatives_pkey rename to agreement_position_alternatives_pkey;
-- Renombrar el índice del UNIQUE también renombra su constraint asociado.
alter index public.agreement_product_alternative_agreement_product_id_product__key rename to agreement_position_alternatives_position_product_key;
alter index public.idx_agreement_product_alternatives_product_id rename to idx_agreement_position_alternatives_position_id;

alter table public.agreement_positions rename constraint agreement_products_agreement_id_fkey to agreement_positions_agreement_id_fkey;
alter table public.agreement_positions rename constraint agreement_products_client_product_id_fkey to agreement_positions_client_product_id_fkey;
alter table public.agreement_positions rename constraint agreement_products_created_by_fkey to agreement_positions_created_by_fkey;
alter table public.agreement_positions rename constraint agreement_products_product_id_fkey to agreement_positions_product_id_fkey;
alter table public.agreement_positions rename constraint agreement_products_updated_by_fkey to agreement_positions_updated_by_fkey;
alter table public.agreement_positions rename constraint agreement_products_status_check to agreement_positions_status_check;
alter table public.agreement_positions rename constraint agreement_product_dates_coherent to agreement_position_dates_coherent;
alter table public.agreement_positions drop constraint agreement_products_excluded_by_fkey;

alter table public.agreement_position_alternatives rename constraint agreement_product_alternatives_agreement_product_id_fkey to agreement_position_alternatives_position_id_fkey;
alter table public.agreement_position_alternatives rename constraint agreement_product_alternatives_created_by_fkey to agreement_position_alternatives_created_by_fkey;
alter table public.agreement_position_alternatives rename constraint agreement_product_alternatives_product_id_fkey to agreement_position_alternatives_product_id_fkey;

alter table public.agreement_costs rename constraint agreement_costs_agreement_product_id_fkey to agreement_costs_agreement_position_id_fkey;

drop trigger set_agreement_products_updated_at on public.agreement_positions;
drop trigger recalc_agreement_product_status_trigger on public.agreement_positions;

-- --- 1.2 ENDURECER agreement_positions --------------------------------------
alter table public.agreement_positions drop constraint pending_reason_only_for_pending;
alter table public.agreement_positions drop constraint excluded_fields_required;
alter table public.agreement_positions drop constraint agreement_positions_status_check;
alter table public.agreement_positions drop constraint sale_price_non_negative;
alter table public.agreement_positions
  drop column pending_reason,
  drop column excluded_reason,
  drop column excluded_by,
  drop column excluded_at;
alter table public.agreement_positions alter column product_id set not null;
alter table public.agreement_positions alter column sale_price set not null;
alter table public.agreement_positions
  add constraint agreement_positions_sale_price_positive check (sale_price > 0);
alter table public.agreement_positions alter column status set default 'active';
alter table public.agreement_positions
  add constraint agreement_positions_status_check
    check (status in ('active','requires_review','excluded'));

alter table public.agreement_positions
  drop constraint agreement_positions_product_id_fkey;
alter table public.agreement_positions
  add constraint agreement_positions_product_id_fkey
    foreign key (product_id) references public.products(id) on delete restrict;

-- --- 1.3 IDENTIDAD POR SKU --------------------------------------------------
drop index public.agreement_positions_agreement_client_product_uq_old;
create unique index agreement_positions_identity_with_cp_uq
  on public.agreement_positions (agreement_id, product_id, client_product_id)
  where client_product_id is not null and status <> 'excluded';
create unique index agreement_positions_identity_no_cp_uq
  on public.agreement_positions (agreement_id, product_id)
  where client_product_id is null and status <> 'excluded';

-- --- 1.4 agreement_transit_lines --------------------------------------------
create table public.agreement_transit_lines (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  client_product_id uuid references public.client_products(id) on delete set null,
  sku_raw text,
  description text,
  sale_price numeric,
  par_price numeric,
  start_date date,
  end_date date,
  observations text,
  pending_reason text not null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transit_capturable check (
    client_product_id is not null
    or product_id is not null
    or nullif(trim(coalesce(sku_raw, '')), '') is not null
    or nullif(trim(coalesce(description, '')), '') is not null
  ),
  constraint transit_sale_price_non_negative check (sale_price is null or sale_price >= 0),
  constraint transit_par_price_non_negative check (par_price is null or par_price >= 0),
  constraint transit_dates_coherent check (start_date is null or end_date is null or start_date <= end_date)
);
create index idx_agreement_transit_lines_agreement_id on public.agreement_transit_lines(agreement_id);
create index idx_agreement_transit_lines_agreement_product on public.agreement_transit_lines(agreement_id, product_id);
create index idx_agreement_transit_lines_agreement_cp on public.agreement_transit_lines(agreement_id, client_product_id);

grant select, insert, update, delete on public.agreement_transit_lines to authenticated;
grant all on public.agreement_transit_lines to service_role;
alter table public.agreement_transit_lines enable row level security;
create policy atl_select on public.agreement_transit_lines for select
  using (public.can_access_agreement(agreement_id));
create policy atl_write on public.agreement_transit_lines for all
  using (public.can_admin_agreement(agreement_id))
  with check (public.can_admin_agreement(agreement_id));

create trigger set_agreement_transit_lines_updated_at
  before update on public.agreement_transit_lines
  for each row execute function public.set_updated_at();

-- --- 1.5 agreement_position_price_history -----------------------------------
create table public.agreement_position_price_history (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references public.agreement_positions(id) on delete cascade,
  sale_price numeric not null,
  start_date date,
  end_date date,
  recorded_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id) on delete set null,
  change_reason text
);
create index idx_agreement_position_price_history_position on public.agreement_position_price_history(position_id, recorded_at desc);

grant select on public.agreement_position_price_history to authenticated;
grant all on public.agreement_position_price_history to service_role;
alter table public.agreement_position_price_history enable row level security;
create policy apph_select on public.agreement_position_price_history for select
  using (exists (
    select 1 from public.agreement_positions p
     where p.id = position_id and public.can_access_agreement(p.agreement_id)
  ));

create or replace function public.log_agreement_position_price_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.agreement_position_price_history
      (position_id, sale_price, start_date, end_date, recorded_by, change_reason)
    values (new.id, new.sale_price, new.start_date, new.end_date, auth.uid(), 'initial');
    return new;
  end if;
  if new.sale_price is distinct from old.sale_price
     or new.start_date is distinct from old.start_date
     or new.end_date is distinct from old.end_date then
    insert into public.agreement_position_price_history
      (position_id, sale_price, start_date, end_date, recorded_by, change_reason)
    values (new.id, new.sale_price, new.start_date, new.end_date, auth.uid(), null);
  end if;
  return new;
end;
$$;
revoke all on function public.log_agreement_position_price_change() from public;

create trigger log_agreement_position_price_change_trigger
  after insert or update of sale_price, start_date, end_date on public.agreement_positions
  for each row execute function public.log_agreement_position_price_change();

-- --- 1.6 agreement_position_exclusions --------------------------------------
create table public.agreement_position_exclusions (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references public.agreement_positions(id) on delete cascade,
  exclusion_reason text not null,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  started_by uuid references auth.users(id) on delete set null,
  ended_by uuid references auth.users(id) on delete set null,
  ended_reason text,
  constraint agr_position_exclusions_period_valid
    check (valid_until is null or valid_until >= valid_from),
  constraint agr_position_exclusions_closure_consistent
    check ((valid_until is null) = (ended_by is null))
);
create unique index agr_position_exclusions_open_uniq
  on public.agreement_position_exclusions(position_id) where valid_until is null;
create index idx_agreement_position_exclusions_position on public.agreement_position_exclusions(position_id);

grant select on public.agreement_position_exclusions to authenticated;
grant all on public.agreement_position_exclusions to service_role;
alter table public.agreement_position_exclusions enable row level security;
create policy ape_select on public.agreement_position_exclusions for select
  using (exists (
    select 1 from public.agreement_positions p
     where p.id = position_id and public.can_access_agreement(p.agreement_id)
  ));

-- --- 1.7 Server functions SQL de exclusión ----------------------------------
create or replace function public.exclude_agreement_position(p_position_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_agreement_id uuid;
begin
  select agreement_id into v_agreement_id from public.agreement_positions where id = p_position_id;
  if v_agreement_id is null then raise exception 'Posición no encontrada'; end if;
  if not public.can_admin_agreement(v_agreement_id) then raise exception 'Forbidden' using errcode = '42501'; end if;
  update public.agreement_positions set status = 'excluded' where id = p_position_id and status <> 'excluded';
  insert into public.agreement_position_exclusions (position_id, exclusion_reason, started_by)
    values (p_position_id, coalesce(p_reason, ''), auth.uid())
  on conflict (position_id) where valid_until is null do nothing;
end;
$$;
revoke all on function public.exclude_agreement_position(uuid, text) from public;
grant execute on function public.exclude_agreement_position(uuid, text) to authenticated;

create or replace function public.reactivate_agreement_position(p_position_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_agreement_id uuid;
begin
  select agreement_id into v_agreement_id from public.agreement_positions where id = p_position_id;
  if v_agreement_id is null then raise exception 'Posición no encontrada'; end if;
  if not public.can_admin_agreement(v_agreement_id) then raise exception 'Forbidden' using errcode = '42501'; end if;
  update public.agreement_position_exclusions
     set valid_until = now(), ended_by = auth.uid(), ended_reason = p_reason
   where position_id = p_position_id and valid_until is null;
  update public.agreement_positions set status = 'active' where id = p_position_id and status = 'excluded';
end;
$$;
revoke all on function public.reactivate_agreement_position(uuid, text) from public;
grant execute on function public.reactivate_agreement_position(uuid, text) to authenticated;

-- --- 1.8 Recálculo de status simplificado -----------------------------------
create or replace function public.recalc_agreement_position_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_agr_end date; v_end date; v_sku_active boolean;
begin
  if new.status = 'excluded' then return new; end if;
  select end_date into v_agr_end from public.agreements where id = new.agreement_id;
  v_end := coalesce(new.end_date, v_agr_end);
  select (status = 'active') into v_sku_active from public.products where id = new.product_id;
  if v_sku_active is false then new.status := 'requires_review'; return new; end if;
  if v_end is not null and v_end < current_date then new.status := 'requires_review'; return new; end if;
  new.status := 'active';
  return new;
end;
$$;
revoke all on function public.recalc_agreement_position_status() from public;

create trigger recalc_agreement_position_status_trigger
  before insert or update of product_id, sale_price, start_date, end_date, status
  on public.agreement_positions
  for each row execute function public.recalc_agreement_position_status();

create trigger set_agreement_positions_updated_at
  before update on public.agreement_positions
  for each row execute function public.set_updated_at();

drop function public.recalc_agreement_product_status();

-- --- 1.9 commit_agreement_import (reescritura) ------------------------------
create or replace function public.commit_agreement_import(p_agreement_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
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

      -- Limpieza de tránsito por reconocimiento Nivel 1.
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
$$;

-- --- 2. update_agreement_line -----------------------------------------------
create or replace function public.update_agreement_line(
  p_line_id uuid, p_kind text, p_patch jsonb, p_confirm_n_conflict boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_agreement_id uuid;
  v_client_id uuid;
  v_agr_start date; v_agr_end date;
  v_row_position record; v_row_transit record;
  v_client_code text; v_description text; v_sku text;
  v_product_id uuid; v_client_product_id uuid; v_match_id uuid;
  v_sale_price numeric; v_par_price numeric;
  v_start_date date; v_end_date date;
  v_eff_start date; v_eff_end date;
  v_observations text;
  v_promoted_id uuid;
  v_existing_id uuid; v_existing_status text;
  v_has_sku boolean := p_patch ? 'sku';
  v_has_code boolean := p_patch ? 'client_code';
  v_has_desc boolean := p_patch ? 'client_description';
  v_has_price boolean := p_patch ? 'sale_price';
  v_has_par boolean := p_patch ? 'par_price';
  v_has_start boolean := p_patch ? 'start_date';
  v_has_end boolean := p_patch ? 'end_date';
  v_has_obs boolean := p_patch ? 'observations';
begin
  if p_kind not in ('position','transit') then raise exception 'p_kind inválido'; end if;

  if p_kind = 'position' then
    select * into v_row_position from public.agreement_positions where id = p_line_id;
    if not found then raise exception 'Posición no encontrada'; end if;
    v_agreement_id := v_row_position.agreement_id;
  else
    select * into v_row_transit from public.agreement_transit_lines where id = p_line_id;
    if not found then raise exception 'Línea en tránsito no encontrada'; end if;
    v_agreement_id := v_row_transit.agreement_id;
  end if;

  if not public.can_admin_agreement(v_agreement_id) then raise exception 'Forbidden' using errcode = '42501'; end if;

  select client_id into v_client_id from public.agreement_companies
   where agreement_id = v_agreement_id and valid_until is null
   order by created_at asc limit 1;
  select start_date, end_date into v_agr_start, v_agr_end from public.agreements where id = v_agreement_id;

  if v_has_sku then v_sku := nullif(trim(coalesce(p_patch->>'sku','')), ''); end if;
  if v_has_code then v_client_code := nullif(trim(coalesce(p_patch->>'client_code','')), ''); end if;
  if v_has_desc then v_description := nullif(trim(coalesce(p_patch->>'client_description','')), ''); end if;
  if v_has_price then v_sale_price := nullif(p_patch->>'sale_price','')::numeric; end if;
  if v_has_par then v_par_price := nullif(p_patch->>'par_price','')::numeric; end if;
  if v_has_start then v_start_date := nullif(p_patch->>'start_date','')::date; end if;
  if v_has_end then v_end_date := nullif(p_patch->>'end_date','')::date; end if;
  if v_has_obs then v_observations := nullif(trim(coalesce(p_patch->>'observations','')), ''); end if;

  if v_has_sku then
    if v_sku is null then v_product_id := null;
    else select id into v_product_id from public.products where sku = v_sku limit 1;
    end if;
  else
    if p_kind = 'position' then v_product_id := v_row_position.product_id;
    else v_product_id := v_row_transit.product_id;
    end if;
  end if;

  if v_has_code and v_client_id is not null then
    if v_client_code is null then
      v_client_product_id := null;
    else
      insert into public.client_products (client_id, client_code, created_by)
      values (v_client_id, v_client_code, v_user)
      on conflict (client_id, client_code) do update set client_code = excluded.client_code
      returning id into v_client_product_id;
      if v_description is not null then
        insert into public.client_product_history (client_product_id, description, valid_from)
        values (v_client_product_id, v_description, current_date);
      end if;
    end if;
  else
    if p_kind = 'position' then v_client_product_id := v_row_position.client_product_id;
    else v_client_product_id := v_row_transit.client_product_id;
    end if;
  end if;

  if v_client_product_id is not null and v_product_id is not null then
    select id into v_match_id from public.client_product_match
     where client_product_id = v_client_product_id and product_id = v_product_id limit 1;
    if v_match_id is null then
      insert into public.client_product_match (client_product_id, product_id, valid_from, source, created_by)
      values (v_client_product_id, v_product_id, current_date, 'manual', v_user)
      returning id into v_match_id;
    end if;
  end if;

  if p_kind = 'position' then
    update public.agreement_positions set
      product_id              = coalesce(v_product_id, product_id),
      client_product_match_id = case when v_match_id is not null then v_match_id else client_product_match_id end,
      client_product_id       = case when v_has_code then v_client_product_id else client_product_id end,
      sale_price              = case when v_has_price then v_sale_price else sale_price end,
      par_price               = case when v_has_par then v_par_price else par_price end,
      start_date              = case when v_has_start then v_start_date else start_date end,
      end_date                = case when v_has_end then v_end_date else end_date end,
      observations            = case when v_has_obs then v_observations else observations end,
      updated_by              = v_user
    where id = p_line_id;
    return jsonb_build_object('promoted', false, 'position_id', p_line_id);
  end if;

  update public.agreement_transit_lines set
    product_id        = case when v_has_sku then v_product_id else product_id end,
    client_product_id = case when v_has_code then v_client_product_id else client_product_id end,
    sku_raw           = case when v_has_sku then v_sku else sku_raw end,
    description       = case when v_has_desc then v_description else description end,
    sale_price        = case when v_has_price then v_sale_price else sale_price end,
    par_price         = case when v_has_par then v_par_price else par_price end,
    start_date        = case when v_has_start then v_start_date else start_date end,
    end_date          = case when v_has_end then v_end_date else end_date end,
    observations      = case when v_has_obs then v_observations else observations end,
    updated_by        = v_user
  where id = p_line_id;

  select * into v_row_transit from public.agreement_transit_lines where id = p_line_id;
  v_eff_start := coalesce(v_row_transit.start_date, v_agr_start);
  v_eff_end   := coalesce(v_row_transit.end_date,   v_agr_end);

  if v_row_transit.product_id is null
     or v_row_transit.sale_price is null or v_row_transit.sale_price <= 0
     or v_eff_start is null or v_eff_end is null then
    update public.agreement_transit_lines set
      pending_reason = array_to_string(array_remove(array[
        case when v_row_transit.product_id is null then 'no_sku' end,
        case when v_row_transit.sale_price is null or v_row_transit.sale_price <= 0 then 'no_price' end,
        case when v_eff_start is null or v_eff_end is null then 'no_dates' end
      ], null), ',')
    where id = p_line_id;
    return jsonb_build_object('promoted', false, 'transit_id', p_line_id);
  end if;

  if v_row_transit.client_product_id is null then
    select id, status into v_existing_id, v_existing_status
      from public.agreement_positions
     where agreement_id = v_agreement_id
       and product_id = v_row_transit.product_id
       and client_product_id is null
     limit 1;
  else
    select id, status into v_existing_id, v_existing_status
      from public.agreement_positions
     where agreement_id = v_agreement_id
       and product_id = v_row_transit.product_id
       and client_product_id = v_row_transit.client_product_id
     limit 1;
  end if;

  if v_existing_id is not null and v_existing_status = 'excluded' then
    perform public.reactivate_agreement_position(v_existing_id, 'Reingreso por edición de tránsito');
  end if;

  if v_existing_id is null then
    insert into public.agreement_positions (
      agreement_id, product_id, client_product_match_id, client_product_id,
      sale_price, par_price, start_date, end_date,
      observations, created_by, updated_by
    ) values (
      v_agreement_id, v_row_transit.product_id, v_match_id, v_row_transit.client_product_id,
      v_row_transit.sale_price, v_row_transit.par_price, v_row_transit.start_date, v_row_transit.end_date,
      v_row_transit.observations, v_user, v_user
    ) returning id into v_promoted_id;
  else
    update public.agreement_positions set
      client_product_match_id = coalesce(v_match_id, client_product_match_id),
      sale_price   = v_row_transit.sale_price,
      par_price    = coalesce(v_row_transit.par_price, par_price),
      start_date   = coalesce(v_row_transit.start_date, start_date),
      end_date     = coalesce(v_row_transit.end_date, end_date),
      observations = coalesce(v_row_transit.observations, observations),
      updated_by   = v_user
    where id = v_existing_id;
    v_promoted_id := v_existing_id;
  end if;

  delete from public.agreement_transit_lines where id = p_line_id;
  return jsonb_build_object('promoted', true, 'position_id', v_promoted_id);
end;
$$;
revoke all on function public.update_agreement_line(uuid, text, jsonb, boolean) from public;
grant execute on function public.update_agreement_line(uuid, text, jsonb, boolean) to authenticated;
