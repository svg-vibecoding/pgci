## Causa
`AgreementForm` ignora el prop `clients` (llega como `_clients` sin usar) y ejecuta su propia `useQuery` contra `clients` filtrando solo por `status='active'`. Eso devuelve todo cliente al que el usuario tenga acceso vía RLS, sin considerar `can_create_agreements`. `listAssignableClients` (que sí filtra bien en el servidor) queda huérfano.

## Fix
Usar la fuente correcta y eliminar la query paralela.

### 1. `src/lib/agreements.functions.ts` — `listAssignableClients`
Añadir `tax_id`, `tax_id_type`, `type` al `select` de ambas ramas (super admin y platform_user), para que el picker tenga los campos que hoy consulta directo.

### 2. `src/components/agreements/AgreementForm.tsx`
- Aceptar el prop `clients` con el tipo extendido (id, commercial_name, legal_name, tax_id, tax_id_type, type, status) y `clientsLoading`.
- Borrar `activeClientsQ` completo (líneas 118-135) y el `import { supabase }` si queda sin uso.
- Reemplazar todas las referencias a `activeClientsQ.data` / `activeClientsQ.isLoading` por `clients` / `clientsLoading` recibidos por props.
- Mantener `enabled: !lockClient` como filtrado local (`lockClient ? [] : clients`).

### 3. `src/routes/_authenticated/pgci/agreements.new.tsx`
Ya pasa `clients={clients ?? []}` y `clientsLoading`. Sin cambios funcionales; solo confirmar que el tipo `AssignableClient` incluye los campos nuevos.

### 4. Tipo `AssignableClient`
Ampliar en el lugar donde esté declarado (probablemente `agreements.functions.ts` o `agreements.schemas.ts`) para incluir `tax_id`, `tax_id_type`, `type`.

## Verificación
- Con Pruebas 2 (platform_user sin `can_create_agreements` sobre COLCERAMICA), abrir `/pgci/agreements/new`: COLCERAMICA NO aparece en el selector.
- Con super admin: todos los clientes activos aparecen.
- Crear un acuerdo con un cliente permitido sigue funcionando.

## Fuera de alcance
- No se toca `AgreementCompaniesSection` (agregar clientes a un acuerdo existente): esa vista tiene su propia lógica de permisos (`canAdmin`) y no comparte el bug.
- No se toca RLS de `clients`.
