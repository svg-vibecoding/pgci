## Plan v1 — Reporte completo (Card 3, los 6 grupos)

Este plan describe cómo construyo la versión inicial FULL. No entra al pulido fino de cada grupo (eso es la siguiente iteración, grupo por grupo).

---

### 1. Extracción previa: `PositionCard` compartida

Hoy la "tarjeta de posición" existe **inline** dentro de `lines.tsx` (líneas ~1277–1315). No hay componente reutilizable. Para que el reporte hable "en modo posición" con coherencia visual total, el primer paso es extraer esa tarjeta a un componente compartido antes de tocar el reporte.

- Nuevo: `src/components/agreements/PositionCard/PositionCard.tsx`
- Props mínimas: `{ status, statusLabel?, sku, brand?, description?, salePrice, parPrice?, startDate, endDate, clientCodes?: Array<{clientLabel, code, description?}>, headerRight?: ReactNode, footer?: ReactNode, tone?: "default"|"muted"|"warning"|"info", className? }`.
- Slots (`headerRight`, `footer`, y un `overlay?` opcional para el checkbox de G4) son los que permiten reusar la misma tarjeta en los 4 grupos ricos sin duplicar layout.
- `lines.tsx` migra a usar `PositionCard` en la misma PR (cambio visual nulo si el port es fiel — verificable en pantalla).

Sin esta extracción los 4 grupos ricos re-implementan la tarjeta y perdemos la promesa de coherencia. Es la única refactor obligatoria del plan.

---

### 2. Estructura de carpetas del reporte

Todo el reporte se saca de la ruta y vive en su propio subárbol para poder iterar por grupo:

```text
src/components/agreements/import-report/
  ImportReport.tsx              // orquestador: sticky bar + los 6 grupos en orden 1→4→2→3→6→5
  StickyDecisionBar.tsx
  GroupShell.tsx                // header común: título, chip conteo, chip "sin resolver", expand/colapsar
  groups/
    Group1RequiresDecision.tsx  // master-detail
    Group2ModifiesPublished.tsx // tarjetas actual→nuevo + filtro
    Group3DraftsAndCodes.tsx    // 2 sub-secciones
    Group4NotInAgreement.tsx    // tarjetas con checkbox + banner
    Group5Unchanged.tsx         // inerte, filas enriquecidas, colapsado
    Group6NotProcessable.tsx    // inerte, filas + filtro + descarga
  parts/
    PositionCardDiff.tsx        // wrapper de PositionCard que renderiza actual→nuevo (G2)
    PositionCardCandidate.tsx   // wrapper para candidatas de G1 con botón "Aplicar a esta"
    PositionCardNew.tsx         // wrapper para "así quedará si la creas" (G4)
    EnrichedRow.tsx             // fila enriquecida compartida por G5 y G6
    ChangeChips.tsx             // chips "precio venta", "fecha fin", "obs"... reutilizable en G2/G3
    DeltaPrice.tsx              // Δ% con color, con la regla "solo si actual > 0"
    ReasonChip.tsx              // motivos de G4 y G6
```

La ruta `agreements.$agreementId.import.tsx` queda como shell: sube archivo → parsea → clasifica → pasa `DiffResult` + snapshot + catálogo a `<ImportReport />`. Toda la lógica de decisión vive dentro del componente.

---

### 3. Estado de decisiones (fuente única)

Un solo hook local en `ImportReport`, sin librería, sin persistencia (contrato: nada se escribe):

```ts
type Decision =
  | { kind: "pending" }                              // default G1
  | { kind: "apply_to_candidate"; positionId: string } // G1
  | { kind: "create_new" }                           // G1 y G4 (crear)
  | { kind: "ignore" }                               // G1, G4 (default), G2/G3 excluidas
  | { kind: "apply" };                               // G2/G3 default

// keyed por sourceRow (identidad estable de la fila del archivo)
const [decisions, setDecisions] = useState<Map<number, Decision>>(...);
```

