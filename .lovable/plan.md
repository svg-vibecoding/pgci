# Plan — colapsar `listAgreementSkuGroups` por `product_id` (v2)

Ajuste sobre v1: se **mantiene** la descripción del código (query a `client_product_history` y campo `description` por código).

## Alcance

1. `listAgreementSkuGroups`: agrupar por `product_id`, incluir posiciones sin códigos, incluir excluidas.
2. Tipos: retirar `client_id` / `client_name` del grupo; posiciones llevan `status` + arreglo `codes[]` con `client_name`, `client_code`, `description`.
3. `SkuGroupCard`: columna única "Códigos" que muestra por cada código `cliente · código · descripción`; añadir chip de estado por posición.
4. Consumers indirectos (badge, filtro, alert, `openEditForLine`): sin cambios — no leen `client_id`/`client_name` del grupo.

Criterio de precios sin cambios: `sale_price === null` no aporta a `distinctPrices`.

## Cambios por archivo

### `src/lib/agreements.functions.ts`

**Tipo:**

```ts
export type AgreementSkuGroupPosition = {
  id: string;
  status: string;
  sale_price: number | null;
  codes: {
    client_code: string;
    client_name: string | null;
    description: string | null;
  }[];
};
```

`AgreementSkuGroup`: retirar `client_id` y `client_name`; el resto igual.

**Handler:**

- Query `agreement_positions`: quitar `.neq("status", "excluded")`; añadir `status` al select.
- Se **mantiene** la query de `client_product_history` y el `descByCp` — la descripción sigue siendo campo real de cada código.
- `codesByPos` mantiene `client_code`, `client_name`, `description` por entry.
- Loop de agrupación:
  - Clave: `${product_id}`.
  - Iterar `rows` (posiciones); cada posición se añade **una sola vez** al grupo con `codes` = todos sus códigos vigentes (o `[]`).
  - Eliminar `if (codes.length === 0) continue;`.
  - `prices.add(sale_price)` sigue condicionado a `typeof sale_price === "number"`.

Retorno final: `product_id`, `sku`, `product_description`, `position_ids`, `positions[{id, status, sale_price, codes[]}]`, `prices`, `state`.

### `src/routes/_authenticated/pgci/agreements.$agreementId.lines.tsx`

`**SkuGroupCard` (líneas 1818-1944):**

- Actualizar el tipo `group.positions[i]` a la forma nueva (`status`, `codes[]`, sin campos escalares `client_code`/`client_description`).
- Encabezado de la mini-tabla: **Estado · Códigos · Precio actual** (3 columnas).
- Celda "Códigos": si `codes.length === 0`, mostrar "—"; si no, listar cada código en una línea con el mismo patrón visual que usa el bloque transversal del `LineEditDialog` (cliente · código · descripción). Cuando la posición tiene varios códigos, se apilan verticalmente dentro de la misma celda.
- Celda "Estado": `<Badge>` usando `STATUS_META` ya existente en el archivo.

Nada más cambia. `repeatedPositionIds`, `conflictGroups`, `repeatedGroups`, `repeatedTotalCount`, filtro `skuConflictOnly`, badge Layers, `openEditForLine(g.position_ids[0])` y alert azul leen solo `position_ids`, `state`, `prices` — ya verificado.

## Efecto observable

Acuerdo de prueba (`aff54201…`, SKU `830030571`):

Antes: 1 tarjeta "CORONA · 2 posiciones (60.000, 65.000)". La tercera (draft, sin códigos) invisible.

Después: 1 tarjeta "SKU · 3 posiciones (60.000, 65.000, sin precio)" en estado `conflict`. Mini-tabla:

- `Activa` · CORONA · COR-001 · descripción-cliente · 60.000
- `Borrador` · — · sin precio
- `Activa` · CORONA · COR-002 · descripción / FALABELLA · FAL-002 · descripción · 65.000

## Verificación

1. Botón Layers → tarjeta con 3 posiciones para el SKU de prueba, incluida la draft sin códigos.
2. Filtro "Ver en la tabla" incluye la fila draft.
3. Badge y alert azul coherentes (el badge baja frente al valor previo: pasa de contar grupos SKU×cliente a contar SKUs).
4. `tsgo` limpio.

## Fuera de alcance

- No se toca `position_has_sku_conflict`.
- Criterio de precios intacto.
- No se toca `hasMore` ni el `ilike` de `searchProducts` (pendientes aparte).
- No se reescribe la DialogDescription ni la línea "mismo precio" del alert (otra tarea).

Aprobado con una objeción.

No quites la descripción del código. El plan elimina la query de

client_product_history y la columna "Descripción cliente" para ahorrar

un round-trip, pero el código sin descripción no dice nada al usuario

— ya se decidió eso en el bloque de posiciones del SKU del modal.

Mantén la descripción. La celda de códigos debe mostrar cliente,

código y descripción, igual que en el bloque transversal del modal

de posición.

El resto del plan queda aprobado. Construye.