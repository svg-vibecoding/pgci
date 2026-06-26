
Mover `can_create_agreements` de `profiles` a `user_client_access` (por cliente). La columna ya existe en DB. El UserForm deja de gestionar clientes y el permiso de creación; ambos se manejarán en una vista propia `/setup/users/$userId/client-access` (no se crea en este plan, solo se enlaza).

---

## Cambio 1 — Simplificar UserForm y server functions

**`src/components/setup/UserForm.tsx`**
- Quitar de `UserFormValues` y `emptyUser`: `can_create_agreements` y `client_ids`.
- Eliminar el bloque del switch "Crear acuerdos en clientes asignados" + `hasNoClients` + `useEffect` que lo apaga.
- Eliminar toda la sección de clientes asignados (buscador, switch "Todos", chips, lista, `showClientsSection`, sort/filter helpers, prop `clients`).
- Form final: nombre completo, email, código ERP, estado, switch super admin.

**`src/routes/_authenticated/setup/users.new.tsx`**
- Eliminar query `clientOptions`.
- Quitar prop `clients` y `client_ids` del payload a `createUser`.

**`src/routes/_authenticated/setup/users.$userId.edit.tsx`**
- Eliminar queries `accessQ` y `clientsQ`; ajustar `isLoading` a solo `profileQ`.
- Quitar `client_ids` del `initial` y del payload a `updateUser`.
- Quitar prop `clients` y la invalidation de `user_client_access` en `onSuccess`.

**`src/lib/users.functions.ts`**
- `createUserSchema` y handler: eliminar `client_ids` por completo y el bloque que inserta en `user_client_access`. Quitar `can_create_agreements` del insert a `profiles`.
- `updateUserSchema` y handler: eliminar `client_ids` y todo el bloque de reconciliación (read existing → toInsert/toDelete → delete/insert en `user_client_access`). Quitar `can_create_agreements` del update a `profiles`.

---

## Cambio 2 — Listado de usuarios

**`src/routes/_authenticated/setup/users.index.tsx`**

Query: traer `user_id, can_create_agreements` de `user_client_access`, construir `accessCounts` y `createCounts`, mapear cada row con `client_count` y `create_count`. Eliminar `can_create_agreements` del select a `profiles`.

`UserRow`: agregar `create_count: number`; quitar `can_create_agreements`.

Columna **Capacidades**:
- `super_admin` → "Acceso total".
- `platform_user` `client_count===0` → "Sin clientes" (amber, igual que hoy).
- `platform_user` con clientes y `create_count===0` → mostrar solo el conteo de clientes, sin badge de creación.
- `platform_user` `create_count>0` → badge "Crea acuerdos en X de N" (info si X===N, warning si X<N).

`getUserIssues`: dejar solo
- `platform_user` sin clientes,
- usuario inactivo con clientes (`status==='inactive' && client_count>0`).
Eliminar referencias a `u.can_create_agreements`.

---

## Cambio 3 — Detalle de usuario

**`src/routes/_authenticated/setup/users.$userId.index.tsx`**

- Usar la query existente de `access` (user_client_access) para calcular N = total y X = filas con `can_create_agreements=true`.
- Reemplazar fila "Creación de acuerdos" en `Información del usuario`:
  - `super_admin` → "No aplica".
  - `platform_user` → "Puede crear acuerdos en X de N clientes", o "Sin permiso de creación" si X===0.
- En el header de la card `Cartera de clientes`, agregar botón **"Gestionar acceso"** → `/setup/users/$userId/client-access`, solo visible si `isSuperAdmin`. (No se crea esa ruta en este plan.)
- Indicadores superiores (Acuerdos asociados / Clientes asociados) intactos.

---

## Fuera de alcance

- Activar/inactivar, cambio de rol, flujo de contraseña temporal y modal de credenciales.
- Estilos y patrones visuales.
- Crear la vista `/setup/users/$userId/client-access` (solo se enlaza).
- Eliminar la columna `profiles.can_create_agreements` en DB (queda deprecada a nivel app).

## Notas técnicas

- `useMyProfile` (src/hooks/use-profile.ts) sigue seleccionando `can_create_agreements` de `profiles`. Queda fuera de este alcance; se puede limpiar en un cambio aparte.
