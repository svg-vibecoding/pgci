# Paso 2 — Motor de cruce (diff)

Función pura de clasificación. Sin red, sin RPC, sin escritura, sin lectura a la base. Recibe estado como parámetros y devuelve la clasificación de cada fila del archivo en 6 grupos.

Ubicación: `src/lib/agreement-import/diff.ts` (+ `diff.types.ts` para tipos y `index.ts` re-exporta).

---

## 1. Firma y estructuras

### Entrada

```ts
type ProductStatus = "active" | "inactive" | /* lo que exista en catálogo */ string;
type PositionStatus = "active" | "requires_review" | "excluded" | "draft";

// Posición del acuerdo (subset solo-lectura que el diff necesita)
type PositionSnapshot = {
  id: string;                 // agreement_position.id
  product_id: string;         // producto vinculado
  sku: string;                // sku del producto vinculado (denormalizado para comparar)
  status: PositionStatus;
  sale_price: number | null;
  par_price: number | null;
  start_date: string | null;  // ISO YYYY-MM-DD
  end_date: string | null;    // ISO YYYY-MM-DD
};

// Código vigente del acuerdo (valid_until IS NULL)
type ActiveClientCodeSnapshot = {
  position_id: string;        // agreement_position.id al que pertenece
  client_id: string;          // qué cliente del acuerdo
  client_code: string;        // el código tal cual está en la base
};

// Resolución sku→product del catálogo
type CatalogProduct = {
  product_id: string;
  sku: string;
  status: ProductStatus;
};

type AgreementSnapshot = {
  positions: PositionSnapshot[];
  activeClientCodes: ActiveClientCodeSnapshot[];
  // Catálogo: solo los SKUs que aparecen en el archivo — la orquestación
  // hace la consulta acotada y nos pasa este mapa ya resuelto.
  catalogBySku: Map<string, CatalogProduct>;
  // Empresas del acuerdo. Necesario para validar client_code (cliente vigente).
  clientIds: Set<string>;
};

function classifyImport(
  rows: ParsedRow[],           // del Paso 1
  presentColumns: PricingField[], // del Paso 1
  snapshot: AgreementSnapshot,
): DiffResult;
```

La orquestación (paso posterior, no ahora) es quien decide qué SKUs consultar y arma el snapshot. El motor no sabe de dónde viene.

### Salida

```ts
type DiffGroup =
  | "requires_decision"       // 1
  | "modifies_published"      // 2
  | "modifies_draft_or_adds_code" // 3
  | "not_in_agreement"        // 4
  | "unchanged"               // 5
  | "not_processable";        // 6

type ChangeField =
  | "sale_price" | "par_price"
  | "start_date" | "end_date"
  | "observations"
  | "add_client_code";        // agregar código nuevo (no cierra el viejo — el diff no borra)

type FieldChange =
  | { field: "sale_price" | "par_price"; from: number | null; to: number | null }
  | { field: "start_date" | "end_date"; from: string | null; to: string | null }
  | { field: "observations"; from: string | null; to: string | null }
  | { field: "add_client_code"; client_id: string; client_code: string; description: string | null };

type Candidate = {
  position_id: string;
  status: PositionStatus;
  sale_price: number | null;
  par_price: number | null;
  start_date: string | null;
  end_date: string | null;
  // Sin preselección. Sin filtrar por estado.
};

type DecisionReason =
  | "sku_in_multiple_positions"     // caso 3
  | "code_sku_mismatch"             // caso 4
  | "duplicate_in_file"             // dos filas al mismo destino con valores distintos
  | "row_has_cell_errors";          // cellErrors del Paso 1 → no clasificable

type ClassifiedRow = {
  sourceRow: number;                // conserva ParsedRow.sourceRow
  group: DiffGroup;
  // Solo cuando el grupo la requiere:
  resolvedPositionId?: string;      // grupos 2, 3, 5
  candidates?: Candidate[];         // grupo 1 (caso 3), y grupo 4 opcional (ninguna)
  changes?: FieldChange[];          // TODOS los cambios que trae la fila (regla B)
  reason?: DecisionReason;          // grupo 1 y a veces 6
  // Eco de la fila cruda para el reporte del paso posterior:
  row: ParsedRow;
};

type DiffResult = {
  rows: ClassifiedRow[];
  // Aritmética que la vista de reporte usará. Suma == rows.length.
  totals: Record<DiffGroup, number>;
};
```

