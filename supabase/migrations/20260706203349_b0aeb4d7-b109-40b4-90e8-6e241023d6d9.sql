-- =====================================================================
-- Piloto: historizar agreement_members
-- =====================================================================

-- 1) Columnas de período y trazabilidad
alter table public.agreement_members
  add column if not exists valid_from   timestamptz,
  add column if not exists valid_until  timestamptz,
  add column if not exists started_by   uuid references auth.users(id) on delete set null,
  add column if not exists ended_by     uuid references auth.users(id) on delete set null,
  add column if not exists ended_reason text;

-- Backfill de filas existentes: el período abierto arranca en created_at
-- y el autor del alta es quien haya quedado en assigned_by.
update public.agreement_members
   set valid_from = coalesce(valid_from, created_at),
       started_by = coalesce(started_by, assigned_by);

-- Ahora valid_from puede volverse NOT NULL con default now().
alter table public.agreement_members
  alter column valid_from set not null,
  alter column valid_from set default now();

-- 2) Reemplazar la unicidad rígida por unicidad parcial "solo período abierto".
--    agreement_members_agreement_id_user_id_key nace de un `unique (...)` inline,
--    así que Postgres lo trata como CONSTRAINT, no como índice suelto.
alter table public.agreement_members
  drop constraint if exists agreement_members_agreement_id_user_id_key;

create unique index if not exists agreement_members_open_period_uniq
  on public.agreement_members (agreement_id, user_id)
  where valid_until is null;

-- 3) Checks de coherencia del período.
alter table public.agreement_members
  drop constraint if exists agreement_members_period_valid;
alter table public.agreement_members
  add constraint agreement_members_period_valid
  check (valid_until is null or valid_until >= valid_from);

alter table public.agreement_members
  drop constraint if exists agreement_members_closure_consistent;
alter table public.agreement_members
  add constraint agreement_members_closure_consistent
  check ((valid_until is null) = (ended_by is null));

-- 4) Trigger: "no dejar el acuerdo sin agreement_admin".
--    Conserva INTACTO el guard de cascade (bug 2026-07-03): si el acuerdo padre
--    ya no existe, permite el DELETE del miembro. Ahora cuenta solo admins con
--    período abierto (valid_until is null).
create or replace function public.prevent_last_agreement_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  admin_count integer;
  becoming_closed boolean;
begin
  -- CASCADE: si el acuerdo padre está siendo eliminado, permitir.
  if tg_op = 'DELETE'
     and not exists (select 1 from public.agreements where id = old.agreement_id) then
    return old;
  end if;

  becoming_closed := (tg_op = 'UPDATE'
                      and old.valid_until is null
                      and new.valid_until is not null);

  if (tg_op = 'DELETE'   and old.role = 'agreement_admin' and old.valid_until is null)
     or (becoming_closed and old.role = 'agreement_admin')
     or (tg_op = 'UPDATE' and old.role = 'agreement_admin'
         and new.role <> 'agreement_admin'
         and old.valid_until is null
         and new.valid_until is null) then
    select count(*) into admin_count
      from public.agreement_members
     where agreement_id = old.agreement_id
       and role = 'agreement_admin'
       and valid_until is null
       and id <> old.id;
    if admin_count = 0 then
      raise exception 'An agreement must have at least one agreement_admin';
    end if;
  end if;
  return coalesce(new, old);
end;
$function$;

-- 5) Trigger: agregar al creador como admin. Respeta unicidad parcial y
--    registra started_by.
create or replace function public.add_creator_as_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.agreement_members
    (agreement_id, user_id, role, assigned_by, started_by)
  values
    (new.id, auth.uid(), 'agreement_admin', auth.uid(), auth.uid())
  on conflict (agreement_id, user_id) where valid_until is null do nothing;
  return new;
end;
$function$;

