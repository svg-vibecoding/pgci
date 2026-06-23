## Resumen

Aprobado con stub adicional `client_companies`. Ejecuto en orden: habilitar Lovable Cloud → Migración 1 (stubs) → Migración 2 (Anexo A) → Migración 3 (Anexo B).

## Migración 1 — Foundation stubs

```sql
create extension if not exists pgcrypto;

-- clients (stub)
create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;
alter table public.clients enable row level security;

-- client_companies (stub) — client_id nullable a propósito
create table if not exists public.client_companies (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references public.clients(id) on delete cascade,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.client_companies to authenticated;
grant all on public.client_companies to service_role;
alter table public.client_companies enable row level security;

-- agreements (stub)
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

-- agreement_products (stub)
create table if not exists public.agreement_products (
  id           uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  created_at   timestamptz not null default now()
);
grant select, insert, update, delete on public.agreement_products to authenticated;
grant all on public.agreement_products to service_role;
alter table public.agreement_products enable row level security;

-- agreement_costs (stub)
create table if not exists public.agreement_costs (
  id           uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  created_at   timestamptz not null default now()
);
grant select, insert, update, delete on public.agreement_costs to authenticated;
grant all on public.agreement_costs to service_role;
alter table public.agreement_costs enable row level security;
```

Sin `GRANT ... TO anon`. Sin policies (las pone Anexo B). Sin columnas de negocio. Sin datos.

## Migración 2 — Anexo A S-08

Ejecución literal de `PGCI_4_S-08_Anexo_A_SQL_Schema.sql` (extensión, `set_updated_at`, tablas `profiles`/`user_client_access`/`agreement_members`/`agreement_change_requests`, los 3 triggers). Único añadido: `GRANT`s requeridos por Lovable Cloud después de cada `CREATE TABLE`:

```sql
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
grant select, insert, update, delete on public.user_client_access to authenticated;
grant all on public.user_client_access to service_role;
grant select, insert, update, delete on public.agreement_members to authenticated;
grant all on public.agreement_members to service_role;
grant select, insert, update, delete on public.agreement_change_requests to authenticated;
grant all on public.agreement_change_requests to service_role;
```

## Migración 3 — Anexo B S-08

Ejecución literal de `PGCI_4_S-08_Anexo_B_RLS_Policies.sql`: funciones auxiliares, `ENABLE ROW LEVEL SECURITY` donde aplique, y todas las `CREATE POLICY`.

## Fuera de alcance

Sin UI, sin formularios, sin costos/márgenes en UI, sin toggle `can_view_costs`, sin UI de `agreement_change_requests`, sin invitación de usuarios desde frontend, sin manejo de contraseñas.

## Reporte de cierre

Tablas creadas · funciones creadas · triggers activos · políticas RLS activas por tabla · dependencias pendientes para S-01/S-02/S-03 · errores o advertencias del migrador.
