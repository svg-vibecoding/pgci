
# Plan de migración: `agreement_groups` + FK real de empresas a `clients`

Reemplazamos el modelo actual (`agreements.client_id` obligatorio + `agreement_companies` con `tax_id` como texto libre) por un modelo con un **agrupador** (`agreement_groups`) y vínculos reales de empresas a `clients`. La visibilidad se resuelve por los clientes vinculados en `agreement_companies`.

Orden estricto: **schema → RLS/funciones → server functions → UI**.

---

## Paso 1 — Migration SQL (una sola migration)

Todo en un migration idempotente y transaccional. Antes de tocar RLS, se crea el schema y se hace backfill para que ninguna fila quede inconsistente.

### 1.1 Crear `public.agreement_groups`

- Columnas: `id`, `group_name text NOT NULL`, `client_id uuid NULL FK→clients(id) ON DELETE SET NULL`, `status text NOT NULL default 'active' CHECK IN ('active','inactive')`, `notes text NULL`, `created_at`, `updated_at`.
- Índices: `(client_id)`, `(status)`.
- GRANT `SELECT, INSERT, UPDATE, DELETE` a `authenticated`; `ALL` a `service_role`.
- ENABLE RLS.
- Trigger `set_updated_at` (ya existe la función).

### 1.2 Backfill: crear un grupo por cada acuerdo existente

Para cada fila en `agreements`:
- Insertar un `agreement_groups` con `client_id = agreements.client_id` y `group_name = clients.commercial_name ?? clients.legal_name`.
- Guardar el `group_id` resultante en la fila del acuerdo.

Se hace en un CTE con `INSERT ... RETURNING` mapeado 1:1, o vía función temporal en PL/pgSQL dentro del mismo migration.

### 1.3 Modificar `agreements`

- `ALTER TABLE agreements ADD COLUMN group_id uuid REFERENCES agreement_groups(id) ON DELETE RESTRICT` (nullable inicialmente).
- Poblar `group_id` con el backfill anterior.
- `ALTER COLUMN group_id SET NOT NULL`.
- Índice en `(group_id)`.
- `DROP COLUMN client_id` (después del backfill de `agreement_companies`, ver 1.4).

### 1.4 Backfill de `agreement_companies` con `client_id`

Antes de eliminar `agreements.client_id`:
- Para cada acuerdo, garantizar que existe una fila en `agreement_companies` vinculada al `clients.id` que hoy vive en `agreements.client_id` (si no existe una empresa que resuelva a ese `tax_id`, insertarla).
- Para las filas existentes de `agreement_companies`, resolver `client_id` haciendo lookup por `tax_id` contra `clients.tax_id`. Si alguna no resuelve, la migration debe **fallar** (RAISE EXCEPTION con el detalle) para forzar limpieza manual antes de correrla en prod.

### 1.5 Modificar `agreement_companies`

- `ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE RESTRICT` (nullable inicialmente).
- Poblar según 1.4.
- `SET NOT NULL` y añadir `UNIQUE (agreement_id, client_id)` (reemplaza el uniq previo por `tax_id`).
- `DROP COLUMN tax_id`, `tax_id_type`, `legal_name`.
- Conservar `id`, `agreement_id`, `client_id`, `notes`, `created_at` (+ metadatos existentes).
- Índice en `(client_id)`.

### 1.6 Drop `agreements.client_id`

Al final del schema, ya sin dependencias funcionales.

### 1.7 Recrear vista `agreements_with_counts`

Reemplaza `client_id / client_legal_name / client_commercial_name` por:
- `group_id`, `group_name` (desde `agreement_groups`)
- `group_client_id` (nullable — si el grupo apunta a un `clients`)
- Contadores existentes intactos (posiciones por estado, miembros, empresas).

---

## Paso 2 — RLS y funciones auxiliares

Nueva regla: **un usuario ve un acuerdo si tiene acceso a al menos un cliente en `agreement_companies` de ese acuerdo** (o es `super_admin`).

### 2.1 `user_can_access_agreement(p_user_id, p_agreement_id)` — reescribir

Devuelve true si:
- El usuario es `super_admin` activo, o
- `EXISTS (SELECT 1 FROM agreement_companies ac JOIN profiles p ON p.user_id = p_user_id WHERE ac.agreement_id = p_agreement_id AND p.status='active' AND user_has_client_access(p_user_id, ac.client_id))`
- Además debe ser miembro (`agreement_members`) — mantener el requisito actual de membresía.

### 2.2 `get_agreement_role` — actualizar