Al inicializar `decisions` desde `DiffResult`:
- G1: `pending` (nada preseleccionado — contrato).
- G2, G3: `apply`.
- G4: `ignore` (nada preseleccionado — contrato).
- G5, G6: no entran al mapa (no tienen decisión).

Derivados (memo):
- `pendingCount` = G1 con `pending` + G4 con `ignore`? → **decisión abierta abajo**.
- `toApplyCount` = G1 resueltas (`apply_to_candidate|create_new`) + G2 con `apply` + G3 con `apply` + G4 con `create_new`.
- `publishedModifiedCount` = subset de `toApplyCount` cuya candidata/posición está en status `active` o `requires_review` (esto es el "volumen visible" que pide la sticky bar).

Acciones en bloque (G1 "ignorar todas", G4 "seleccionar todas / solo completas") son setters masivos sobre el mismo mapa.

---

### 4. Barra sticky (`StickyDecisionBar`)

Un solo componente arriba del reporte, `position: sticky; top: 0`, fondo sólido, sombra Sumatec cool-gray, dentro del scroll de la Card 3.

Layout (izquierda → derecha):
- Total de filas leídas.
- Chip **"Requieren tu atención: N"** (rojo `--primary` si > 0, gris si 0). Suma G1 sin resolver + G4 sin decidir explícitamente… con matiz: G4 no tiene "sin decidir" real porque su default es `ignore`. **Asimetría a resolver antes de construir — ver §7.**
- Chip **"Se aplicarán: N"** (accent azul).
- Chip **"Modifican publicadas: N"** (`publishedModifiedCount`, el volumen visible que pediste).
- Chips informativos G5 (sin cambios) y G6 (no procesables), compactos, sin acción.
- Botón primario **"Confirmar importación"** al extremo derecho. Deshabilitado con tooltip "Resuelve las N filas del grupo 1 antes de confirmar" mientras G1 tenga `pending`. La confirmación real es out-of-scope de este plan (Paso 4 del motor).

La barra no reimplementa cálculos: solo lee los derivados del hook.

---

### 5. Layout por grupo (cómo se ensambla la asimetría)

**Regla transversal:** cada grupo se monta con `<GroupShell title conteo hint sinResolverChip? defaultOpen>`. Lo que cambia es el body.

**G1 Requieren decisión — master-detail**
- Izquierda (30%): lista compacta de filas del archivo (nº fila + SKU + código cliente + chip resuelto/pendiente). Selección local.
- Derecha (70%): arriba `<PositionCardNew />` con lo que trae el archivo (título "La fila del archivo"); debajo, "Posiciones candidatas del acuerdo" con `<PositionCardCandidate />` apiladas (cada una con botón "Aplicar a esta" en `footer`, y el `<StatusBadge>` de la posición en `headerRight`).
- Acciones bottom-of-detail: "Ignorar esta fila" · "Crear como posición nueva".
- Acción bloque en `GroupShell`: "Ignorar todas las sin resolver".

**G2 Modifican publicadas — grid de tarjetas-posición con diff**
- Encabezado del grupo: filtro por tipo de cambio como **chips toggleables** (precio venta / precio par / fecha inicio / fecha fin / observaciones) + ordenamiento (|Δ%| desc default, Δ absoluto, nº fila).
- Body: grid 1 col (>=lg 2 col) de `<PositionCardDiff />`. Cada tarjeta muestra la posición actual y, dentro del `footer` de la tarjeta, un bloque "Cambios" con filas `campo: actual → nuevo` + `<DeltaPrice>` (regla: solo si `actual > 0`; si no, "nuevo: $X" sin %).
- `headerRight` de la tarjeta: switch/checkbox "Aplicar" (default ON). Off = excluida esta importación (visual tachado suave).
- Barra de estadísticas opcional arriba: subidas / bajadas / mediana Δ%. **Marcada como opcional para v1** — si retrasa, va en la iteración de pulido de G2.

