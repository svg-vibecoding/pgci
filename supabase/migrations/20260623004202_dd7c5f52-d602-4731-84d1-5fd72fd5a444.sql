create extension if not exists pgcrypto;

create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;
alter table public.clients enable row level security;

create table if not exists public.client_companies (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references public.clients(id) on delete cascade,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.client_companies to authenticated;
grant all on public.client_companies to service_role;
alter table public.client_companies enable row level security;

create table if not exists public.agreements (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.agreements to authenticated;
grant all on public.agreements to service_role;
alter table public.agreements enable row level security;

create table if not exists public.agreement_products (
  id           uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  created_at   timestamptz not null default now()
);
grant select, insert, update, delete on public.agreement_products to authenticated;
grant all on public.agreement_products to service_role;
alter table public.agreement_products enable row level security;

create table if not exists public.agreement_costs (
  id           uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  created_at   timestamptz not null default now()
);
grant select, insert, update, delete on public.agreement_costs to authenticated;
grant all on public.agreement_costs to service_role;
alter table public.agreement_costs enable row level security;