Quitar el join a `agreements.client_id`; validar acceso vía `EXISTS` sobre `agreement_companies`.

### 2.3 `can_view_costs` — actualizar igual (acceso por `agreement_companies`).

### 2.4 `get_agreement_client_id(p_agreement_id)` — **deprecar**

Se elimina o se reescribe como `get_agreement_group_id`. Reemplazo funcional: no hay "el cliente del acuerdo"; hay N empresas. Cualquier consumidor debe migrar a `agreement_companies` o al `group_id`.

### 2.5 `check_agreement_client_access` (trigger BEFORE INSERT en agreements) — actualizar

Ya no valida `client_id`. Se elimina el trigger, o se reemplaza por una regla sobre el grupo: si `agreement_groups.client_id IS NOT NULL`, el creador debe tener `can_create_agreements` sobre ese cliente; si es NULL (agrupador libre), solo `super_admin` puede crearlo. La política concreta se define en 3.1.

### 2.6 `can_create_agreements_for_client` — mantener (se sigue usando en 3.1 y para el picker de agrupadores).

### 2.7 Políticas RLS de `agreements`

- `SELECT`: `can_access_agreement(id)` (usa la nueva lógica).
- `INSERT`: validación se mueve a la server function (2.5).
- `UPDATE`/`DELETE`: `can_admin_agreement(id)`.

### 2.8 Políticas RLS de `agreement_companies`

- `SELECT`: `can_access_agreement(agreement_id)`.
- `INSERT`/`DELETE`: `can_admin_agreement(agreement_id)` **y** `has_client_access(client_id)` (evita que un admin vincule clientes fuera de su alcance).
- `UPDATE`: `can_admin_agreement(agreement_id)`.

### 2.9 Políticas RLS de `agreement_groups`

- `SELECT`: `is_super_admin()` **o** `EXISTS` sobre `agreements` del grupo con `can_access_agreement`.
- `INSERT`: `is_super_admin()` o (`client_id IS NOT NULL AND can_create_agreements_for_client(client_id)`).
- `UPDATE`/`DELETE`: `is_super_admin()` (los grupos son entidad de gobierno).

### 2.10 Todas las políticas y funciones dependientes de `agreements.client_id` deben revisarse

Búsqueda obligatoria antes de cerrar el migration: cualquier policy en `agreement_products`, `agreement_members`, `agreement_change_requests`, `agreement_costs`, `agreement_sku_links`, `agreement_product_alternatives` que hoy referencie `agreements.client_id` (directa o vía `get_agreement_client_id`) se reescribe para pasar por `can_access_agreement` / `can_admin_agreement`.

---

## Paso 3 — Server functions (`src/lib/agreements.functions.ts` + `agreements.server.ts`)

### 3.1 `createAgreement`

- Nuevo input: `{ group_mode: 'existing_client' | 'existing_group' | 'new_free', client_id?, group_id?, group_name?, name, scope, unit_name, start_date, end_date, observations }`.
- Flujo:
  - `existing_client`: verificar `can_create_agreements_for_client(client_id)`; buscar o crear `agreement_groups` con ese `client_id`; usar su `id` como `group_id`.
  - `existing_group`: verificar que el usuario ve el grupo (via policy).
  - `new_free`: solo `super_admin`; crea `agreement_groups` con `client_id NULL` y `group_name` libre.
- Inserta `agreements` con `group_id`.
- Añade al creador como `agreement_admin` (igual que hoy).
- Ya **no** setea `client_id` en `agreements`.

### 3.2 `listAssignableClients` → renombrar a `listAssignableGroups`

Devuelve dos secciones: (a) grupos existentes visibles al usuario, (b) clientes sobre los que puede crear acuerdo (para crear grupo automático). Consumido por el nuevo selector de agrupador.

### 3.3 `addAgreementCompany`

- Nuevo input: `{ agreement_id, client_id, notes? }`. Se elimina `tax_id`/`tax_id_type`/`legal_name`.
- Verifica `can_admin_agreement` (ya lo hace) y que el cliente sea accesible para el usuario.
- Inserta `{ agreement_id, client_id, notes }`.

### 3.4 `listAgreementCompanies`

- Simplificar: hoy hace lookup por `tax_id`; con FK real es un join directo a `clients` (con `parent_client_id → clients` para el nombre del holding).
- Devuelve `{ id, client_id, client_display_name, client_type, parent_client_name, tax_id, notes }`.

### 3.5 `removeAgreementCompany`

