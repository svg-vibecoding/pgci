## Diagnóstico

El sistema Sumatec ya tiene la escala tipográfica definida en `src/styles.css` como `@utility`:

- `suma-h1` (Montserrat Bold) — títulos de página
- `suma-h2`, `suma-h3`, `suma-h4` — jerarquía secundaria
- `suma-subtitle` — subtítulos de sección
- `suma-overline` — eyebrows en mayúsculas (labels de KPI, encabezados de tabla, labels de formulario)
- `suma-caption` — metadata secundaria
- `suma-body` — cuerpo

El problema: **ninguna de estas utilidades se está usando en las vistas operativas**. Cada archivo reinventa el estilo con combinaciones distintas de Tailwind, y por eso los headers no se sienten iguales entre sí ni con la tabla nueva:

| Elemento | Hoy conviven | Debería ser |
|---|---|---|
| H1 de página | `text-2xl font-bold tracking-tight` (users, clients, agreements, products, acuerdo detalle) vs `text-2xl font-semibold tracking-tight` (pgci/index) | `suma-h1` |
| Número KPI | `text-2xl font-semibold tracking-tight` (5 archivos, copiado y pegado) | `suma-h2` (o token dedicado `suma-metric`) |
| Label KPI | `text-xs text-muted-foreground` (sin mayúsculas, sin tracking) | `suma-overline` |
| Eyebrow de sección/campo | `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground` (repetido ~10 veces) | `suma-overline` |
| Header de tabla | `font-ui text-[11px] font-bold uppercase tracking-[0.05em] text-text-tertiary` (DataTable) | Ya alineado, pero conviene expresarlo como `suma-overline` para que sea el mismo token |
| Color de texto secundario | `text-muted-foreground` vs `text-text-tertiary` vs `text-[var(--text-secondary)]` mezclados en la misma pantalla | Un solo token semántico (`text-text-secondary` o `text-muted-foreground`, no ambos) |
| Título de diálogo | `text-2xl font-bold tracking-tight` / `text-xl font-bold tracking-tight` | `suma-h2` / `suma-h3` |

Además hay dos tokens de color equivalentes (`--muted-foreground` shadcn y `--text-secondary/tertiary` Sumatec) que se usan indistintamente. Eso también contribuye al ruido visual.

## Alcance de la propuesta

Cambios **solo al sistema y a las vistas ya migradas al DataTable** (para no meterme en dialogs de dominio esta ronda). Objetivo: que Montserrat y Roboto se manifiesten en escalas fijas del sistema y no en clases ad-hoc.

### 1. `src/styles.css` — cerrar la escala

- Añadir `@utility suma-metric` (número grande de KPI: Montserrat, `--h2`, `fw-bold`, `tracking-tight`, `tabular-nums`) para que todas las tarjetas usen el mismo.
- Confirmar que `suma-overline` cubre eyebrow de KPI, label de formulario y header de tabla con el mismo peso/tracking. Ajustar `--overline` a 11px / `tracking-[0.05em]` si hace falta para no romper la tabla.
- Documentar (comentario) los tokens de color permitidos para texto secundario y dejar uno canónico (propongo `text-text-secondary` / `text-text-tertiary` Sumatec) para vistas nuevas; mantener `muted-foreground` solo dentro de componentes shadcn que ya lo traen internamente.

### 2. `DataTable`

- Reemplazar el string en el `<th>` por `className="suma-overline px-4 py-2.5 text-text-tertiary"` (misma salida visual, misma fuente, pero declarativo).

### 3. Vistas de lista ya migradas

Aplicar el mismo reemplazo puntual (sin tocar layout ni lógica):

- `src/routes/_authenticated/setup/users.index.tsx`
- `src/routes/_authenticated/setup/clients.index.tsx`
- `src/routes/_authenticated/setup/products.index.tsx`
- `src/routes/_authenticated/pgci/agreements.index.tsx`
- `src/routes/_authenticated/pgci/agreements.$agreementId.lines.tsx`
- `src/routes/_authenticated/pgci/agreements.$agreementId.index.tsx` (solo eyebrows)
- `src/components/agreements/AgreementHeader.tsx` (H1 del acuerdo)
- `src/components/agreements/AgreementBreadcrumb.tsx` (usar `suma-caption`)

Reemplazos mecánicos:

- `text-2xl font-bold tracking-tight` en H1 de página → `suma-h1`
- Número de KPI (`text-2xl font-semibold tracking-tight`) → `suma-metric`
- Label de KPI (`text-xs text-muted-foreground`) → `suma-overline text-text-tertiary`
- Eyebrow `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground` → `suma-overline`
- Metadata bajo el H1 del acuerdo (`text-sm text-muted-foreground`) → `suma-caption`

### 4. Fuera de alcance

- Dialogs internos (`LineViewDialog`, `LineEditDialog`, `AgreementImportWizard`) — se migran cuando toque revisarlos por contenido, no en esta pasada.
- Página landing `pgci/index.tsx` — la reviso aparte porque mezcla utilities de landing.
- No se toca ningún color de marca ni tamaños de la tabla (Roboto 13px sigue igual).

## Resultado esperado

Todos los headers de página, KPIs, eyebrows y encabezados de tabla en las vistas operativas quedan expresados con las mismas 3–4 utilidades Sumatec. Cambiar el sistema (por ejemplo, subir H1 a 26px) pasa a ser una edición en `styles.css` en vez de un find-and-replace por todo el repo.