**G3 Modifican gestión / agregan códigos — 2 sub-secciones**
- Sub-header dentro del `GroupShell`: dos títulos con micro-conteo.
  - **3a. Completan borrador**: `<PositionCardDiff />` con `tone="muted"`; en el footer, en vez de "actual → nuevo", `<ChangeChips>` con "se llenará: precio venta, fecha fin…" (los campos que estaban vacíos).
  - **3b. Agregan código a posición existente**: `<PositionCardDiff />` mostrando la posición receptora y, en `footer`, un bloque "Nuevo código: CORONA · COR-005 — descripción". Chip "código nuevo" en `headerRight`.
- Acción por tarjeta: "Excluir". Bloque por sub-sección: "Excluir todas".
- Tono visual suave (gris/muted, sin colores de alerta) para comunicar "esto completa, no rompe".

**G4 No están en el acuerdo — tarjetas con checkbox + banner**
- Banner neutro arriba (fondo `--muted`, sin ícono de peligro): *"Estas posiciones no existen en el acuerdo. Por defecto se ignoran. Puedes crearlas como borrador para revisar después."*
- Body: grid de `<PositionCardNew />` que renderiza "así quedará si la creas" (SKU + marca/descripción si el SKU está en catálogo, precios, vigencia). El `<PositionCard>` recibe `overlay` con un checkbox top-left grande. `headerRight`: `<ReasonChip>` (por qué no coincide: "SKU no está en acuerdo" / "Cliente no cubierto" / "Combinación nueva").
- Acción bloque en `GroupShell`: "Seleccionar todas" · "Solo con precio y vigencia completos" · "Deseleccionar todas".
- Contador vivo "N de M seleccionadas para crear".

**G5 Sin cambios — inerte, colapsado por default**
- `GroupShell` colapsado. Al abrirse, `<EnrichedRow>` en lista compacta (una línea por fila): status dot · SKU en mono · marca · descripción · "→ posición actual coincide". Sin acciones. Link "Ver todas" abre un dialog si son >100.

**G6 No procesables — inerte, filas enriquecidas + descarga**
- `GroupShell` con acción en el header: botón secundario "Descargar no procesables (.xlsx)" (reutiliza patrón de `agreement-export.ts`).
- Encabezado del body: chips de filtro por tipo de motivo (agrupados desde `describeRowReason`). Cuenta por tipo.
- Body: `<EnrichedRow>` por fila con SKU + descripción del catálogo si se pudo resolver (contrato: si no está en catálogo, solo SKU) + motivo formateado como chip en `--primary`.

---

### 6. Reutilizaciones concretas

- `PositionCard` (nueva, extraída de `lines.tsx`) — usada por G1, G2, G3, G4.
- `StatusBadge` (`@/components/sumatec`) — dentro de `PositionCard.headerRight`.
- `Chip` (`@/components/sumatec`) — filtros de G2/G6, chips de cambio, motivos.
- `Badge`, `SummaryToggle` — si aplica en la sticky bar.
- `formatMoneyCOP` (`@/lib/format`) — todos los precios.
- Formato de vigencia y `PricingField` label map — ya existe `FIELD_LABELS` y `CANONICAL_HEADERS`; se centraliza en `src/components/agreements/import-report/labels.ts` para no duplicar.
- `describeRowReason` ya existe — se mueve a `parts/reasons.ts` (v1 no lo reescribe, solo lo mueve para que G6 lo importe sin depender de la ruta).
- `Accordion` de `@/components/ui/accordion` se descarta: el nuevo `GroupShell` es a medida (el acordeón actual no da espacio para chips de estado del grupo ni acciones inline en el header).

---

### 7. Asimetrías que valen decidir ANTES de construir

Marco las que veo. Son preguntas de contrato, no de layout.