- Regla de seguridad: no permitir remover la última empresa de un acuerdo (dejaría el acuerdo sin visibilidad). Validar `count > 1` antes de borrar, o mover la regla a un trigger.

### 3.6 `assertCanCreateForClient`, `getAgreementClientId` (en `agreements.server.ts`)

- `getAgreementClientId` se elimina; los tres call-sites internos (`agreements.functions.ts:772, 964, 971`) se reescriben para operar por `agreement_id` o por el `client_id` explícito del contexto (ej. `ensureClientProduct` recibe `client_id` desde el llamador).
- `assertCanCreateForClient` se mantiene (lo usa 3.1).

### 3.7 Todas las lecturas de `agreements` que hoy seleccionan `client_id, client_legal_name, client_commercial_name`

Se actualizan a `group_id, group_name, group_client_id` (vía vista `agreements_with_counts`).

### 3.8 `commit_agreement_import` (SQL fn)

Hoy resuelve `v_client_id` desde `agreements.client_id`. Se reescribe: si el acuerdo tiene exactamente una empresa vinculada, usa ese `client_id` para `client_products` / `client_product_match`. Si tiene >1, requiere que el payload indique el `client_id` destino (nuevo campo obligatorio del preview cuando N>1). El preview/UI de import se ajusta acorde en el Paso 4.

---

## Paso 4 — UI

### 4.1 `AgreementForm.tsx`

- Reemplaza `Cliente` por **Agrupador** con tres modos:
  - Radio o segmented: `Cliente existente` / `Grupo existente` / `Nuevo grupo (libre)`.
  - `Cliente existente`: `<Select>` alimentado por `listAssignableGroups().clients` (mismo comportamiento actual — crea grupo implícito).
  - `Grupo existente`: `<Select>` alimentado por `listAssignableGroups().groups`.
  - `Nuevo grupo libre`: `<Input>` para `group_name` (solo visible/permitido para `super_admin`).
- Elimina `lockClient` / renombra a `lockGroup` para la vista de edición.

### 4.2 `agreements.new.tsx`

- Ajustar tipo `AgreementFormValues` y payload al nuevo shape del Paso 3.1.
- El querystring `?client=` sigue funcionando: precarga modo `Cliente existente` con ese `client_id`.

### 4.3 `agreements.index.tsx` (listado)

- Columna **Cliente** → **Agrupador**: muestra `group_name`. Si `group_client_id` no es null, mostrar debajo un chip pequeño "Cliente registrado".
- Filtros que hoy usan `client_id` pasan a `group_id`.

### 4.4 `AgreementCompaniesSection.tsx`

- Conserva el picker de clientes actual (ya usa FK visual).
- Cambia el `add.mutate` para enviar `{ agreement_id, client_id }` (sin `tax_id`).
- Ajusta el mapeo de columnas al nuevo shape de `listAgreementCompanies` (join directo, sin lookup extra).
- Muestra badge/aviso cuando quedaría una sola empresa (bloquea remover).

### 4.5 `agreements.$agreementId.index.tsx` / `.edit.tsx`

- Panel "Información del acuerdo": reemplazar "Cliente" por "Agrupador".
- `edit.tsx`: el agrupador es inmutable (o solo editable por `super_admin`). Definir: **inmutable** en esta fase.

### 4.6 Import wizard (`AgreementImportWizard.tsx`)

- Cuando el acuerdo tenga >1 empresa vinculada, agregar paso previo "¿A qué empresa aplican estos códigos de cliente?" con `<Select>` de las empresas del acuerdo. Ese `client_id` viaja en el payload a `commit_agreement_import`.

---

## Riesgos / decisiones a confirmar

1. **Backfill que falla si un `agreement_companies.tax_id` no resuelve a un `clients.tax_id`**: preferimos falla dura antes que crear clientes fantasma. Confirmar.
2. **Grupos libres (`client_id NULL`)**: restringidos a `super_admin` para crear. Confirmar.
3. **Última empresa vinculada**: se bloquea remover para no dejar el acuerdo sin visibilidad. Confirmar (alternativa: permitir y que solo `super_admin` lo vea).
4. **`commit_agreement_import` con N>1 empresas**: exige selección explícita de `client_id` destino. Confirmar (alternativa: rechazar import si N>1 y forzar uno por empresa).
5. **Agrupador inmutable** una vez creado el acuerdo (excepto `super_admin`). Confirmar.

Cuando confirmes (o ajustes) estos cinco puntos, ejecuto el plan en el orden descrito.