---

## 2. Cascada de resolución (fila → posición)

Se aplica en este orden estricto por cada fila. La primera que "engancha" gana.

**Preludio (por fila):**

- Si la fila trae `cellErrors.length > 0` → grupo 1, `reason: "row_has_cell_errors"`. No entra a la cascada.
- Índices que construyo UNA vez antes del loop:
  - `positionsBySku: Map<sku, PositionSnapshot[]>`
  - `positionByActiveCode: Map<"${client_id}::${client_code_normalizado}", position_id>` (código único vigente por cliente en el acuerdo)
  - `codeNormalize(s)`: trim + colapso de espacios + upper. Documentado y único punto de comparación de códigos.

**Cascada:**

1. **Código de cliente vigente en el acuerdo.**
  La fila trae `client_code` (y `client_code` no vacío). Uso `client_id` de la fila (viene del parser) + código normalizado → busco en `positionByActiveCode`. Hit → posición resuelta. Sigo a "reglas post-resolución" (ver §3).
   Si la fila trae código pero NO trae `client_id`, o el `client_id` no está en `clientIds` → no se puede usar el código como ancla. Cae al paso 2.
2. **Solo SKU, UNA posición en el acuerdo.**
  `positionsBySku.get(sku)` tiene longitud 1. Posición resuelta = esa. Sigo a §3.
3. **Solo SKU, VARIAS posiciones.**
  `positionsBySku.get(sku).length > 1`. NO elijo. Grupo 1, `reason: "sku_in_multiple_positions"`, `candidates` = todas (regla C: sin filtrar por estado, sin preseleccionar). `changes` = los deltas que la fila trae contra… nada (la humana elegirá contra cuál). Igual devuelvo `changes` normalizados (los valores propuestos de la fila) sin `from`, o mejor, dejo `changes` fuera aquí y la UI mostrará el "propuesto" contra la candidata elegida.
   Decisión: en grupo 1 caso 3 emito `changes` como `{ field, to }` sin `from`, o mejor uso un tipo separado `ProposedValues` — lo aclaro en la sección de tipos finales. **Pregunta al usuario si aplica** (ver §7).
4. **Contradicción código ↔ SKU.**
  El código resolvió a `positionA` (paso 1) pero la fila también trae SKU y `positionA.sku !== rowSku`. Grupo 1, `reason: "code_sku_mismatch"`. No resuelvo.
5. **SKU no está en el acuerdo, pero SÍ en `catalogBySku`.**
  `positionsBySku.get(sku)` vacío y `catalogBySku.has(sku)`. Grupo 4 `not_in_agreement`. Sin `resolvedPositionId`, sin `changes` (no hay contra qué comparar).
6. **SKU no existe en catálogo.**
  `!catalogBySku.has(sku)`. Grupo 6 `not_processable`.

Casos borde de la cascada:

- Fila sin SKU y sin código válido → grupo 6 `not_processable` (no hay por dónde entrar). Si trae solo código pero `client_id` no está en el acuerdo, mismo destino.
- Fila con código válido cuyo `positionA.sku` coincide con `rowSku` (o la fila no trae SKU) → paso 1 gana limpio.

---

## 3. Reglas post-resolución (solo si la cascada resolvió a UNA posición)

Aquí se decide entre grupos 2, 3, 5. Se comparan **solo las columnas presentes** (regla A).

### 3.1 Cálculo de deltas

Recorro `presentColumns` y comparo el valor parseado de la fila contra la posición resuelta, campo a campo:

