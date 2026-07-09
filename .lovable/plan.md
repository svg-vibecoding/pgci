## Migración: limpiar datos de acuerdos y accesos (corregida)

Migración única, transaccional, solo `DELETE` de filas en `public`. No toca estructura, RLS, funciones ni triggers (solo los desactiva/reactiva puntualmente durante el borrado). No toca el esquema `auth`.

### Triggers en `DELETE` detectados en el schema vivo

Solo dos triggers disparan en `DELETE` sobre las tablas objetivo:

- `agreement_members.prevent_last_agreement_admin_removal_trigger` (BEFORE DELETE/UPDATE)
- `agreement_group_members.trg_prevent_last_group_admin_removal` (BEFORE DELETE/UPDATE)

Ambos protegen contra dejar un acuerdo/grupo sin admin. En borrado masivo son ruido — se desactivan solo esos dos, dentro de la transacción, y se reactivan al final. Los demás triggers de las tablas involucradas solo disparan en INSERT/UPDATE y no interfieren.

`session_replication_role` **no se usa** (innecesario y potencialmente sin privilegios en Supabase).

### SQL de la migración

```sql
BEGIN;

-- Desactivar solo los triggers que bloquean DELETE masivo
ALTER TABLE public.agreement_members
  DISABLE TRIGGER prevent_last_agreement_admin_removal_trigger;
ALTER TABLE public.agreement_group_members
  DISABLE TRIGGER trg_prevent_last_group_admin_removal;

-- 1. Historial / hijos de posiciones
DELETE FROM public.agreement_position_price_history;
DELETE FROM public.agreement_position_exclusions;
DELETE FROM public.agreement_position_alternatives;

-- 2. Posiciones y líneas en tránsito
DELETE FROM public.agreement_positions;
DELETE FROM public.agreement_transit_lines;

-- 3. Vínculos y metadatos de acuerdos
DELETE FROM public.agreement_sku_links;
DELETE FROM public.agreement_costs;
DELETE FROM public.agreement_change_requests;
DELETE FROM public.agreement_companies;
DELETE FROM public.agreement_members;

-- 4. Acuerdos
DELETE FROM public.agreements;

-- 5. Grupos de acuerdos
DELETE FROM public.agreement_group_members;
DELETE FROM public.agreement_groups;

-- 6. Matching y catálogo de cliente
DELETE FROM public.client_product_match;
DELETE FROM public.client_product_history;
DELETE FROM public.client_products;

-- 7. Accesos
DELETE FROM public.user_client_access;

-- 8. Perfiles (conservar solo sergio.velez@sumatec.co)
DELETE FROM public.profiles
 WHERE email <> 'sergio.velez@sumatec.co';

-- Reactivar triggers
ALTER TABLE public.agreement_members
  ENABLE TRIGGER prevent_last_agreement_admin_removal_trigger;
ALTER TABLE public.agreement_group_members
  ENABLE TRIGGER trg_prevent_last_group_admin_removal;

COMMIT;
```

Todo corre dentro de `BEGIN … COMMIT`: si cualquier paso falla, Postgres hace rollback completo — incluyendo los `ALTER TABLE … DISABLE TRIGGER`, que también son transaccionales — y la base queda idéntica al estado inicial. No hay estado intermedio posible.

### Se conserva intacto

- Tablas `clients`, `client_companies`, `products`.
- Perfil `sergio.velez@sumatec.co` con `role = 'super_admin'`, `status = 'active'`.
- Todas las políticas RLS, funciones, triggers (los dos desactivados se reactivan en el mismo COMMIT).
- Esquema `auth` (fuera del alcance; `auth.users` lo limpias manualmente).

### Verificación post-migración

Vía `supabase--read_query`:

- `select count(*) from public.profiles` → 1
- `select email, role, status from public.profiles` → `sergio.velez@sumatec.co / super_admin / active`
- `count = 0` en: `user_client_access`, `agreements`, `agreement_positions`, `agreement_transit_lines`, `agreement_companies`, `agreement_members`, `agreement_groups`, `agreement_group_members`, `agreement_costs`, `agreement_sku_links`, `agreement_change_requests`, `agreement_position_price_history`, `agreement_position_exclusions`, `agreement_position_alternatives`, `client_products`, `client_product_history`, `client_product_match`.
- `clients`, `client_companies`, `products` mantienen su conteo previo.
- Confirmar que ambos triggers quedan `ENABLED` (`SELECT tgname, tgenabled FROM pg_trigger WHERE tgname IN ('prevent_last_agreement_admin_removal_trigger','trg_prevent_last_group_admin_removal')` → `tgenabled = 'O'`).

### Fuera de alcance

- `auth.users` (manual desde el dashboard).
- Cambios de esquema, RLS, funciones o definición de triggers.
