
## Objetivo

Reforzar la consistencia del `DataTable` como sistema (no parche por vista). Tres cambios al sistema + aplicación a las dos vistas ya migradas (Productos, Posiciones). Sin sort por ahora.

## 1. `IdentityCell` — invertir jerarquía (código arriba)

Regla nueva y única del sistema: **línea 1 = código (mono), línea 2 = descripción (texto normal)**. Aplica a toda celda de identidad, siempre.

Cambios en `src/components/sumatec/DataTable/IdentityCell.tsx`:
- Nueva API orientada al contenido, no a "title/subtitle":
  - `code: ReactNode` (línea 1, mono, semibold, color `text-primary`, 12.5px).
  - `description: ReactNode` (línea 2, sans, regular, color `text-secondary`, 13px — misma escala que columnas "Marca").
  - `trailing?: ReactNode` (badges como `skuGroupBadge`) al lado del código.
- Se elimina `monoTitle`/`monoSubtitle` (redundantes: el código siempre es mono).
- Espaciado vertical entre líneas: `mt-0` (antes `mt-0.5`) — más compacto, coherente con la petición de "menos espacio".
- Truncado con `title=` nativo se mantiene en ambas líneas.

Efectos en llamadores:
- `products.index.tsx`: `IdentityCell` pasa a `code={p.sku}` / `description={p.erp_description}`.
- `agreements.$agreementId.lines.tsx`: las dos celdas de identidad (Cliente, Jaivaná) ya vienen "código arriba"; se migran a la nueva API sin cambio visual de orden, solo de tamaños/espaciados.

## 2. Tipografía del subtítulo (descripción) — más legible

Hoy: subtítulo `11.5px`, se ve chico al lado del código.
Nuevo, como token del sistema:
- Código (línea 1): **12.5px**, mono, `font-semibold`, `text-primary`.
- Descripción (línea 2): **13px**, `font-normal`, `text-secondary` — misma escala que la columna "Marca" y demás columnas de texto.
- Gap vertical entre líneas: `0` (líneas naturales, sin margen extra).

Esto ancla el par código+descripción a la misma escala del resto del body y el ojo lo lee como bloque.

## 3. Sin scroll horizontal en Posiciones — wrapping y alturas flexibles

Cambios al sistema en `DataTable.tsx`:
- Contenedor: quitar `overflow-auto` horizontal por defecto; usar `overflow-y-auto` solo cuando hay `maxHeight`. Nueva prop `layout?: "auto" | "fixed"` con default `"auto"`; en `"auto"` la tabla respeta el ancho del contenedor y las columnas sin `width` se reparten el sobrante.
- Celdas de texto: nueva clase por defecto `whitespace-normal break-words align-top` (hoy hay `whitespace-nowrap` implícito en headers y contenidos largos empujaban ancho). Header sigue `whitespace-nowrap` (etiquetas cortas).
- Nueva prop de columna `wrap?: boolean` (default `true`); columnas numéricas/fechas/estado quedan en `false` para no partir cifras.
- Altura de fila deja de ser fija; padding vertical se mantiene (`py-3`) y la fila crece con el contenido. Se elimina cualquier `min-height` rígido.
- Sticky de acciones/selección: se conserva, pero al no haber scroll-x en el uso normal, no genera solapamiento.

Efectos en Posiciones (`agreements.$agreementId.lines.tsx`):
- Se recalibran anchos de columnas para caber en viewport típico (~1280px) sin scroll horizontal:
  - Selección 40, Cliente flexible, Jaivaná flexible, Marca 140, Precio 110 (num), Vigencia 170, Estado 120, Acciones 48.
  - Cliente y Jaivaná quedan sin `width` (flex) y con `wrap: true` para absorber descripciones largas en dos líneas.
- Se elimina cualquier `min-w-*` residual en el contenedor.

## 4. Fuera de alcance (explícito)

- **Sort de columnas**: pospuesto por decisión del usuario.
- No se tocan RLS, RPCs, filtros, export, ni lógica de publicación/exclusión.
- No se migran Usuarios/Clientes/Acuerdos en esta iteración (se hará después con las mismas reglas ya cocinadas).

## Archivos

- `src/components/sumatec/DataTable/IdentityCell.tsx` — reescritura de API y estilos.
- `src/components/sumatec/DataTable/DataTable.tsx` — quitar overflow-x default, `layout` prop, wrapping por defecto, `align-top`.
- `src/components/sumatec/DataTable/types.ts` — añadir `wrap?: boolean` a `DataTableColumn`, `layout?: "auto" | "fixed"` a `DataTableProps`.
- `src/routes/_authenticated/setup/products.index.tsx` — usar nueva API `code`/`description`.
- `src/routes/_authenticated/pgci/agreements.$agreementId.lines.tsx` — nueva API + recalibración de anchos.

Typecheck limpio al final. Sin cambios de comportamiento; solo presentación.