**A) Semántica de "requieren tu atención" en G4.**
G1 tiene un estado natural `pending` (nadie ha elegido). G4 tiene default `ignore` (contrato). ¿G4 cuenta como "requiere atención" solo mientras el usuario no lo haya mirado (necesita un flag `viewed`), o **no cuenta nunca** porque su default ya es una decisión válida? Mi propuesta v1: **G4 NO cuenta como atención**; solo aporta al contador cuando el usuario marca al menos una para crear (aparece en "se aplicarán"). Si prefieres otra semántica, cambia el hook derivado sin tocar layout.

**B) G3.b "agrega código" no es una posición nueva ni una publicada modificada.**
Es una **posición existente que recibe un código extra**. La tarjeta debe ser clara sobre cuál es la posición receptora (esa ES una publicada/borrador ya existente) para que no se confunda con G4. Propongo `tone="muted"` + chip "recibe código nuevo" y NO contarla en `publishedModifiedCount` de la sticky (aunque técnicamente toca una publicada). Confirmar.

**C) G2 y G3 con default `apply`: ¿la sticky "Se aplicarán" cambia en vivo si el usuario excluye una tarjeta?**
Sí en mi diseño. Consecuencia: excluir una tarjeta de G2 baja "Se aplicarán" y "Modifican publicadas" en tiempo real. Confirmar que este acoplamiento vivo es deseado (creo que sí — es el punto de la sticky).

**D) Duplicados en archivo (`duplicate_in_file`) cae en G1 con `reason`.**
Merece copy propio dentro de la tarjeta de decisión ("esta fila del archivo aparece dos veces; elige cuál conservar") vs. el flujo estándar "elige contra qué candidata". Para v1 lo trato con el mismo layout master-detail pero con un banner interno de aviso. Si quieres un mini-layout distinto para duplicados, va en el pulido fino de G1.

**E) Grid 2 col en G2/G3/G4.**
Con viewport ≥ lg mostramos 2 columnas; en ≤ md, 1. Impacta densidad. Si prefieres siempre 1 columna (más lectura, menos densidad), lo bajamos — no cambia estructura.

**F) `PositionCard` extraída: ¿bloqueante o paralelo?**
Mi recomendación: **bloqueante** (paso 1 del plan). Sin ella cada grupo re-implementa la tarjeta y pierden coherencia. Si quieres desacoplar, la alternativa es duplicar la tarjeta ahora en el reporte y unificar después — no lo recomiendo.

---

### 8. Fuera de alcance de esta v1

Explícito para no ampliar por accidente:
- Confirmación real de importación (Paso 4 del motor). El botón "Confirmar" queda deshabilitado y visible; su handler es un `TODO`.
- Descarga XLSX de G6 puede quedar como botón deshabilitado si `agreement-export.ts` no cubre el caso — no bloquea el resto.
- Estadísticas de G2 (mediana Δ%, sparklines) — opcional para v1, pulido de G2.
- Diálogo "Ver todas" de G5 cuando >100 filas — opcional; v1 puede renderizar todas ya que G5 es colapsado por default.
- Persistencia de decisiones entre recargas (contrato explícito: no).

---

### 9. Orden de construcción propuesto (cuando pases a build)

1. Extraer `PositionCard` de `lines.tsx` y migrar `lines.tsx` (verificación visual: sin cambios).
2. Andamiaje: `ImportReport`, `StickyDecisionBar`, `GroupShell`, hook de decisiones, labels/reasons compartidos.
3. G5 y G6 (inertes — los más simples, validan `EnrichedRow`).
4. G2 y G3 (default `apply`, validan `PositionCardDiff` y `ChangeChips`).
5. G4 (checkbox + banner, valida `PositionCardNew` con overlay).
6. G1 (master-detail — el más complejo, se apoya en todo lo anterior).
7. Cablear sticky con derivados reales y pulir vacíos/estados edge.

Cada paso deja el reporte funcional (los grupos aún no construidos siguen renderizándose con el fallback simple actual), así se puede auditar en el navegador entre pasos sin romper la vista.