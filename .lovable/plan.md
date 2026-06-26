# Edición de usuario: equiparar con creación

## Diagnóstico del estado actual (`users.$userId.edit.tsx`)

- Usa un layout propio (sin `CreateViewShell`) → tipografía/anchos/back link distintos a creación.
- No carga clientes asignados: `client_ids: []` se inicializa vacío, así que `UserForm` no muestra la sección de clientes y, si el usuario tenía asignaciones, aparecen como "sin selección".
- No persiste cambios de asignación: la mutación solo actualiza `profiles` y nunca toca `user_client_access`.
- No respeta el cambio de rol: al pasar a `super_admin` no se limpian asignaciones; al volver a `platform_user` no se reinstauran.
- `erp_user_code` se guarda directamente como `null` cuando viene vacío (ok) pero no valida duplicados ni longitud distinta de la del form.
- No hay permisos: cualquier sesión que cargue la ruta intenta el `update`; el servidor no lo bloquea como sí lo hace `createUser` (que valida `is_super_admin`).
- Mensajería de errores genérica (no distingue email/permisos/RLS).

## Cambios propuestos

### 1. Shell visual idéntico a creación
- Envolver en `CreateViewShell` con `BackLinkChrome` ("Volver al detalle de usuario").
- Título: `Editar usuario`. Descripción: `Actualiza los datos del usuario y sus clientes asignados. El email no se puede modificar.`
- Eliminar el `<header>`/botón sueltos actuales para que ancho (`max-w-2xl`), tipografía y separaciones coincidan con `users.new.tsx`.

### 2. Cargar datos completos (perfil + asignaciones)
- Reemplazar el `useQuery` único por dos queries en paralelo:
  - `profiles` por `user_id` (igual que hoy).
  - `user_client_access` filtrado por `user_id` → array de `client_id`.
  - `clients` activos con el mismo `select` que usa `users.new.tsx` (incluye `parent` para badges/holding) → se pasa como `clients={...}` a `UserForm`.
- Inicial del form: `client_ids` viene de `user_client_access`. Si el rol es `super_admin`, `UserForm` ya oculta la sección automáticamente.
- Loading: skeleton consistente (mismo patrón que detalle).

### 3. Mutación que guarda perfil + accesos (server function nueva)
Crear `updateUser` en `src/lib/users.functions.ts` siguiendo el patrón de `createUser`:

- Middleware `requireSupabaseAuth` + validación `is_super_admin` (no permitir auto-edición de rol/estado sin permiso).
- Zod schema: `user_id`, `full_name`, `role`, `status`, `can_create_agreements`, `erp_user_code` (nullable), `client_ids` (uuid[]).
- Lógica:
  1. `update` en `profiles` (no toca `email`).
  2. Si `role === 'super_admin'` → `delete` todos los `user_client_access` del usuario.
  3. Si `role === 'platform_user'` → reconciliar:
     - Leer accesos actuales.
     - Insertar los nuevos (los que no estaban).
     - Borrar los que ya no están seleccionados.
     - `assigned_by = userId` del super admin que edita.
  4. Devolver `{ user_id }` y dejar que el cliente invalide `['users']` y `['users', userId]`.
- Errores específicos: permisos, RLS, `not found`.

### 4. Componente `EditUser` refactor
- Reemplazar la mutación inline por `useServerFn(updateUser)`.
- Submit: pasa `v.role === 'platform_user' ? v.client_ids : []` (mismo criterio que creación).
- Éxito: toast "Usuario actualizado", invalidar queries y navegar a `/setup/users/$userId`.
- `onCancel` y `BackLinkChrome` apuntan al detalle.

### 5. Guard de UI
- Si el perfil cargado tiene `status === 'inactive'`, mostrar un `Alert` informativo arriba del form ("Este usuario está inactivo. Los cambios se guardarán pero no podrá ingresar hasta activarlo."). No bloquea la edición.

### 6. Detalles menores
- `submitLabel`: "Guardar cambios" (ya existe).
- `emailLocked`: se mantiene (`UserForm` ya lo soporta).
- No tocar `users.new.tsx`, `UserForm.tsx` ni la creación.

## Archivos a tocar

- `src/lib/users.functions.ts` — añadir `updateUser` server function.
- `src/routes/_authenticated/setup/users.$userId.edit.tsx` — reescribir con shell, queries de perfil + accesos + clients, y mutación nueva.

## Fuera de alcance

- Reset de contraseña / reenvío de credenciales (se aborda en otra iteración cuando definamos política de recuperación).
- Cambio de email (no soportado en esta vista).
- Auditoría / historial de cambios.