-- 6) Funciones de rol / acceso / costos: agregar `and am.valid_until is null`
--    a cada lectura directa de agreement_members.
create or replace function public.get_agreement_role(p_agreement_id uuid)
returns text
language sql
stable security definer
set search_path = public
as $function$
  SELECT CASE WHEN public.is_super_admin() THEN 'super_admin'
    ELSE (
      SELECT am.role FROM public.agreement_members am
        JOIN public.profiles p ON p.user_id = am.user_id
       WHERE am.agreement_id = p_agreement_id
         AND am.user_id = auth.uid()
         AND am.valid_until IS NULL
         AND p.status = 'active'
         AND EXISTS (
           SELECT 1 FROM public.agreement_companies ac
            WHERE ac.agreement_id = p_agreement_id
              AND public.user_has_client_access(auth.uid(), ac.client_id)
         )
       LIMIT 1
    )
  END;
$function$;

create or replace function public.user_can_access_agreement(p_user_id uuid, p_agreement_id uuid)
returns boolean
language sql
stable security definer
set search_path = public
as $function$
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
         AND am.valid_until IS NULL
         AND p.status = 'active'
         AND EXISTS (
           SELECT 1 FROM public.agreement_companies ac
            WHERE ac.agreement_id = p_agreement_id
              AND public.user_has_client_access(p_user_id, ac.client_id)
         )
    );
$function$;

create or replace function public.can_view_costs(p_agreement_id uuid)
returns boolean
language sql
stable security definer
set search_path = public
as $function$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.agreement_members am
      JOIN public.profiles p ON p.user_id = am.user_id
     WHERE am.agreement_id = p_agreement_id
       AND am.user_id = auth.uid()
       AND am.valid_until IS NULL
       AND am.can_view_costs = true
       AND p.status = 'active'
       AND EXISTS (
         SELECT 1 FROM public.agreement_companies ac
          WHERE ac.agreement_id = p_agreement_id
            AND public.user_has_client_access(auth.uid(), ac.client_id)
       )
  );
$function$;

-- 7) Vista: my_role y members_count filtran solo períodos abiertos.
--    companies_count NO cambia (fuera del piloto).
create or replace view public.agreements_with_counts as
  SELECT a.id,
     a.group_id,
     g.group_name,
     g.client_id AS group_client_id,
     gc.commercial_name AS group_client_commercial_name,
     gc.legal_name AS group_client_legal_name,
     gc.tax_id AS group_client_tax_id,
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
     ( SELECT am.role
            FROM agreement_members am
           WHERE am.agreement_id = a.id
             AND am.user_id = auth.uid()
             AND am.valid_until IS NULL
          LIMIT 1) AS my_role,
     COALESCE(counts.total, 0::bigint) AS lines_total,
     COALESCE(counts.active, 0::bigint) AS lines_active,
     COALESCE(counts.pending, 0::bigint) AS lines_pending,
     COALESCE(counts.review, 0::bigint) AS lines_review,
     COALESCE(counts.excluded, 0::bigint) AS lines_excluded,
     COALESCE(( SELECT count(*) AS count
            FROM agreement_members am2
           WHERE am2.agreement_id = a.id
             AND am2.valid_until IS NULL), 0::bigint) AS members_count,
     COALESCE(( SELECT count(*) AS count
            FROM agreement_companies ac
           WHERE ac.agreement_id = a.id), 0::bigint) AS companies_count
    FROM agreements a
      LEFT JOIN agreement_groups g ON g.id = a.group_id
      LEFT JOIN clients gc ON gc.id = g.client_id
      LEFT JOIN LATERAL ( SELECT count(*) FILTER (WHERE agreement_products.status <> 'excluded'::text) AS total,
             count(*) FILTER (WHERE agreement_products.status = 'active'::text) AS active,
             count(*) FILTER (WHERE agreement_products.status = 'pending'::text) AS pending,
             count(*) FILTER (WHERE agreement_products.status = 'requires_review'::text) AS review,
             count(*) FILTER (WHERE agreement_products.status = 'excluded'::text) AS excluded
            FROM agreement_products
           WHERE agreement_products.agreement_id = a.id) counts ON true;