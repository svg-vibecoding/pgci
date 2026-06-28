
-- =============================================================================
-- PGCI 03.20 — Acuerdos Comerciales: schema + RLS de tablas nuevas
-- =============================================================================

-- A.0 · Guard: agreement_costs debe estar vacía antes del DROP/recreate
do $$
declare v_count bigint;
begin
  select count(*) into v_count from public.agreement_costs;
  if v_count > 0 then
    raise exception 'Abort: public.agreement_costs tiene % filas; el plan asume tabla vacía para reestructurar', v_count;
  end if;
end $$;


-- =============================================================================
-- A.1 · agreements — completar columnas funcionales
-- =============================================================================
alter table public.agreements
  add column if not exists name         text,
  add column if not exists scope        text not null default 'global',
  add column if not exists unit_name    text,
  add column if not exists status       text not null default 'active',
  add column if not exists start_date   date,
  add column if not exists end_date     date,
  add column if not exists observations text;

-- name debe quedar NOT NULL (puede haber filas sin nombre en stubs)
update public.agreements set name = coalesce(name, 'Sin nombre') where name is null;
alter table public.agreements alter column name set not null;

-- Constraints (idempotentes vía bloque)
do $$ begin
  alter table public.agreements
    add constraint agreements_scope_check check (scope in ('global','unit'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.agreements
    add constraint agreements_status_check check (status in ('active','inactive'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.agreements
    add constraint unit_name_required_for_unit_scope check (
      scope = 'global' or (scope = 'unit' and unit_name is not null and trim(unit_name) <> '')
    );
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.agreements
    add constraint agreement_dates_coherent check (
      start_date is null or end_date is null or start_date <= end_date
    );
exception when duplicate_object then null; end $$;

drop trigger if exists set_agreements_updated_at on public.agreements;
create trigger set_agreements_updated_at
  before update on public.agreements
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.agreements to authenticated;
grant all on public.agreements to service_role;


-- =============================================================================
-- A.2 · agreement_companies (tabla nueva)
-- =============================================================================
create table if not exists public.agreement_companies (
  id           uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  tax_id       text not null,
  tax_id_type  text not null default 'NIT' check (tax_id_type in ('NIT','RFC','EIN','Otro')),
  legal_name   text,
  notes        text,
  created_at   timestamptz not null default now(),
  unique (agreement_id, tax_id, tax_id_type)
);

grant select, insert, update, delete on public.agreement_companies to authenticated;
grant all on public.agreement_companies to service_role;

alter table public.agreement_companies enable row level security;

drop policy if exists agco_select on public.agreement_companies;
create policy agco_select on public.agreement_companies
  for select to authenticated
  using (public.is_super_admin() or public.can_access_agreement(agreement_id));

drop policy if exists agco_insert on public.agreement_companies;
create policy agco_insert on public.agreement_companies
  for insert to authenticated
  with check (public.is_super_admin() or public.can_admin_agreement(agreement_id));

drop policy if exists agco_update on public.agreement_companies;
create policy agco_update on public.agreement_companies
  for update to authenticated
  using (public.is_super_admin() or public.can_admin_agreement(agreement_id))
  with check (public.is_super_admin() or public.can_admin_agreement(agreement_id));

drop policy if exists agco_delete on public.agreement_companies;
create policy agco_delete on public.agreement_companies
  for delete to authenticated
  using (public.is_super_admin() or public.can_admin_agreement(agreement_id));


-- =============================================================================
-- A.3 · agreement_products — completar columnas funcionales
-- =============================================================================
alter table public.agreement_products
  add column if not exists client_product_match_id uuid,
  add column if not exists sale_price      numeric(14,4),
  add column if not exists par_price       numeric(14,4),
  add column if not exists start_date      date,
  add column if not exists end_date        date,
  add column if not exists observations    text,
  add column if not exists status          text not null default 'pending',
  add column if not exists pending_reason  text,
  add column if not exists excluded_reason text,
  add column if not exists excluded_by     uuid references auth.users(id) on delete set null,
  add column if not exists excluded_at     timestamptz,
  add column if not exists updated_by      uuid references auth.users(id) on delete set null,
  add column if not exists created_by      uuid references auth.users(id) on delete set null,
  add column if not exists updated_at      timestamptz not null default now();

do $$ begin
  alter table public.agreement_products
    add constraint agreement_products_status_check
    check (status in ('active','pending','requires_review','excluded'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.agreement_products
    add constraint sale_price_non_negative check (sale_price is null or sale_price >= 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.agreement_products
    add constraint par_price_non_negative check (par_price is null or par_price >= 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.agreement_products
    add constraint agreement_product_dates_coherent check (
      start_date is null or end_date is null or start_date <= end_date
    );
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.agreement_products
    add constraint excluded_fields_required check (
      status <> 'excluded' or (excluded_by is not null and excluded_at is not null)
    );
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.agreement_products
    add constraint pending_reason_only_for_pending check (
      status = 'pending' or pending_reason is null
    );
exception when duplicate_object then null; end $$;

drop trigger if exists set_agreement_products_updated_at on public.agreement_products;
create trigger set_agreement_products_updated_at
  before update on public.agreement_products
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.agreement_products to authenticated;
grant all on public.agreement_products to service_role;


-- =============================================================================
-- A.4 · Trigger de recálculo de estado en agreement_products
-- =============================================================================
create or replace function public.recalc_agreement_product_status()
returns trigger language plpgsql
security definer set search_path = public as $$
declare
  v_agr_start  date;
  v_agr_end    date;
  v_start      date;
  v_end        date;
  v_sku_active boolean;
  v_reasons    text[];
begin
  if new.status = 'excluded' then
    return new;
  end if;

  select start_date, end_date
    into v_agr_start, v_agr_end
    from public.agreements
   where id = new.agreement_id;

  v_start := coalesce(new.start_date, v_agr_start);
  v_end   := coalesce(new.end_date,   v_agr_end);

  if new.product_id is not null then
    select (status = 'active')
      into v_sku_active
      from public.products
     where id = new.product_id;
  end if;

  if new.product_id is not null and v_sku_active = false then
    new.status         := 'requires_review';
    new.pending_reason := null;
    return new;
  end if;

  if v_end is not null and v_end < current_date then
    new.status         := 'requires_review';
    new.pending_reason := null;
    return new;
  end if;

  v_reasons := array[]::text[];
  if new.product_id is null then
    v_reasons := array_append(v_reasons, 'no_sku');
  end if;
  if new.sale_price is null or new.sale_price = 0 then
    v_reasons := array_append(v_reasons, 'no_price');
  end if;
  if v_start is null or v_end is null then
    v_reasons := array_append(v_reasons, 'no_dates');
  end if;

  if array_length(v_reasons, 1) > 0 then
    new.status         := 'pending';
    new.pending_reason := array_to_string(v_reasons, ',');
    return new;
  end if;

  new.status         := 'active';
  new.pending_reason := null;
  return new;
end;
$$;

drop trigger if exists recalc_agreement_product_status_trigger on public.agreement_products;
create trigger recalc_agreement_product_status_trigger
  before insert or update of product_id, sale_price, start_date, end_date, status
  on public.agreement_products
  for each row execute function public.recalc_agreement_product_status();


-- =============================================================================
-- A.5 · agreement_product_alternatives (tabla nueva)
-- =============================================================================
create table if not exists public.agreement_product_alternatives (
  id                   uuid primary key default gen_random_uuid(),
  agreement_product_id uuid not null references public.agreement_products(id) on delete cascade,
  product_id           uuid not null references public.products(id) on delete restrict,
  notes                text,
  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  unique (agreement_product_id, product_id)
);

grant select, insert, update, delete on public.agreement_product_alternatives to authenticated;
grant all on public.agreement_product_alternatives to service_role;

alter table public.agreement_product_alternatives enable row level security;

drop policy if exists apa_select on public.agreement_product_alternatives;
create policy apa_select on public.agreement_product_alternatives
  for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.agreement_products ap
       where ap.id = agreement_product_alternatives.agreement_product_id
         and public.can_access_agreement(ap.agreement_id)
    )
  );

drop policy if exists apa_insert on public.agreement_product_alternatives;
create policy apa_insert on public.agreement_product_alternatives
  for insert to authenticated
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.agreement_products ap
       where ap.id = agreement_product_alternatives.agreement_product_id
         and public.can_admin_agreement(ap.agreement_id)
    )
  );

drop policy if exists apa_update on public.agreement_product_alternatives;
create policy apa_update on public.agreement_product_alternatives
  for update to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.agreement_products ap
       where ap.id = agreement_product_alternatives.agreement_product_id
         and public.can_admin_agreement(ap.agreement_id)
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.agreement_products ap
       where ap.id = agreement_product_alternatives.agreement_product_id
         and public.can_admin_agreement(ap.agreement_id)
    )
  );

drop policy if exists apa_delete on public.agreement_product_alternatives;
create policy apa_delete on public.agreement_product_alternatives
  for delete to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.agreement_products ap
       where ap.id = agreement_product_alternatives.agreement_product_id
         and public.can_admin_agreement(ap.agreement_id)
    )
  );


