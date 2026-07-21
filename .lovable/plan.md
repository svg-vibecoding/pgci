## Sub-paso 3.1 — Esqueleto de la vista de importación de acuerdos

Solo cargar un archivo y ver cómo se clasifica en los 6 grupos. Sin escribir en base, sin acciones de decisión, sin asistente de grupo 2, sin mapeo de cliente.

---

### 1. Ruta y activación del botón

**Nueva ruta** (archivo nuevo):
`src/routes/_authenticated/pgci/agreements.$agreementId.import.tsx`
→ URL: `/pgci/agreements/$agreementId/import`

Ruta gemela a las otras del acuerdo (`.edit`, `.lines`, `.index`), bajo `_authenticated` (requiere sesión) y con `head()` propio ("Importar acuerdo · PGCI").

**Activar botón existente** en `agreements.$agreementId.lines.tsx` (líneas 831–844): retirar el `TooltipProvider/Tooltip` con "Importación en mantenimiento" y dejar el `Button` habilitado envuelto en `<Link to="/pgci/agreements/$agreementId/import" params={{ agreementId }}>`. Es el único cambio en `lines.tsx`.

---

### 2. Snapshot del acuerdo (LECTURA)

Nueva server function en `src/lib/agreements.functions.ts`:

```
getAgreementImportSnapshot({ agreementId })
  → { snapshot: AgreementSnapshot }
```

Con `.middleware([requireSupabaseAuth])`, tres consultas paralelas (RLS aplica):

1. **positions** — `agreement_positions` del acuerdo con join a `products(sku)`:
  `id, product_id, status, sale_price, par_price, start_date, end_date, observations, products(sku)`.
   Se aplana a `PositionSnapshot[]` (sku denormalizado desde `products.sku`).
2. **activeClientCodes** — `agreement_position_client_codes` unido a `client_products(client_code)` filtrando `agreement_position_id IN (posiciones del acuerdo)` y `valid_until IS NULL`. Se transforma a `ActiveClientCodeSnapshot[]`.
3. **clientIds** — `agreement_clients` del acuerdo → `Set<string>`.

**catalogBySku** se resuelve APARTE en el cliente, después de parsear, porque depende de los SKUs del archivo (evita traer catálogo completo). Se hace con `getCatalogProductsBySku({ skus })` — server fn nueva que consulta `products` filtrando `sku IN (...)` en chunks de 200. Retorna `Map<string, CatalogProduct>`.

Con eso, la vista arma el `AgreementSnapshot` final (positions + activeClientCodes + clientIds del snapshot fijo del acuerdo + catalogBySku dependiente del archivo) y lo pasa a `classifyImport`.

---

### 3. Estados de la vista (todos locales)

```
fileName: string | null
parsed: ParseResult | null      // { rows, presentColumns }
classified: DiffResult | null   // { rows, totals }
fileError: string | null        // formato inválido o error de lectura
loadingClassify: boolean        // mientras trae catalogBySku
```

Además: un `useQuery(["agreement-import-snapshot", agreementId])` que trae positions/activeClientCodes/clientIds una sola vez al entrar. No se refetch durante la sesión.

**resetAll()**: limpia `fileName`, `parsed`, `classified`, `fileError`. Se dispara al quitar archivo (X) y al seleccionar uno nuevo antes de parsear. Cambiar archivo = cruce nuevo desde cero. `mappedClientId` siempre `null` en 3.1.

**Flujo de `onFile**`:

1. `resetAll()` + `setFileName(file.name)`.
2. `parsePricingFile(file)` → si lanza `PricingFileFormatError`, `setFileError` con mensaje según `code` (FORMAT_UNSUPPORTED / MISSING_SKU_HEADER / DUPLICATE_HEADER / EMPTY_FILE) y return.
3. `setParsed({rows, presentColumns})`.
4. Extraer SKUs únicos no nulos → `getCatalogProductsBySku`.
5. Armar `AgreementSnapshot` con lo del snapshot query + `catalogBySku`.
6. `classifyImport({ rows, presentColumns, snapshot, mappedClientId: null })` → `setClassified`.

Errores de red en pasos 4-6 → `setFileError` genérico "No fue posible clasificar el archivo".

---

### 4. Layout (cards numeradas estilo PIM)

