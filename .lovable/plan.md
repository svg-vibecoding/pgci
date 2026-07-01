## Vinculación de precio por SKU en Acuerdos

Implementar el flujo completo apoyado en la tabla `agreement_sku_links` recién creada. Los cambios son server-side (funciones y schemas), y client-side (modal `LineEditDialog`).

---

### 1. Server — `src/lib/agreements.schemas.ts`

Añadir schemas:

```ts
export const skuLinkSchema = z.object({
  agreement_id: z.string().uuid(),
  product_id:   z.string().uuid(),
});

export const skuLinkWithPriceSchema = skuLinkSchema.extend({
  price: z.number().nonnegative(),
});
```

### 2. Server — `src/lib/agreements.functions.ts`

Nuevas server functions (todas `requireSupabaseAuth`):

- **`linkSkuPrice`** (`POST`, input `skuLinkWithPriceSchema`)
  1. `assertCanAdmin(agreement_id)`.
  2. `insert` en `agreement_sku_links` con `agreement_id`, `product_id`, `created_by = userId`. Ignora conflicto por `unique` (ya vinculado → no-op y sigue).
  3. Resolver `sku` a partir de `product_id`, luego llamar la misma lógica que `applyPriceToSku` (update masivo de `agreement_products` con `product_id`, `status != 'excluded'`, `sale_price = price`).
  4. Devuelve `{ linked: true, updated: number }`.

- **`unlinkSkuPrice`** (`POST`, input `skuLinkSchema`)
  1. `assertCanAdmin(agreement_id)`.
  2. `delete from agreement_sku_links where agreement_id = ? and product_id = ?`.
  3. NO toca precios de posiciones. Devuelve `{ linked: false }`.

- **`isSkuLinked`** (`POST`, input `skuLinkSchema`)
  1. `assertCanAccess(agreement_id)`.
  2. `select id from agreement_sku_links … maybeSingle()`. Devuelve `{ linked: boolean }`.

- **Extender `detectNConflict`**: además de `conflicts`, resolver `product_id` por SKU y consultar `agreement_sku_links`. Devolver `{ conflicts, isLinked: boolean, product_id: string | null }`. Si no hay `product_id`, `isLinked = false`.

Helper interno reutilizable `applyPriceToProduct(supabase, agreementId, productId, price, userId)` para no duplicar el `update` entre `linkSkuPrice`, `applyPriceToSku` y el hook de `updateAgreementLine`.

### 3. Server — auto-aplicación en `updateAgreementLine`

Al final de `updateAgreementLine`, después del `update` exitoso:

1. Determinar el `product_id` efectivo (el resuelto por nuevo SKU o `line.product_id`) y el nuevo `sale_price` (si `sale_price` estuvo en el patch).
2. Si `product_id` y el precio cambió:
   - Consultar `agreement_sku_links` por `(agreement_id, product_id)`.
   - Si existe → llamar el helper `applyPriceToProduct` con el nuevo precio.
   - Saltar por completo la detección N:1 cuando el SKU está vinculado (es intencional que todos se muevan juntos).
3. La detección N:1 actual sólo se ejecuta cuando el SKU NO está vinculado (mantiene el comportamiento existente).

Cambio en el flujo actual (`priceChanged && !confirm_n_conflict`): agregar guard `&& !isLinked`.

### 4. Client — `LineEditDialog.tsx`

**Estado nuevo:**
```ts
const [isLinked, setIsLinked] = useState(false);
const [productId, setProductId] = useState<string | null>(null);
```

**`runLookup`**: `detectNConflict` ahora devuelve `isLinked` y `product_id` → guardar en estado.

**Reemplazo del bloque N:1 (líneas 425–611):**

Dos ramas dentro del mismo `Alert warning` colapsable, según `isLinked`:

- **Vinculado (`isLinked = true`)**
  - Header del alert: "Este SKU está vinculado. El precio se comparte con {N} posición(es) en el acuerdo."
  - Body: solo la mini tabla (código cliente / descripción / precio actual), sin selector de fila, sin radio.
  - Botón secundario dentro del body: **"Desvincular"** → `unlinkSkuPrice({ agreementId, productId })`, éxito → `setIsLinked(false)`, invalidar queries de líneas.
  - En `save`: se elimina la validación de `priceChoice`. Al guardar con precio editado, `updateAgreementLine` server-side aplica el precio a todas automáticamente (no se pregunta).

- **No vinculado (`isLinked = false`)**
  - Header: "Este SKU ya tiene {N} posición(es) en el acuerdo" (como hoy).
  - Body: mini tabla informativa (código / descripción / precio actual), **sin radio de "usar el mismo precio"** y **sin selector de fila**.
  - Botón secundario dentro del body: **"Vincular"** → `linkSkuPrice({ agreementId, productId, price: Number(v.sale_price) })`. Requiere `productId` y `sale_price` numérico válido; si falta precio, mostrar mensaje inline "Ingresa un precio antes de vincular". Éxito → `setIsLinked(true)`, invalidar queries, refrescar mini tabla.
  - En `save`: cada posición mantiene su propio precio (comportamiento estándar de `updateAgreementLine`).

**Estado removido:** `priceChoice`, `chosenPriceLineId`, `choiceError` y la lógica del radio group. El botón "Guardar" pierde el pre-check `priceChoice === null`.

**Notas de UX:**
- El botón "Vincular / Desvincular" usa `Button size="sm" variant="outline"` con `Loader2` durante la mutación.
- `useMutation` separados: `linkMut`, `unlinkMut`. Toast de éxito: "SKU vinculado. Precio aplicado a N posiciones." / "SKU desvinculado."
- Al abrir el diálogo en modo edición con SKU pre-cargado, `runLookup` ya trae `isLinked`.

### 5. Invalidaciones

Tras `link/unlink` y tras `updateAgreementLine` con propagación:
- `["agreements", "lines", agreementId]`
- `["agreements", "detail", agreementId]`

### 6. Verificación

- `bunx tsgo --noEmit`.
- Reproducir manualmente en `/pgci/agreements/:id/lines`:
  1. Crear/editar posición con SKU que ya tenga otras posiciones (no vinculado) → aparece alert, botón "Vincular", guardar sin propagar.
  2. Vincular → precio se aplica a todas, alert cambia a estado vinculado.
  3. Editar precio de una posición vinculada → tras guardar, todas cambian sin preguntar.
  4. Desvincular → precios quedan como estaban, siguiente edición vuelve a ser independiente.

### Fuera de alcance

- UI listado global de SKUs vinculados por acuerdo.
- Migración de datos históricos (no aplica; la tabla se creó vacía).
- Modificar el flujo de importación (`commitAgreementImport`) — sigue con `price_resolutions` explícitos.