-- =============================================================================
-- A.6 · agreement_costs — reestructurar (DROP + recreate; tabla verificada vacía)
-- =============================================================================
drop table if exists public.agreement_costs cascade;

create table public.agreement_costs (
  id                   uuid primary key default gen_random_uuid(),
  agreement_product_id uuid not null references public.agreement_products(id) on delete cascade,
  cost_value           numeric(14,4),
  cost_source          text,
  valid_from           date,
  valid_until          date,
  notes                text,
  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  constraint cost_value_non_negative check (cost_value is null or cost_value >= 0),
  constraint cost_dates_coherent check (
    valid_from is null or valid_until is null or valid_from <= valid_until
  )
);

grant select, insert, update, delete on public.agreement_costs to authenticated;
grant all on public.agreement_costs to service_role;

alter table public.agreement_costs enable row level security;

-- Repoblar políticas de 03.00.02 adaptadas a la nueva FK (agreement_product_id → agreement_id)
drop policy if exists ac_select on public.agreement_costs;
create policy ac_select on public.agreement_costs
  for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.agreement_products ap
       where ap.id = agreement_costs.agreement_product_id
         and public.can_view_costs(ap.agreement_id)
    )
  );

drop policy if exists ac_insert on public.agreement_costs;
create policy ac_insert on public.agreement_costs
  for insert to authenticated
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.agreement_products ap
       where ap.id = agreement_costs.agreement_product_id
         and public.can_admin_agreement(ap.agreement_id)
    )
  );