- `sale_price`, `par_price`: comparación numérica directa (`Number.EPSILON` no aplica — el parser ya normalizó a número finito; `null === null` es igual; `null` vs número → cambio).
- `start_date`, `end_date`: comparación de strings ISO exactos.
- `observations`: comparación de strings; `null` vs `""` tratados igual (el parser ya devuelve `null` para vacío).
- `sku`: NO se compara aquí. Si la fila resolvió a posición y el SKU difiere, ya lo capturó el paso 4 de la cascada como contradicción. Si resolvió por SKU (paso 2), el SKU por definición coincide.
- `client_code` / `client_description`: no son "cambio de la posición". Si la fila trae un código y el cliente correspondiente NO tiene un código vigente en esa posición, se emite un `FieldChange { field: "add_client_code", ... }` — agregar código nuevo, no reemplazar. Si el cliente ya tiene un código vigente distinto en esa posición, eso es cambio de código (no está en el alcance decidido: cae a grupo 1, `reason: "code_sku_mismatch"`? — **pregunta al usuario en §7**).

Columna ausente → no se compara → no genera cambio. Nunca se interpreta ausencia como "vaciar".

### 3.2 Asignación de grupo (regla B: atomicidad, mayor consecuencia domina)

- `changes` vacío → grupo 5 `unchanged`.
- `changes` no vacío y `position.status ∈ {active, requires_review, excluded}` → grupo 2 `modifies_published`.
- `changes` no vacío y `position.status === "draft"` → grupo 3.
- `changes` contiene SOLO `add_client_code` (sin cambios en precio/vigencia/observaciones), sobre cualquier estado → grupo 3 (regla del enunciado: "solo agrega un código nuevo a cualquier posición").
- Si hay mezcla (add_client_code + cambio de precio) sobre publicada → grupo 2 (mayor consecuencia). `changes` conserva ambos.

---

## 4. Duplicados dentro del archivo

Después de clasificar todas las filas, hago una segunda pasada:

- Agrupo por `resolvedPositionId` (solo filas que resolvieron a una posición: grupos 2, 3, 5).
- Si dos o más filas resuelven a la misma posición Y sus `changes` no son idénticos (comparación estructural sobre el conjunto de campos tocados y sus `to`) → todas esas filas pasan a grupo 1, `reason: "duplicate_in_file"`, conservando `resolvedPositionId` y sus `changes` propios como contexto. El motor NO elige ganadora.
- Si dos filas resuelven a la misma posición con `changes` idénticos (incluye ambas "sin cambios") → se dejan como estaban. No es conflicto.

---

## 5. Regla C — Candidatas del caso 3

`Candidate` incluye todos los estados sin filtro (`draft` incluido explícitamente). No hay campo "preseleccionada". La UI del paso posterior es responsable de mostrarlas planas. El motor solo garantiza que están todas y en orden estable (por `position_id` ascendente, para tests deterministas).

---

## 6. Aritmética y totales

`totals[group]` se calcula al final. Invariante testeada: `sum(totals) === rows.length === filas_no_vacías_del_archivo`. El motor no descarta filas (el Paso 1 ya descartó vacías); si una fila entra, sale clasificada en exactamente un grupo.

---

## 7. Casos borde / preguntas abiertas

Antes de construir necesito una decisión tuya en dos puntos:

**(a) Grupo 1 caso 3 — ¿emito `changes` propuestos?**
Opciones: (i) no emitir `changes` (la UI recalcula contra la candidata elegida), (ii) emitir "valores propuestos" sin `from`. Mi recomendación: (i), más simple y evita duplicar semántica. Confirma.

**(b) Fila con código vigente que apunta a `positionA`, cuyo SKU coincide, pero además el archivo trae un `client_code` distinto para OTRO cliente del acuerdo en la misma fila.**
La estructura del archivo es una fila = un código de cliente (revisar `ParsedRow`: hoy tiene un solo `client_code` + `client_id`, así que este caso no existe en la práctica). Confirmo con lectura de `ParsedRow` real que solo hay un par cliente/código por fila y descarto este borde.

