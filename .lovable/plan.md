
## Diagnóstico

El parpadeo tiene una causa única: al abrir el modal en edición, `useEffect` hace `setProductMeta(null)` + `setLookup({ kind: "idle" })` y luego dispara `prefillFromSku(sku)` (línea 1337-1351 de `LineEditDialog.tsx`), que va al servidor por `lookupProductBySku` para traer datos que **la lista ya tiene**:

- `listAgreementLines` selecciona `products:product_id(sku, erp_description, commercial_brand, status)` (línea 445 de `agreements.functions.ts`) y esos campos ya llegan a la fila.
- El `openEditForLine` de la ruta (línea 611) descarta `erp_description`, `commercial_brand` y `status` — solo pasa `sku` al `initial`.
- El modal borra su estado y muestra los inputs vacíos hasta que responde el RPC → parpadeo. Con 70k SKUs y catálogo creciente, cada apertura paga esa latencia.

Lo único que no viene en la fila es `catalog_updated_at` (el "PIM Sumatec: dd/mm/aaaa"), que hoy `lookupProductBySku` calcula con un `select ... order by updated_at desc limit 1` sobre `products` — es un valor **global del catálogo**, no del SKU, así que es el mismo para todas las filas de la lista.

## Cambios

### 1. Propagar los datos de producto por `initial`

**`LineEditDialog.tsx`** — extender `LineEditValues` (o un tipo hermano `LineEditInitial` si prefieres no ensuciar el de creación, pero como `initial` ya es `Partial<LineEditValues>` lo más simple es agregar campos opcionales):

```ts
erp_description?: string | null;
commercial_brand?: string | null;
product_status?: "active" | "inactive" | string | null;
product_updated_at?: string | null; // opcional, ver §2
```

En el `useEffect` de apertura (línea 1325):

- Si `initial?.line_id` y trae `erp_description`/`commercial_brand`, sembrar `productMeta` y `lookup` **antes** de decidir si consultar:
  ```ts
  if (initial?.erp_description !== undefined || initial?.commercial_brand !== undefined) {
    setProductMeta({
      erp_description: initial.erp_description ?? null,
      commercial_brand: initial.commercial_brand ?? null,
      updated_at: initial.product_updated_at ?? null,
    });
    setLookup({
      kind: initial.product_status === "active" ? "active"
          : initial.product_status ? "inactive" : "idle",
      // catalogUpdatedAt se rellena al llegar la consulta de refresco (§2)
    });
  } else {
    setProductMeta(null);
    setLookup({ kind: next.sku.trim() ? "idle" : "empty" });
  }
  ```
- Seguir llamando `prefillFromSku(next.sku)` en edición, pero como **refresco en segundo plano**: los `setProductMeta`/`setLookup` que hace hoy ya son idempotentes; el usuario no ve blanco porque partimos hidratados. Si el servidor devuelve algo distinto (estado cambió a inactive, descripción se editó en PIM), pisa lo mostrado sin parpadeo.

**`agreements.$agreementId.lines.tsx`** — en `openEditForLine` (línea 611) pasar los campos que la fila ya tiene:

```ts
erp_description: r.products?.erp_description ?? null,
commercial_brand: r.products?.commercial_brand ?? null,
product_status: r.products?.status ?? null,
```

### 2. `catalog_updated_at` — refresco en segundo plano, no bloqueante

Dos opciones; recomiendo **B**:

- **A.** Agregar el valor al retorno de `listAgreementLines` (una consulta `products.updated_at desc limit 1` una sola vez, pegada al listado). Ventaja: 0 red al abrir. Contra: acopla la lista a un dato que también consume el modal de creación, y hoy vive naturalmente en `lookupProductBySku`.
- **B.** Dejar `prefillFromSku` corriendo en segundo plano tal como está. Con `productMeta` ya sembrado, la única cosa que "aparece con retraso" es la línea gris `PIM Sumatec: dd/mm/aaaa`. Ese retardo es invisible perceptualmente (la línea está en el pie del bloque, en tono muted) y el usuario nunca ve inputs vacíos.

Fuera de alcance rehacer `lookupProductBySku` o el backend. Con B no se toca nada del servidor.

### 3. Creación

No se rompe: en creación `initial` es `null`, así que la rama del `if` cae a `setProductMeta(null)` como hoy. La consulta se dispara desde `handleSkuPicked`/`prefillFromSku` cuando el usuario elige un SKU (líneas 1411-1451), no desde el `useEffect` de apertura.

### 4. Otros consumidores de `prefillFromSku` / `setProductMeta(null)`

Los usos (líneas 1337, 1414, 1451) son:
- 1337: `useEffect` de apertura — el que estamos cambiando.
- 1414: dentro de `handleSkuPicked` cuando el usuario acaba de elegir un SKU desde el buscador — ese sí debe empezar sembrando con los datos del row del buscador (ya lo hace: `setProductMeta({ erp_description: p.erp_description, ... })`).
- 1451: reset al descartar cambio de SKU — sigue válido.

Ninguno depende del `setProductMeta(null)` inicial para lógica: solo era "estado limpio antes de fetch". Al sembrar desde `initial` no rompemos nada.

### 5. Fallback

- Si la fila **no** trae `erp_description`/`commercial_brand` (fila vieja, campo null en `products`), cae por la rama actual: `productMeta=null` + `lookup=idle` + `prefillFromSku`. Comportamiento idéntico al de hoy.
- Si `prefillFromSku` falla en segundo plano, el `catch` ya solo hace `console.error`; los datos sembrados desde `initial` se quedan mostrados. Mejor que hoy (hoy se quedaría en blanco).
- Si el catálogo cambió entre listar y abrir (SKU pasó a inactive, descripción editada), el refresco pisa el estado unos ms después sin parpadear los inputs (mismo comportamiento de un re-render normal).

## Validación

- Abrir modal de edición de una posición existente → los tres campos (Código Jaivaná, Marca, Descripción) aparecen **inmediatamente**, sin flash vacío. La línea `PIM Sumatec: dd/mm/aaaa` puede aparecer con un pequeño retraso (aceptable).
- Abrir modal de creación → sin cambios; buscador abre en blanco, al elegir SKU se llena.
- Abrir edición de una posición cuyo SKU quedó inactive en PIM después de crearse → arranca marcado como active (dato viejo de la fila), y al llegar el refresco cambia a inactive. Verificar que el badge/estado se actualiza sin remontar.
- Editar → cambiar SKU vía "Cambiar SKU" → confirma que el flujo de `handleSkuPicked` sigue sembrando bien.
- Row sin `products` (edge case archived/borrado) → `initial.erp_description` es null; cae al comportamiento actual.

## Fuera de alcance

Buscador de SKU, `searchProducts`, `lookupProductBySku`, backend, R-09, modal de creación, tipos generados.
