- Propuesta: DataTable transversal para PGCI

## Diagnóstico

Hoy conviven dos implementaciones de tabla y cada vista las mezcla a su antojo:

- `src/components/ui/table.tsx` (shadcn, usada en Usuarios, Clientes, Productos, Acuerdos, Posiciones).
- `src/components/sumatec/Table.tsx` (tokens Sumatec, más cuidada, casi no se usa en las vistas reales).

Problemas concretos observados en las 5 tablas (Usuarios, Clientes, Productos, Acuerdos, Posiciones):

1. **Tipografía inconsistente.** Body a `text-sm` (14px) en unas, `13px` en otras; headers a veces bold, a veces uppercase, a veces normal. Códigos/SKU/NIT sin fuente mono uniforme.
2. **Densidad dispersa.** Padding vertical entre `py-2` y `py-4` según vista. La fila de Posiciones se siente apretada; la de Usuarios, vacía.
3. **Columnas sin jerarquía de ancho.** Todo `auto`: la descripción se come el espacio, el estado se estira, las fechas quedan sueltas al centro.
4. **Alineación cruzada.** Números y montos alineados a la izquierda; fechas al centro; contadores sin `tabular-nums`.
5. **Acciones heterogéneas.** A veces botón texto ("Editar"), a veces icono, a veces menú `⋯`, a veces enlace en la primera celda. Sin patrón claro.
6. **Estados vacíos / carga / error** cada uno redactado distinto ("Cargando…", "—", "No hay…").
7. **Sin sticky header, sin zebra opcional, sin scroll horizontal controlado** — en Posiciones con 8+ columnas la tabla se corta feo.

## Propuesta: un único `DataTable` transversal

Consolidar todo en `src/components/sumatec/DataTable/` como **el** estándar del design system Sumatec. La `Table` shadcn se mantiene para casos internos de shadcn (dialogs, etc.) pero **ninguna vista de negocio la usa directamente**.

### Anatomía y reglas fijas (no negociables por vista)

**Contenedor**

- Card con `border-border`, `radius 8px` (token Sumatec), `bg-card`.
- Scroll horizontal interno con sombra de borde cuando desborda.
- Header sticky al hacer scroll vertical dentro de la card.

**Tipografía**

- Header: Montserrat 11px / uppercase / `letter-spacing 0.05em` / `text-tertiary` / bold.
- Body: Roboto 13px / `line-height 20px` / `text-secondary` para columnas soporte, `text-primary` para la columna identidad (la que enlaza al detalle).
- Códigos (SKU, NIT, ID, cédula): fuente mono 12px, color `text-secondary`.
- Números y montos: `tabular-nums`, alineados a la derecha.

**Densidad**

- Una sola densidad por defecto: `padding 12px 16px` vertical/horizontal.
- Alto de fila objetivo: 44px (una línea) / 56px (dos líneas identidad+subtítulo).
- Zebra **off** por defecto; hover `bg-surface-page` siempre; fila seleccionada `bg-primary/5` con borde-izquierdo 2px `primary`.

**Anchos de columna estandarizados**

- `identity` (nombre + subtítulo/código debajo): flexible, `min-w-0`, trunca a 1 línea con tooltip.
- `code` mono: ancho fijo por tipo (SKU 120, NIT 140, cédula 120).
- `status` (StatusBadge): ancho auto, nunca crece.
- `numeric` (contadores, montos): ancho auto, alineado derecha.
- `date`: 110px, formato `dd/mm/aaaa`, alineado izquierda.
- `actions`: 48px, sticky a la derecha.

**Acciones — un solo patrón**

- Columna final `actions` siempre a la derecha, sticky, ancho 48px.
- Un único `IconButton` `⋯` (lucide `MoreHorizontal`) que abre `DropdownMenu` con las acciones ("Editar", "Ver detalle", "Eliminar", etc.).
- Excepción: la acción primaria de "abrir detalle" **no** va en el menú — se activa haciendo click en la celda `identity` (link) y en toda la fila (row `interactive`).
- Se prohíben botones de texto ("Editar", "Ver") dentro de la fila.

**Estados**

- Loading: skeleton rows (5 filas grises con shimmer), no texto "Cargando…".
- Empty: componente `<TableEmpty icon title description action?>` centrado, con ilustración/icono lucide y CTA opcional.
- Error: componente `<TableError>` con mensaje + botón "Reintentar".

**Selección múltiple (opt-in)**