**(c) Cliente ya tiene un código vigente distinto en la posición resuelta y la fila trae otro código para ese mismo cliente.**
No es "agregar" (add_client_code exige que el cliente NO tenga vigente). Opciones: (i) grupo 1 con `reason` nuevo `"client_code_replace"`, (ii) tratarlo como cambio silencioso y dejarlo a la RPC. Mi recomendación: (i) — el cruce no toma esa decisión.

**(d) Filas con `cellErrors` del Paso 1.**
Propuesto: grupo 1 con `reason: "row_has_cell_errors"`. Confirma o dime si prefieres un grupo 7 separado (yo creo que no vale la pena).

**(e) Precio 0 o negativo.**
El parser ya rechaza no-numéricos. Un `0` legítimo pasa. El motor NO valida rangos — eso es del Paso 3 (validación previa a la RPC) o de la RPC misma. Confirmo alcance.

**(f) `client_id` en la fila.**
Asumo que `ParsedRow` ya trae `client_id` resuelto (por `client_code` en el header del archivo o por columna). Reviso el shape real de `ParsedRow` antes de escribir — si no está, la firma del snapshot cambia y hay que reabrir.

---

## 8. Aislamiento (intocables)

- No importa `sku-conflict.ts` ni replica `position_has_sku_conflict`. El motor no dice si la posición "quedará en conflicto" — eso lo dirá la base después de escribir.
- No calcula `pending_reason`.
- No consulta ni escribe. Función pura sobre parámetros.
- No reusa `pim-import.ts` ni el parser (solo consume su output `ParsedRow`).

---

## 9. Tests que preveo (para el Paso 3 de verificación, no ahora)

Snapshot fixture + tabla de casos: los 7 escenarios que enumeraste + duplicados intra-archivo + aritmética + orden estable de candidatas. Todo puro, sin mocks de red.

---

## 10. Qué necesito para construir

Respuestas a (a), (c), (d), (f) del §7. Con eso escribo `diff.ts`, `diff.types.ts` y actualizo el barrel.

[CONSTRUCCIÓN]

Aprobado tu plan del motor de cruce con seis resoluciones y una corrección de firma. Construye diff.ts + diff.types.ts en src/lib/agreement-import/ siguiendo tu plan, con estos cambios. NO construyas UI. Función pura.

═══════════════════════════════════════════

INTOCABLES — mandan sobre todo lo de abajo

═══════════════════════════════════════════

1. El motor NO anticipa el conflicto de SKU. NO importa sku-conflict.ts, NO replica position_has_sku_conflict, NO calcula si una fila "quedará en conflicto". El estado resultante lo dice la base tras escribir, en un paso posterior. (Deuda que ya rompió una vez — no la reintroduzcas.)

2. NO calcula pending_reason.

3. NO consulta la base, NO escribe, NO llama RPC. Función pura sobre parámetros.

4. NO valida rangos de precio (0, negativo, etc.). Solo clasifica.

5. NO elige ganadora en duplicados ni auto-asigna en ambigüedad. Eso es decisión humana.

6. NO reusa el parser ni pim-import.ts; solo consume ParsedRow.

═══════════════════════════════════════════

CORRECCIÓN DE FIRMA (tu pregunta f — verificado contra el código)

═══════════════════════════════════════════

ParsedRow NO tiene client_id — solo client_code (texto) y client_description. Verificado en el código del Paso 1.

El cliente al que pertenecen los códigos entra como PARÁMETRO ÚNICO de la corrida, no por fila (un archivo = un cliente, RN-IMP-09):

  function classifyImport(

    rows: ParsedRow[],

    presentColumns: PricingField[],

    snapshot: AgreementSnapshot,

    mappedClientId: string | null,   // ← NUEVO parámetro. null = mono-cliente o archivo sin columna de códigos

  ): DiffResult;

