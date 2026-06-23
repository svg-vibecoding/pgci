-- S-01 Anexo A literal
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- clients (extiende stub)
create table if not exists public.clients (
  id              uuid primary key default gen_random_uuid(),
  commercial_name text not null,
  legal_name      text,
  erp_name        text,
  type            text not null check (type in ('holding', 'direct')),
  status          text not null default 'active' check (status in ('active', 'inactive')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.clients add column if not exists commercial_name text;
alter table public.clients add column if not exists legal_name      text;
alter table public.clients add column if not exists erp_name        text;
alter table public.clients add column if not exists type            text;
alter table public.clients add column if not exists status          text default 'active';
alter table public.clients add column if not exists notes           text;
alter table public.clients add column if not exists created_at      timestamptz default now();
alter table public.clients add column if not exists updated_at      timestamptz default now();

drop trigger if exists set_clients_updated_at on public.clients;
create trigger set_clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- client_companies (extiende stub)
create table if not exists public.client_companies (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid references public.clients(id) on delete restrict,
  legal_name      text not null,
  commercial_name text,
  erp_name        text,
  tax_id          text not null,
  tax_id_type     text not null default 'NIT' check (tax_id_type in ('NIT','RFC','EIN','Otro')),
  status          text not null default 'active' check (status in ('active','inactive')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.client_companies add column if not exists client_id       uuid references public.clients(id) on delete restrict;
alter table public.client_companies add column if not exists legal_name      text;
alter table public.client_companies add column if not exists commercial_name text;
alter table public.client_companies add column if not exists erp_name        text;
alter table public.client_companies add column if not exists tax_id          text;
alter table public.client_companies add column if not exists tax_id_type     text default 'NIT';
alter table public.client_companies add column if not exists status          text default 'active';
alter table public.client_companies add column if not exists notes           text;
alter table public.client_companies add column if not exists created_at      timestamptz default now();
alter table public.client_companies add column if not exists updated_at      timestamptz default now();

create unique index if not exists uq_client_companies_taxid
  on public.client_companies (client_id, tax_id_type, tax_id);

drop trigger if exists set_client_companies_updated_at on public.client_companies;
create trigger set_client_companies_updated_at
  before update on public.client_companies
  for each row execute function public.set_updated_at();

-- products (PIM)
create table if not exists public.products (
  id                       uuid primary key default gen_random_uuid(),
  sku                      text not null,
  erp_name                 text not null,
  commercial_name          text,
  erp_brand                text,
  commercial_brand         text,
  brand_reference          text,
  product_classification   text,
  erp_product_category_n1  text,
  erp_product_category_n2  text,
  erp_product_category_n3  text,
  commercial_unit          text,
  status                   text not null default 'active' check (status in ('active','inactive')),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table public.products add column if not exists sku                      text;
alter table public.products add column if not exists erp_name                 text;
alter table public.products add column if not exists commercial_name          text;
alter table public.products add column if not exists erp_brand                text;
alter table public.products add column if not exists commercial_brand         text;
alter table public.products add column if not exists brand_reference          text;
alter table public.products add column if not exists product_classification   text;
alter table public.products add column if not exists erp_product_category_n1  text;
alter table public.products add column if not exists erp_product_category_n2  text;
alter table public.products add column if not exists erp_product_category_n3  text;
alter table public.products add column if not exists commercial_unit          text;
alter table public.products add column if not exists status                   text default 'active';
alter table public.products add column if not exists created_at               timestamptz default now();
alter table public.products add column if not exists updated_at               timestamptz default now();

create unique index if not exists uq_products_sku on public.products (sku);

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create index if not exists idx_clients_status            on public.clients (status);
create index if not exists idx_clients_type              on public.clients (type);
create index if not exists idx_client_companies_client   on public.client_companies (client_id);
create index if not exists idx_client_companies_status   on public.client_companies (status);
create index if not exists idx_products_status           on public.products (status);
create index if not exists idx_products_erp_name         on public.products (erp_name);

-- GRANTs requeridos por Lovable Cloud
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

-- S-01 Anexo B — RLS de products
alter table public.products enable row level security;

drop policy if exists products_select on public.products;
create policy products_select on public.products for select to authenticated
  using ( public.is_active_user(auth.uid()) );

drop policy if exists products_insert on public.products;
create policy products_insert on public.products for insert to authenticated
  with check ( public.is_super_admin() );

drop policy if exists products_update on public.products;
create policy products_update on public.products for update to authenticated
  using ( public.is_super_admin() )
  with check ( public.is_super_admin() );

drop policy if exists products_delete on public.products;
create policy products_delete on public.products for delete to authenticated
  using ( public.is_super_admin() );
