
-- =========================================================
-- client_products
-- =========================================================
create table if not exists public.client_products (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  client_code text not null,
  status      text not null default 'active' check (status in ('active','inactive')),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (client_id, client_code)
);

grant select, insert, update, delete on public.client_products to authenticated;
grant all on public.client_products to service_role;

alter table public.client_products enable row level security;

drop policy if exists "client_products_select" on public.client_products;
create policy "client_products_select" on public.client_products
  for select to authenticated
  using (public.is_super_admin() or public.has_client_access(client_id));

drop policy if exists "client_products_insert" on public.client_products;
create policy "client_products_insert" on public.client_products
  for insert to authenticated
  with check (public.is_super_admin() or public.has_client_access(client_id));

drop policy if exists "client_products_update" on public.client_products;
create policy "client_products_update" on public.client_products
  for update to authenticated
  using (public.is_super_admin() or public.has_client_access(client_id))
  with check (public.is_super_admin() or public.has_client_access(client_id));

drop policy if exists "client_products_delete" on public.client_products;
create policy "client_products_delete" on public.client_products
  for delete to authenticated
  using (public.is_super_admin() or public.has_client_access(client_id));

create index if not exists client_products_client_id_idx on public.client_products(client_id);

-- =========================================================
-- client_product_history (estructural V1)
-- =========================================================
create table if not exists public.client_product_history (
  id                uuid primary key default gen_random_uuid(),
  client_product_id uuid not null references public.client_products(id) on delete cascade,
  description       text,
  brand             text,
  valid_from        date not null,
  valid_until       date,
  created_at        timestamptz not null default now()
);

grant select, insert, update, delete on public.client_product_history to authenticated;
grant all on public.client_product_history to service_role;

alter table public.client_product_history enable row level security;

drop policy if exists "client_product_history_select" on public.client_product_history;
create policy "client_product_history_select" on public.client_product_history
  for select to authenticated
  using (
    public.is_super_admin() or exists (
      select 1 from public.client_products cp
       where cp.id = client_product_id
         and public.has_client_access(cp.client_id)
    )
  );

drop policy if exists "client_product_history_insert" on public.client_product_history;
create policy "client_product_history_insert" on public.client_product_history
  for insert to authenticated
  with check (
    public.is_super_admin() or exists (
      select 1 from public.client_products cp
       where cp.id = client_product_id
         and public.has_client_access(cp.client_id)
    )
  );

drop policy if exists "client_product_history_update" on public.client_product_history;
create policy "client_product_history_update" on public.client_product_history
  for update to authenticated
  using (
    public.is_super_admin() or exists (
      select 1 from public.client_products cp
       where cp.id = client_product_id
         and public.has_client_access(cp.client_id)
    )
  )
  with check (
    public.is_super_admin() or exists (
      select 1 from public.client_products cp
       where cp.id = client_product_id
         and public.has_client_access(cp.client_id)
    )
  );

drop policy if exists "client_product_history_delete" on public.client_product_history;
create policy "client_product_history_delete" on public.client_product_history
  for delete to authenticated
  using (
    public.is_super_admin() or exists (
      select 1 from public.client_products cp
       where cp.id = client_product_id
         and public.has_client_access(cp.client_id)
    )
  );

create index if not exists client_product_history_cp_idx on public.client_product_history(client_product_id);

-- =========================================================
-- client_product_match
-- =========================================================
create table if not exists public.client_product_match (
  id                uuid primary key default gen_random_uuid(),
  client_product_id uuid not null references public.client_products(id) on delete cascade,
  product_id        uuid not null references public.products(id) on delete restrict,
  valid_from        date not null,
  valid_until       date,
  source            text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

grant select, insert, update, delete on public.client_product_match to authenticated;
grant all on public.client_product_match to service_role;

alter table public.client_product_match enable row level security;

drop policy if exists "client_product_match_select" on public.client_product_match;
create policy "client_product_match_select" on public.client_product_match
  for select to authenticated
  using (
    public.is_super_admin() or exists (
      select 1 from public.client_products cp
       where cp.id = client_product_id
         and public.has_client_access(cp.client_id)
    )
  );

drop policy if exists "client_product_match_insert" on public.client_product_match;
create policy "client_product_match_insert" on public.client_product_match
  for insert to authenticated
  with check (
    public.is_super_admin() or exists (
      select 1 from public.client_products cp
       where cp.id = client_product_id
         and public.has_client_access(cp.client_id)
    )
  );

drop policy if exists "client_product_match_update" on public.client_product_match;
create policy "client_product_match_update" on public.client_product_match
  for update to authenticated
  using (
    public.is_super_admin() or exists (
      select 1 from public.client_products cp
       where cp.id = client_product_id
         and public.has_client_access(cp.client_id)
    )
  )
  with check (
    public.is_super_admin() or exists (
      select 1 from public.client_products cp
       where cp.id = client_product_id
         and public.has_client_access(cp.client_id)
    )
  );

drop policy if exists "client_product_match_delete" on public.client_product_match;
create policy "client_product_match_delete" on public.client_product_match
  for delete to authenticated
  using (
    public.is_super_admin() or exists (
      select 1 from public.client_products cp
       where cp.id = client_product_id
         and public.has_client_access(cp.client_id)
    )
  );

create index if not exists client_product_match_cp_idx on public.client_product_match(client_product_id);
create index if not exists client_product_match_product_idx on public.client_product_match(product_id);

-- =========================================================
-- View: agreements_with_counts
-- =========================================================
drop view if exists public.agreements_with_counts;
create view public.agreements_with_counts
with (security_invoker = on) as
select
  a.id,
  a.client_id,
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
  c.commercial_name as client_commercial_name,
  c.legal_name      as client_legal_name,
  (select am.role from public.agreement_members am
     where am.agreement_id = a.id and am.user_id = auth.uid() limit 1) as my_role,
  coalesce(counts.total,    0) as lines_total,
  coalesce(counts.active,   0) as lines_active,
  coalesce(counts.pending,  0) as lines_pending,
  coalesce(counts.review,   0) as lines_review,
  coalesce(counts.excluded, 0) as lines_excluded
from public.agreements a
join public.clients c on c.id = a.client_id
left join lateral (
  select
    count(*) filter (where status <> 'excluded')       as total,
    count(*) filter (where status = 'active')          as active,
    count(*) filter (where status = 'pending')         as pending,
    count(*) filter (where status = 'requires_review') as review,
    count(*) filter (where status = 'excluded')        as excluded
  from public.agreement_products
  where agreement_id = a.id
) counts on true;

grant select on public.agreements_with_counts to authenticated;
