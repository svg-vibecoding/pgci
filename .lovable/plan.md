## Objetivo

En `src/routes/_authenticated/setup/users.$userId.index.tsx`, reemplazar las dos `<Card>` actuales ("Cartera de clientes" y "Acuerdos en gestión") por una única sección jerárquica idéntica a la de `CommercialProfileView` (clientes en accordion → permisos avanzados + acuerdos donde participa), pero apuntando al `userId` de la ruta y con copy en tercera persona.

No se extrae componente compartido en esta ronda (evita cambios en `CommercialProfileView`). Se inlinea la lógica para mantener el cambio acotado al detalle de usuario.

## Cambios

### 1. Queries nuevas en `UserDetail`
Añadir junto a las queries existentes (`user`, `access`, `memberships`):

- Ampliar `access` para incluir `can_manage_client_catalog` y `can_manage_matching`.
- Ampliar `memberships` para incluir `can_view_costs` y join `agreements ( id, name, status, scope, start_date, end_date )`.
- Nueva query `agrClients` a `agreement_companies` filtrada por los `agreement_id` de `memberships` (con join a `clients(id, commercial_name, legal_name)`), skip si no hay memberships.
- `useMemo` para construir `agreementsByClient` (Map<clientId, memberships[]>) y `unlinkedAgreements` (memberships sin cliente en `access`).

### 2. Reemplazar las dos Cards
Borrar los bloques actuales de "Cartera de clientes" y "Acuerdos en gestión" (incluida la `Alert` obsoleta "…cuando el módulo de Acuerdos esté activo").

Insertar una sola `<Card>` "Cartera de clientes" que replique la estructura de `CommercialProfileView` (líneas 195–419), con estos ajustes de copy en tercera persona:

- CardTitle: "Cartera de clientes"
- Descripción: "Clientes asignados a este usuario y acuerdos en los que participa, con los permisos vigentes en cada nivel."
- Super admin: "Este usuario es super admin y tiene acceso a todos los clientes y acuerdos de la plataforma."
- Empty state: "Este usuario aún no tiene clientes asignados." + subtítulo "Un super admin debe habilitar sus accesos para que pueda operar en la PGCI."
- "Acuerdos donde participa" (era "…participas")
- "No participa en acuerdos de este cliente todavía."
- "Otros acuerdos donde participa"

### 3. Botón "Clientes y permisos" en el header de la Card
Mantener el botón actual (solo visible para `isSuperAdmin && assignedCount > 0`) en el `CardHeader` como está hoy. El botón grande del header de página también se queda.

### 4. Permisos como switches disabled
Los 3 permisos (Crear acuerdos / Gestionar catálogo / Gestionar matching) se renderizan con `<Switch checked={...} disabled aria-readonly="true" />` idéntico al perfil.

### 5. Links de acuerdos
Los items enlazan a `/pgci/agreements/$agreementId` (mismo destino que en el perfil).

### 6. Alertas y resto de la vista
- Se **mantienen intactas**: `IndicatorCard`s superiores, `Alert` "Alertas de configuración" (sin clientes / inactivo con accesos), Card "Información del usuario", header con acciones (Editar / Inactivar / Clientes y permisos).
- Se **elimina** la Card "Acuerdos en gestión" completa.

## Fuera de alcance

- No se extrae `UserClientsAndAccessCard` compartido (queda para otra ronda si se confirma).
- No se toca `CommercialProfileView`.
- No se cambia el link destino de los acuerdos.