Header idéntico al PIM: `Link` "Volver al acuerdo" (a `/pgci/agreements/$agreementId/lines`), luego `h1 suma-h1` "Importar posiciones", subtítulo suma-body explicando el flujo, y botón outline "Descargar plantilla" → llama `downloadPricingTemplate()` ya existente.

**Card 1 — "1. Sube el archivo"**
Input file oculto + botón "Seleccionar archivo" / "Cambiar archivo", nombre del archivo con botón X para quitar, mensaje de error debajo. Copiado del PIM (bloque líneas 221-260).

**Card 2 — "2. Qué se reconoció"** (solo si `parsed`)

- Chip único con `presentColumns.length` columnas reconocidas listándolas en texto (ej: "SKU, precio de venta, precio par, fecha inicio").
- Conteo: `parsed.rows.length` filas de datos.
- Si el archivo no trae la columna `client_code` → nota informativa suma-caption: "Sin columna de código cliente: el cruce se hace solo por SKU."

**Card 3 — "3. Cómo se clasifica"** (solo si `classified`)

- Encabezado con total: "N filas clasificadas" donde `N = suma(totals)`.
- **Verificación de cuadre** (RN-IMP-08): se calcula en render `expected = parsed.rows.length` vs `sum = totals.requires_decision + totals.modifies_published + totals.modifies_draft_or_adds_code + totals.not_in_agreement + totals.unchanged + totals.not_processable`. Si difieren, banner destructivo "Inconsistencia interna, contacta soporte" (no debería ocurrir; sirve de assert visual). El motor garantiza cuadre porque cada `ParsedRow` produce exactamente un `ClassifiedRow`.
- `Accordion type="multiple"` con **los 6 items SIEMPRE presentes**, en este orden fijo (aunque tengan 0):
  1. Requieren decisión — `totals.requires_decision`
  2. Modifican posiciones publicadas — `totals.modifies_published`
  3. Modifican gestión / agregan códigos — `totals.modifies_draft_or_adds_code`
  4. No están en el acuerdo — `totals.not_in_agreement`
  5. Sin cambios — `totals.unchanged`
  6. No procesables — `totals.not_processable`
  Cada `AccordionTrigger`: nombre + `(N)` a la derecha. Contenido: por ahora, **lista mínima** con `sourceRow` + SKU + cliente-código (si aplica) — máximo 100 filas visibles + "…y X más". Sin acciones. Sin badges de motivo (llegan en 3.2+).

---

### 5. Garantía de cuadre

- Un `ParsedRow` = un `ClassifiedRow` (invariante del motor `classifyImport`).
- El total mostrado en la Card 3 usa `parsed.rows.length`.
- El assert de suma vs total renderiza banner si algo falla.
- Filas totalmente vacías ya las descarta `parsePricingFile` en silencio (no entran al total).

---

### Detalles técnicos

- Import: `parsePricingFile`, `classifyImport`, `downloadPricingTemplate`, tipos → todo desde `@/lib/agreement-import`.
- `AgreementSnapshot`, `PositionSnapshot`, `ActiveClientCodeSnapshot`, `CatalogProduct` ya están exportados en `diff.types.ts`.
- Componentes UI: `Card/CardHeader/CardContent/CardTitle`, `Accordion*`, `Button`, iconos `ArrowLeft/Download/Paperclip/X/Upload` de lucide.
- Tokens: `suma-h1`, `suma-h4`, `suma-body`, `suma-caption`, `text-text-primary/secondary/tertiary`, `text-destructive`. Nada de `text-base/sm/xs` ni `text-muted-foreground`.
- Sin modificar `parsePricingFile`, `classifyImport` ni `diff.types.ts`.
- Sin escrituras: cero mutations, cero RPCs, cero `insert/update/delete`.

---

### Archivos

- **Crea**: `src/routes/_authenticated/pgci/agreements.$agreementId.import.tsx`.
- **Edita**: `src/lib/agreements.functions.ts` (añade `getAgreementImportSnapshot` y `getCatalogProductsBySku`).
- **Edita**: `src/routes/_authenticated/pgci/agreements.$agreementId.lines.tsx` (activa botón Importar; quita tooltip de mantenimiento).  
  
