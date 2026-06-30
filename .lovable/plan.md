# Ajustes al modal "Nueva posición" / "Editar posición"

Archivos a tocar:
- `src/lib/agreements.functions.ts` — nueva server fn `lookupProductBySku`.
- `src/components/agreements/LineEditDialog.tsx` — reestructura UI y lookup.

Sin cambios en schemas, RLS, ni en `agreements.server.ts` (se reutiliza `resolveProductBySku`).

## 1. Server function `lookupProductBySku`

En `agreements.functions.ts`, nueva fn protegida con `requireSupabaseAuth`:

- Input: `{ sku: string }` (trim, no vacío).
- Lógica:
  - Consulta `products` por `sku` exacto seleccionando `id, sku, erp_description, commercial_brand, status`.
  - En paralelo, consulta `max(updated_at)` de `products` (para la fecha de "última actualización del catálogo") — un `select("updated_at").order("updated_at", { ascending: false }).limit(1)`.
- Output:
  - `{ found: true, status: "active" | "inactive", erp_description, commercial_brand }` si existe.
  - `{ found: false, catalog_updated_at: string | null }` si no.

## 2. Reestructura del modal `LineEditDialog`

Reorganizar el grid actual en **dos secciones** con el patrón visual que ya usan otras vistas (un `<h4>` con `text-sm font-semibold` + `<Separator />`, mismo estilo que usa `InfoSection`/forms de Setup):

**Sección "Información del cliente"** (grid 2 columnas):
- Código del cliente
- Descripción del cliente (full width)

**Sección "Información Jaivaná"** (grid 2 columnas):
- Código Jaivaná (SKU) — editable, con validación on-blur
- Descripción Jaivaná — **solo lectura**, autopoblada (`bg-muted`)
- Marca — **solo lectura**, autopoblada (`bg-muted`)

Debajo del bloque Jaivaná se mantienen Precio venta, Precio par, Fecha inicio, Fecha fin, Observaciones (sin cambios estructurales — quedan fuera de las dos secciones nombradas, agrupadas bajo una tercera sección "Condiciones comerciales" para mantener consistencia visual).

## 3. Lookup on-blur del SKU

Estado local nuevo en el componente:
- `productMeta: { erp_description: string | null; commercial_brand: string | null } | null`
- `lookupState: { kind: "idle" | "loading" | "active" | "inactive" | "not_found" | "empty"; catalogUpdatedAt?: string | null }`

En `useEffect` al abrir, si viene `initial.sku` con valor, disparar lookup una vez para precargar los campos read-only (modo edición).

Handler `onBlur` del input SKU:
- Si el valor está vacío → `lookupState = "empty"`, limpia `productMeta`, sin alerta.
- Si tiene valor → `loading` → llama `lookupProductBySku`:
  - `found && status === "active"` → puebla `productMeta`, estado `active`, sin alerta.
  - `found && status !== "active"` → puebla `productMeta`, estado `inactive`, alerta amarilla (`Alert variant="warning"`): *"Producto inactivo en el catálogo. Esta posición quedará en 'Requiere revisión'."*
  - `!found` → limpia `productMeta`, estado `not_found`, alerta roja (`Alert variant="error"`): *"Código no encontrado en el catálogo Jaivaná (última actualización: dd/mm/aaaa)."* usando `catalog_updated_at` formateada con el helper local `fmtDate` (si es null, omite el paréntesis).

La alerta se renderiza directamente debajo del input SKU dentro de la sección Jaivaná.

## 4. Notas

- No se bloquea el guardado por SKU no encontrado: el flujo "campo vacío / no encontrado" sigue permitiendo crear la posición en estado pending (la lógica de backend ya lo soporta).
- Los campos read-only de descripción/marca son puramente informativos en el cliente; el backend ya deriva esos datos del `product_id` resuelto vía `resolveProductBySku` al guardar — no se envían en el payload.
- Reutiliza `Alert`/`AlertDescription` de `@/components/ui/alert` con variantes `warning` y `error` ya definidas.
