## Rediseño detalle de acuerdo + ruta de líneas

### 1. Backend — extender vista `agreements_with_counts`
Migración para añadir columnas usadas por la nueva ficha "Información del acuerdo":
- `parent_client_id` y `parent_commercial_name` / `parent_legal_name` (vía join al cliente padre cuando `clients.parent_client_id` no es null).
- `members_count` (subquery sobre `agreement_members`).
- `companies_count` (subquery sobre `agreement_companies`).

Esto evita hacer 3 queries extra desde el cliente.

### 2. Detalle `/pgci/agreements/$agreementId` — reorganización
Archivo: `src/routes/_authenticated/pgci/agreements.$agreementId.index.tsx`

Orden final de secciones (encabezado se mantiene igual):

**Ficha "Información comercial"** (nueva card que envuelve los 5 indicadores existentes)
- Header con título a la izquierda y botón `Gestión de Productos` (ícono `Boxes` o `Package`) a la derecha que enlaza a `/pgci/agreements/$agreementId/lines`.
- Body: los 5 `IndicatorCard` actuales (Líneas, Activas, Pendientes, Requieren revisión, Excluidas) sin cambios.

**Ficha "Información del acuerdo"** (reorganizada — grid de 3 columnas en `InfoSection` ya lo soporta)
- Fila 1: Acuerdo · Cliente · Holding
- Fila 2: Líneas · Usuarios · Empresas
- Fila 3: Alcance · Vigencia desde · Vigencia hasta
- Fila 4: Estado · Creado · Actualizado
- Fila 5: Observaciones (full-width debajo del grid; "—" si vacío)

Holding: muestra `parent_commercial_name ?? parent_legal_name` o `—`.

**Ficha "Miembros del acuerdo"** — sin cambios.

**Ficha "Empresas vinculadas"** — sin cambios.

Se elimina del detalle el `<AgreementLinesSection>` y el `<AgreementImportWizard>` asociado (se mueven a la nueva ruta).

### 3. Nueva ruta `/pgci/agreements/$agreementId/lines`
Archivo nuevo: `src/routes/_authenticated/pgci/agreements.$agreementId.lines.tsx`

- Breadcrumb / botón "Volver al acuerdo" arriba (Link a `/pgci/agreements/$agreementId`).
- Header con nombre del acuerdo + badge de estado + badge "Con alcance" si aplica (consistente con detalle).
- Renderiza `<AgreementLinesSection>` tal cual está hoy (búsqueda, tabs por estado, Exportar/Importar/Nueva línea, tabla con acciones editar/excluir/reactivar).
- Monta el `<AgreementImportWizard>` aquí (estado `importOpen` local).
- Carga `getAgreement` + `getAgreementContext` para `canAdmin` y nombre.

### Detalles técnicos
- `InfoSection` ya hace `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` y `gap-y-4` — perfecto para las 4 filas alineadas. Observaciones se renderiza fuera del grid (igual que hoy).
- `IndicatorCard` se reutiliza; sólo cambia el wrapper a una `Card` con CardHeader (título + botón) y CardContent con el grid de 5.
- La ruta `/lines` sigue la convención dot-flat: archivo `agreements.$agreementId.lines.tsx`, `createFileRoute("/_authenticated/pgci/agreements/$agreementId/lines")`.
- No cambia ningún server function ni lógica de líneas; sólo se mueve el render.

### Verificación
Build + smoke visual en la ruta del acuerdo actual y en `/lines`.