[CONSTRUCCIÓN]
  Aprobado tu plan del sub-paso 3.1 con dos correcciones. Construye el esqueleto de la vista de importación. Solo cargar y ver los 6 grupos — sin acciones de decisión, sin asistente de grupo 2, sin mapeo.
  ═══════════════════════════════════════════
  CORRECCIÓN 1 — la tabla de clientes del acuerdo NO es agreement_clients
  ═══════════════════════════════════════════
  Verificado contra la base: agreement_clients NO EXISTE. Los clientes de un acuerdo viven en la tabla agreement_companies, con columnas: agreement_id, client_id, valid_from, valid_until.
  Para clientIds del snapshot: consulta agreement_companies WHERE agreement_id = ? AND valid_until IS NULL (solo companies vigentes — las de valid_until no null son históricas y NO son clientes actuales del acuerdo). Toma client_id → Set<string>.
  ═══════════════════════════════════════════
  CORRECCIÓN 2 — el reporte NO se calca del PIM
  ═══════════════════════════════════════════
  Las cards de CARGA (subir archivo, mostrar nombre, quitar con X) SÍ heredan del PIM — eso es estructural, cópialo.
  Pero la card del REPORTE (los 6 grupos) es territorio propio, construido sobre el design system Sumatec (suma-*, chip único, rampa de color), NO un molde del PIM. Para 3.1 la lista mínima por grupo está bien como punto de partida — pero constrúyela como base propia que evolucionará en 3.2+ (asistente de grupo 2, candidatas, badges de motivo), no como copia del diff de productos del PIM. No ates la estructura del reporte al patrón del PIM.
  ═══════════════════════════════════════════
  LO QUE SE MANTIENE DE TU PLAN (constrúyelo tal cual)
  ═══════════════════════════════════════════
  - Ruta nueva: src/routes/_authenticated/pgci/agreements.$agreementId.import.tsx (URL /pgci/agreements/$agreementId/import).
  - Activar el botón Importar existente en lines.tsx: quitar el tooltip de mantenimiento, envolver en Link a la ruta. Único cambio en lines.tsx.
  - getAgreementImportSnapshot (server fn, .middleware([requireSupabaseAuth])): positions (agreement_positions + join products.sku), activeClientCodes (agreement_position_client_codes + client_products.client_code, valid_until IS NULL), clientIds (agreement_companies vigentes — corrección 1).
  - getCatalogProductsBySku({ skus }) en chunks de 200 → Map<string, CatalogProduct>, resuelto tras parsear.
  - Estados locales: fileName, parsed, classified, fileError, loadingClassify. Snapshot vía useQuery una vez al entrar.
  - resetAll al quitar/cambiar archivo. mappedClientId siempre null en 3.1.
  - Flujo onFile: reset → parsePricingFile (maneja PricingFileFormatError por code) → getCatalogProductsBySku → arma snapshot → classifyImport.
  - Header: Volver al acuerdo, suma-h1 "Importar posiciones", subtítulo, botón "Descargar plantilla" → downloadPricingTemplate().
  - Card 1 "Sube el archivo" (del PIM). Card 2 "Qué se reconoció" (columnas + nº filas + nota si no hay client_code). Card 3 "Cómo se clasifica": total + assert de cuadre (banner si sum(totals) != parsed.rows.length) + Accordion con los 6 grupos SIEMPRE presentes en este orden:
    1. Requieren decisión
    2. Modifican posiciones publicadas
    3. Modifican gestión / agregan códigos
    4. No están en el acuerdo
    5. Sin cambios
    6. No procesables
    Cada trigger: nombre + (N). Contenido: lista mínima (sourceRow + SKU + código si aplica), máx 100 + "…y X más". Sin acciones aún.
  ═══════════════════════════════════════════
  INTOCABLES
  ═══════════════════════════════════════════
  1. NO es modal. Ruta propia, vista limpia.
  2. La previsualización NO escribe: cero mutations, cero RPC, cero insert/update/delete. Solo SELECT para el snapshot. (Lo verificaré con count(*) antes/después.)
  3. Tokens suma-* únicamente. NADA de text-base/text-sm/text-xs sueltos ni text-muted-foreground. Chip único existente, no reinventado.
  4. Los 6 grupos SIEMPRE suman el total (RN-IMP-08). El assert de cuadre lo hace visible.
  5. NO modificar parsePricingFile, classifyImport ni diff.types.ts.
  6. Cambiar archivo resetea a cero.
  Cuando termines, dime qué construiste. Yo verifico: clono el repo, reviso que no sea modal, que no escriba (count antes/después), que use suma-* y no calque el reporte del PIM. Tú lo ves en pantalla contra Corona EPP.