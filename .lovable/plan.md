## Alcance

Mejorar `/setup/products/import` para que el `super_admin` vea claramente todos los grupos antes de aplicar, confirme explícitamente, y reciba un resumen final tras aplicar. Sin cambios de schema/RLS, sin tablas nuevas, sin tocar `agreement_products`. El parser y el diff del Prompt 03 ya cubren todo lo necesario; solo se exponen dos helpers extra.

## Archivos

- `src/lib/pim-import.ts` — añadir derivaciones puras a partir del diff: `getInactivations`, `getClearedFields`, `FIELD_LABELS`, `formatFieldValue`. Sin cambios al parser.
- `src/routes/_authenticated/setup/products.import.tsx` — rediseñar la previsualización con grupos, confirmación por `AlertDialog` y panel de resultado final.

## Cambios en `pim-import.ts`

Añadir, sin tocar lo existente:

```ts
export const FIELD_LABELS: Record<PimField, string> = {
  sku: "Código Jaivaná",
  erp_description: "Descripción Jaivaná",
  commercial_description: "Descripción comercial",
  erp_brand: "Marca Jaivaná",
  commercial_brand: "Marca",
  brand_reference: "Referencia",
  product_classification: "Clasificación",
  erp_product_category_n1: "Línea",
  erp_product_category_n2: "Grupo",
  erp_product_category_n3: "Subgrupo",
  commercial_unit: "Unidad",
  status: "Estado",
};

export function formatFieldValue(field: PimField, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "status") return value === "active" ? "Activo" : value === "inactive" ? "Inactivo" : String(value);
  return String(value);
}

export type Inactivation = { sku: string; erp_description: string };
export function getInactivations(diff: DiffGroups): Inactivation[];

export type ClearedField = { sku: string; field: PimField; before: string };
export function getClearedFields(diff: DiffGroups): ClearedField[];
```

Reglas:
- `getInactivations`: recorre `diff.toUpdate`, retorna los que `current.status === "active"` y `next.status === "inactive"`.
- `getClearedFields`: recorre `diff.toUpdate`, por cada campo opcional en `diff.presentColumns`, si `next[f] === null` y `current[f]` no es vacío, agrega entrada. Usa `OPTIONAL_FIELDS` ya existente (exportarlo o duplicar la constante interna; preferir export tipado).

Estos helpers son derivaciones puras del diff, no requieren persistencia ni cambian el contrato del parser.

## Cambios en `products.import.tsx`

Reorganizar la preview manteniendo el flujo actual (subir archivo → preview → confirmar → resultado), sin cambiar el estilo del sitio. Componentes shadcn disponibles: `Card`, `Accordion`, `AlertDialog`, `Table` (sumatec) o tabla simple.

### Estado adicional

```tsx
const [confirmOpen, setConfirmOpen] = useState(false);
const [finalSummary, setFinalSummary] = useState<{
  created: number; updated: number; unchanged: number;
  errors: number; inactivated: number; cleared: number;
} | null>(null);
```

`finalSummary` se calcula a partir del diff justo antes del upsert y se renderiza tras éxito.

### Estructura de la previsualización

Reemplazar el bloque actual de stats + duplicados + errores por una `Card` con resumen y una `Accordion` (type=multiple) con un item por grupo. Cada item solo aparece si tiene contenido (excepto Resumen que siempre va).

1. **Resumen** (siempre visible al tope, mismo `Stat` actual):
   - Procesados, A crear, A actualizar, Sin cambios, Rechazados.
   - Pills extra (texto pequeño): `Inactivados N`, `Campos limpiados N` cuando >0.

2. **Duplicados (bloqueante)** — banner destacado por encima del accordion cuando `duplicateSkus.length > 0`:
   - Lista `SKU — filas: 3, 17`.
   - Texto: "La importación está bloqueada hasta corregir los SKUs duplicados."

3. **Accordion** con items solo si `length > 0`:
   - **Nuevos (N)**: tabla con columnas Código Jaivaná, Descripción Jaivaná, Marca, Estado (usa `formatFieldValue("status", ...)`). Limitar a 200 visibles + nota "y X más" si excede.
   - **Actualizados (N)**: lista por SKU; cada item muestra encabezado `SKU — descripción` y debajo una mini-tabla `Campo | Antes | Nuevo` usando `changedFields`, `FIELD_LABELS`, `formatFieldValue`. Limitar a 100 SKUs visibles + nota.
   - **Sin cambios (N)**: solo contador, con `<details>` colapsable que lista hasta 200 SKUs.
   - **Inactivados (N)**: tabla `Código Jaivaná | Descripción Jaivaná | Pasará a` con valor fijo "Inactivo". Texto: "Estos productos pasarán a Inactivo. Si están asociados a productos de acuerdo, deberán quedar en revisión en el flujo correspondiente."
   - **Campos limpiados (N)**: tabla `Código Jaivaná | Campo | Antes | Nuevo` con "—" en Nuevo. Texto: "Estos campos se limpiarán porque el archivo trae la columna vacía."
   - **Errores (N)**: lista `Fila X · Campo Y: mensaje` para cada error en `parsed.errors[*].errors`, usando `FIELD_LABELS` para el campo (con fallback a "Archivo" si `field === "file"`).

### Confirmación

Botón "Confirmar importación" abre `AlertDialog`:
- Título: "Confirmar importación PIM"
- Descripción con:
  - "Vas a actualizar el catálogo PIM por Código Jaivaná."
  - "Los productos ausentes del archivo no se modificarán ni se inactivarán."
  - Línea de totales: `N nuevos, N actualizados, N sin cambios, N omitidos por error`.
  - Si `errors.length > 0`: "Se importarán las filas válidas y se omitirán las filas con error."
  - Si `inactivations.length > 0`: la frase de inactivados del spec.
  - Si `clearedFields.length > 0`: la frase de campos limpiados del spec.
- Acciones: Cancelar / Confirmar e importar. La mutación se dispara solo al confirmar.

El botón queda deshabilitado si `blocked` (duplicados) o no hay productos válidos. Si hay duplicados no se abre el dialog.

### Resultado final

Al `onSuccess`, en lugar del actual `success` simple, mostrar una `Card` con:
- Mensaje: "Importación completada correctamente."
- Lista: Creados, Actualizados, Sin cambios, Omitidos por error, Inactivados, Campos limpiados.
- Botón "Ir al PIM" (ya existe).
- Botón "Importar otro archivo" que reinicia estado (`parsed`, `diff`, `presentColumns`, `finalSummary`).

## Restricciones

- No tocar `agreement_products`.
- No exponer edición manual ni toggle de estado en esta vista.
- No persistir el resumen final.
- Mantener `super_admin` gate (ya está en `setup/route.tsx`).
- Validación: `tsgo --noEmit` debe pasar.
