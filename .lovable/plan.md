## Cambio

Solo presentación en `src/components/agreements/LineEditDialog.tsx`. Mismo dato (`skuInAgreement.positions`), nueva ubicación y nueva disposición de fichas.

## Ubicación

- Extraer el render de `visible.map((pos) => …)` (dentro del bloque `skuInAgreement`) fuera de la columna del SKU.
- Insertar un nuevo bloque **transversal, ancho completo**, entre el `DialogHeader` y el `<div class="grid grid-cols-1 lg:grid-cols-…">`.
- Contenido: encabezado corto "Este SKU ya está en otras posiciones del acuerdo" + contador; contenedor con las fichas; toggle "Ver N posiciones más" cuando `positions.length > 3` (misma lógica `skuPositionsExpanded`).
- Aparece solo cuando `skuInAgreement && skuInAgreement.positions.length > 0`.
- Solo mueve JSX; no cambia estado ni handlers.

**Se queda en la columna del SKU:**
- `Alert variant="info"` con el mensaje azul de la regla.
- Banner ámbar de conflicto `hasSkuConflict`.
- Columna de códigos y su `* Requerido`.

## Diseño de cada ficha

Deja de usar `PositionTakenPanel`. Tarjeta compacta con borde y padding, sin ícono, sin secciones etiquetadas:

```text
┌─────────────────────────────────────────────────────┐
│ [StatusBadge]  $ 123.456        01/01/26 → 31/12/26 │
│ ─────────────────────────────────────────────────── │
│ CLIENTE A  ·  COD-123  ·  Descripción del código    │
│ CLIENTE B  ·  COD-456  ·  Otra descripción          │
│                                    Ir a esa posición│
└─────────────────────────────────────────────────────┘
```

- **Chip de estado**: mismo mapeo que la lista de posiciones del acuerdo (`STATUS_META` en `agreements.$agreementId.lines.tsx`, líneas 126–137):
  - `active` → `status="active"`, label `"Activa"`
  - `requires_review` → `status="danger"`, label `"Revisar"`
  - `draft` → `status="neutral"`, label `"En gestión"`
  - `excluded` → `status="neutral"`, label `"Excluida"`
  - Componente `StatusBadge`, tamaño default.
- **Precio**: `formatMoneyCOP(pos.sale_price)`; si `null`, "—".
- **Vigencia efectiva**: `pos.start_date → pos.end_date`; si falta alguna, usar la fecha correspondiente del acuerdo. Formato `dd/mm/aa`. Verificar/añadir `agreementStartDate` al desestructurado si falta.
- **Códigos**: una línea por código (`cliente · code monoespaciado · descripción`). Si `pos.codes.length === 0`, no renderizar nada en esa zona.
- **Ficha excluida**: **sin CTA** (no hay modal de edición para excluidas). Añadir debajo de los códigos una línea muted con el motivo + fecha de exclusión (mismo dato que hoy, sin la etiqueta "MOTIVO DE EXCLUSIÓN"). El chip "Excluida" ya comunica el estado.
- **Acción (no excluidas)**: link `Ir a esa posición` alineado a la derecha, mismo `onSwitchToPosition(pos.position_id)`.

**Eliminar de la ficha:** SKU + descripción del producto y el bloque "SIN CÓDIGO DE CLIENTE / Esta posición ocupa el SKU…".

## Disposición cuando hay varias fichas

- 1 ficha: ancho completo.
- 2+ fichas: `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`, `gap-3`. Con el toggle limitando a 3 por defecto no apilan en exceso.

## Qué no se toca

- `PositionTakenPanel` (lo sigue usando el panel de código ocupado).
- Server functions, `detectNConflict`, `skuInAgreement`, lógica `sku_conflict`/`hasSkuConflict`, `onSwitchToPosition`, cálculos de vigencia/pending.
