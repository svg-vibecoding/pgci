create table if not exists public.agreement_sku_links (
  id            uuid primary key default gen_random_uuid(),
  agreement_id  uuid not null references public.agreements(id) on delete cascade,
  product_id    uuid not null references public.products(id)   on delete restrict,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (agreement_id, product_id)
);

grant select, insert, update, delete on public.agreement_sku_links to authenticated;
grant all on public.agreement_sku_links to service_role;

alter table public.agreement_sku_links enable row level security;

drop policy if exists "agreement_sku_links_select" on public.agreement_sku_links;
create policy "agreement_sku_links_select"
  on public.agreement_sku_links
  for select
  to authenticated
  using (public.is_super_admin() or public.can_access_agreement(agreement_id));

drop policy if exists "agreement_sku_links_insert" on public.agreement_sku_links;
create policy "agreement_sku_links_insert"
  on public.agreement_sku_links
  for insert
  to authenticated
  with check (public.is_super_admin() or public.can_admin_agreement(agreement_id));

drop policy if exists "agreement_sku_links_update" on public.agreement_sku_links;
create policy "agreement_sku_links_update"
  on public.agreement_sku_links
  for update
  to authenticated
  using (public.is_super_admin() or public.can_admin_agreement(agreement_id))
  with check (public.is_super_admin() or public.can_admin_agreement(agreement_id));

drop policy if exists "agreement_sku_links_delete" on public.agreement_sku_links;
create policy "agreement_sku_links_delete"
  on public.agreement_sku_links
  for delete
  to authenticated
  using (public.is_super_admin() or public.can_admin_agreement(agreement_id));

create index if not exists idx_agreement_sku_links_agreement on public.agreement_sku_links(agreement_id);
create index if not exists idx_agreement_sku_links_product   on public.agreement_sku_links(product_id);