- Cuando la vista la necesita (Posiciones publicar), primera columna checkbox 40px, con estado indeterminate en header. Regla ya establecida: checkbox deshabilitado usa `muted`, nunca `destructive`.

**Ordenamiento y filtros**

- Header sortable con icono chevron sutil (opt-in por columna).
- Filtros y búsqueda viven **fuera** de la tabla (patrón actual de Productos con chips + summary cards se mantiene). El `DataTable` solo pinta filas.

**Paginación / scroll**

- Por defecto scroll vertical dentro de la card con altura máxima configurable.
- Paginación opcional en footer (`TablePagination`) solo cuando el dataset lo requiera.

### API propuesta

```tsx
<DataTable
  data={rows}
  columns={[
    { id: "identity", header: "Producto", accessor: (p) => (
        <IdentityCell title={p.description} subtitle={p.sku} mono />
      ), width: "flex" },
    { id: "brand", header: "Marca", accessor: (p) => p.brand },
    { id: "count", header: "Acuerdos", accessor: (p) => p.count, align: "right", numeric: true },
    { id: "status", header: "Estado", accessor: (p) => <StatusBadge .../> },
    { id: "updated", header: "Actualizado", accessor: (p) => fmt(p.updated_at), width: 110 },
  ]}
  rowActions={(p) => [
    { label: "Ver detalle", onSelect: () => nav(...) },
    { label: "Editar", onSelect: () => nav(...) },
  ]}
  onRowClick={(p) => nav(...)}
  state={{ loading, error, empty: { title: "...", description: "..." } }}
/>
```

## Alcance de la implementación

**Fase 1 — Sistema (una sola tanda):**

- Crear `src/components/sumatec/DataTable/` con: `DataTable.tsx`, `IdentityCell.tsx`, `TableEmpty.tsx`, `TableError.tsx`, `TableSkeleton.tsx`, `TablePagination.tsx`, `types.ts`, `index.ts`.
- Documentar tokens y ejemplos en `/sistema-diseno` (si existe la ruta) o en README del folder.

**Fase 2 — Migración vista por vista (5 tablas):**

1. Productos (`setup/products.index.tsx`) — plantilla de referencia por ser la más completa.
2. Usuarios (`setup/users.index.tsx`).
3. Clientes (`setup/clients.index.tsx`).
4. Acuerdos (`pgci/agreements.index.tsx`).
5. Posiciones (`pgci/agreements.$agreementId.lines.tsx`) — la más compleja: mantener selección múltiple para publicar, badges de vigencia, columna de acciones.

Cada migración: solo cambia la capa de presentación de la tabla. **No** se toca fetching, filtros, export, RPC, ni lógica.

**Fuera de alcance:**

- Tablas internas de dialogs shadcn (se quedan como están).
- La `Table` shadcn se mantiene en el repo, pero se marca "no usar en vistas de negocio" en el README del design system.
- No se elimina `src/components/sumatec/Table.tsx` en esta iteración; se absorbe dentro del nuevo `DataTable` y luego se deprecará.

## Detalles técnicos

- Componente **no** trae dependencia nueva (nada de TanStack Table por ahora — la lógica de sort/filter vive fuera). Si más adelante se requiere sort/filter/paginación server-side compleja, se evalúa `@tanstack/react-table` como motor interno sin cambiar la API pública.
- Tokens: se reusan los ya definidos en `src/styles.css` (`--surface-page`, `--border-default`, `--text-tertiary`, etc.). Si falta alguno (p.ej. `--row-selected-bg`), se agrega en el mismo commit del sistema.
- Accesibilidad: `role="table"` implícito, header con `scope="col"`, row `interactive` con `role="button"` y `tabIndex 0`, menú `⋯` con `aria-label="Acciones de {identidad}"`.
- Truncado con `title` nativo para tooltip básico; si más adelante se quiere tooltip Radix, se enchufa sin cambiar la API.

## Preguntas antes de implementar

1. ¿Migramos las 5 tablas en una sola entrega o solo Productos primero como piloto para validar el look? 
  - Productos y posiciones, con ambas, validamos el look.
2. ¿La acción primaria (abrir detalle) se dispara con click en toda la fila o solo en la celda identidad? Hoy en Productos es solo en el texto — con la propuesta se puede hacer toda la fila clickeable.
  - Toda la fila
3. ¿Aceptas mover **todas** las acciones (editar/eliminar/etc.) al menú `⋯` y quitar los botones de texto en filas? Es el mayor cambio visual y de comportamiento perceptible.
  - Acepto
  &nbsp;