- Con mappedClientId != null: el código se resuelve por (mappedClientId, client_code_normalizado) → posición. Es la vía fuerte (caso 1 de la cascada).

- Con mappedClientId == null: NO se usa código. El motor resuelve SOLO por SKU (casos 2-6). Este es el caso dominante (listas de precios por SKU).

Ajusta AgreementSnapshot.activeClientCodes y el índice positionByActiveCode para clavear por (client_id, client_code_normalizado) usando el client_id real de cada código en la base, y compáralo contra mappedClientId.

═══════════════════════════════════════════

SEIS RESOLUCIONES (aplica tal cual)

═══════════════════════════════════════════

(a) SKU en varias posiciones (caso 3) → grupo requires_decision con candidates (todas, sin filtrar estado, sin preseleccionar, orden estable por position_id). NO emitas changes/valores propuestos aquí — la UI los mostrará contra la candidata que la persona elija.

(c) Reemplazo de código del mismo cliente: si el cliente mapeado YA tiene un código vigente en la posición resuelta y la fila trae uno DISTINTO para ese mismo cliente → grupo requires_decision, reason nuevo "client_code_replace". El motor NO reemplaza; la persona decide. (add_client_code sigue siendo solo cuando el cliente NO tiene código vigente ahí.)

(d) Fila con cellErrors del Paso 1 → grupo not_processable (grupo 6), NO requires_decision. Un dato ilegible no es una decisión, es algo a corregir en el archivo. Usa un reason que lo identifique (ej. "row_has_cell_errors") pero el GRUPO es not_processable.

(e) El motor no valida rangos de precio. Un 0 o vacío pasa como cualquier valor. Fuera de alcance, confirmado.

Precio 0/vacío NO es error en ningún punto: se clasifica normal (si el SKU no está en el acuerdo → grupo not_in_agreement, que podrá crear draft después; si actualiza → grupo 2/3). El "sin precio → draft" se resuelve en la escritura (Paso 4), no aquí.

═══════════════════════════════════════════

LO QUE SE MANTIENE DE TU PLAN (no lo cambies)

═══════════════════════════════════════════

- Cascada en orden estricto (código vigente → SKU único → SKU múltiple → contradicción código/SKU → fuera del acuerdo → no existe en catálogo).

- Regla A: "sin cambios" compara SOLO columnas presentes (presentColumns). Ausencia nunca significa vaciar.

- Regla B: fila atómica, entra al grupo de mayor consecuencia (grupo 2 domina sobre 3), pero changes conserva TODOS los cambios de la fila.

- Regla C: candidatas con todos los estados, contexto (estado/precio/vigencia) incluido.

- Duplicados intra-archivo (misma posición, changes distintos) → requires_decision, sin elegir ganadora.

- totals con invariante sum(totals) === rows.length.

- Comparaciones: precio numérico, fechas ISO string, observations null==="".

═══════════════════════════════════════════

CÓMO LO VERIFICARÉ (yo, ejecutando, no tu reporte)

═══════════════════════════════════════════

Correré classifyImport con snapshots del estado real de un acuerdo:

  - SKU en 3 posiciones → requires_decision, 3 candidatas, ninguna preseleccionada.

  - SKU en 1 active con precio distinto → modifies_published.

  - SKU en 1 draft con precio distinto → modifies_draft_or_adds_code.

  - Código vigente (con mappedClientId) → resuelve a la posición exacta.

  - Mismo caso con mappedClientId=null → NO usa código, cae a resolución por SKU.

  - SKU inexistente en catálogo → not_processable.

  - Fila con cellError → not_processable.

  - Reemplazo de código mismo cliente → requires_decision, reason client_code_replace.

  - Aritmética: los grupos suman las filas.

Al terminar, dime la firma final, los tipos, y cómo resuelve la cascada el caso mappedClientId=null. No cierres el paso — lo cierro yo ejecutando contra el estado real.