drop policy if exists ac_update on public.agreement_costs;
create policy ac_update on public.agreement_costs
  for update to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.agreement_products ap
       where ap.id = agreement_costs.agreement_product_id
         and public.can_admin_agreement(ap.agreement_id)
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.agreement_products ap
       where ap.id = agreement_costs.agreement_product_id
         and public.can_admin_agreement(ap.agreement_id)
    )
  );

drop policy if exists ac_delete on public.agreement_costs;
create policy ac_delete on public.agreement_costs
  for delete to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.agreement_products ap
       where ap.id = agreement_costs.agreement_product_id
         and public.can_admin_agreement(ap.agreement_id)
    )
  );


-- =============================================================================
-- A.7 · Índices de soporte
-- =============================================================================
create index if not exists idx_agreements_client_id              on public.agreements (client_id);
create index if not exists idx_agreements_status                 on public.agreements (status);
create index if not exists idx_agreement_products_agreement_id   on public.agreement_products (agreement_id);
create index if not exists idx_agreement_products_status         on public.agreement_products (agreement_id, status);
create index if not exists idx_agreement_products_product_id     on public.agreement_products (product_id) where product_id is not null;
create index if not exists idx_agreement_companies_agreement_id  on public.agreement_companies (agreement_id);
create index if not exists idx_agreement_product_alternatives_product_id
  on public.agreement_product_alternatives (agreement_product_id);
