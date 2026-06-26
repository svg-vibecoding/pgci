## Objetivo

Unificar la edición de Clientes y Usuarios bajo el mismo patrón visual ya aprobado en las vistas de creación, usando `CreateViewShell`. Hoy `users/edit` ya usa el shell; `clients/edit` no — replica a mano el header del detalle y queda inconsistente en tipografía, ancho, back link, alerta de estado y footer de acciones.

## Diagnóstico

Inconsistencias actuales en `clients.$clientId.edit.tsx` frente a `users.$userId.edit.tsx`:

| Elemento | Clients/edit (hoy) | Users/edit (referencia) |
|---|---|---|
| Layout | `-mt-6 space-y-5` ad-hoc, ancho libre | `CreateViewShell` con `max-w-2xl` |
| Back link | `<Link>` plano con `ArrowLeft` 3.5 | `BackLinkChrome` dentro de `Button ghost sm` |
| Título | Nombre del cliente (h1 2xl) + badges de estado | `title` del shell ("Editar usuario") + `description` |
| Estado inactivo | Solo badge en header | `Alert variant="info"` explicando el efecto |
| Footer acciones | El que provee `ClientForm` | Mismo, pero alineado al ancho del shell |
| Volver tras guardar/cancelar | `/setup/clients/$clientId` | `/setup/users/$userId` (consistente) |

El header tipo "detalle" en la edición duplica información del detail view y rompe la jerarquía: en edición lo relevante es la tarea ("Editar cliente"), no re-presentar la ficha.

## Cambios

Solo se toca la vista de edición de clientes. No se modifican `ClientForm`, rutas de detalle, ni la edición de usuarios.

### `src/routes/_authenticated/setup/clients.$clientId.edit.tsx`

1. Reemplazar el wrapper actual por `CreateViewShell`:
   - `backLink`: `Button ghost sm` + `BackLinkChrome label="Volver al detalle"` apuntando a `/setup/clients/$clientId`.
   - `title`: `Editar cliente`.
   - `description`: `Actualiza los datos del cliente. El tipo y la relación con holding pueden modificarse.` (texto breve, mismo tono que usuarios).
2. Eliminar el `<header>` con nombre + badges + "Editando". La identidad del registro ya vive en el detalle; el shell unifica la jerarquía.
3. Si `data.status === "inactive"`, mostrar `Alert variant="info"` arriba del form, con texto: "Este cliente está inactivo. Los cambios se guardarán, pero no aparecerá en selectores hasta que lo actives."
4. Cancel y post-success siguen navegando a `/setup/clients/$clientId` (sin cambio funcional).
5. Limpiar imports no usados (`Badge`, `StatusBadge`, `ArrowLeft`, `Link` si ya no aplica) y agregar los del shell/alert.

## Resultado

Ambas vistas de edición comparten: mismo ancho (`max-w-2xl`), mismo back link, mismo header (title + description), mismo patrón de alerta cuando el registro está inactivo, mismo footer de acciones del form. La identidad del registro queda en la vista de detalle, no se duplica en edición.
