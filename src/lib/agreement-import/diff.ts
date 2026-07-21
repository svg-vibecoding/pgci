// Motor de cruce (Paso 2). Función PURA.
//
// INTOCABLES:
//  - NO anticipa conflicto de SKU (no importa sku-conflict.ts ni replica
//    position_has_sku_conflict). El estado post-escritura lo dice la base.
//  - NO calcula pending_reason.
//  - NO consulta base, NO escribe, NO llama RPC.
//  - NO valida rangos de precio.
//  - NO elige ganadora en duplicados; NO auto-selecciona candidatas.
//  - NO reusa el parser ni pim-import.ts; solo consume ParsedRow.

import type { ParsedRow, PricingField } from "./types";
import type {
  AgreementSnapshot,
  Candidate,
  ClassifiedRow,
  ClassifyImportInput,
  DiffGroup,
  DiffResult,
  DiffTotals,
  FieldChange,
  PositionSnapshot,
} from "./diff.types";

// ---------------------------------------------------------------------------
// Normalización de códigos (único punto de comparación)
// ---------------------------------------------------------------------------

function normalizeCode(s: string): string {
  return s.trim().replace(/\s+/g, " ").toUpperCase();
}

// ---------------------------------------------------------------------------
// Índices del snapshot
// ---------------------------------------------------------------------------

type Indexes = {
  positionById: Map<string, PositionSnapshot>;
  positionsBySku: Map<string, PositionSnapshot[]>;
  /** key = `${client_id}::${normalizeCode(client_code)}` */
  positionByActiveCode: Map<string, string>;
  /** Por posición: Map<client_id, código vigente normalizado>. */
  activeCodesByPosition: Map<string, Map<string, string>>;
};

function buildIndexes(snapshot: AgreementSnapshot): Indexes {
  const positionById = new Map<string, PositionSnapshot>();
  const positionsBySku = new Map<string, PositionSnapshot[]>();
  for (const p of snapshot.positions) {
    positionById.set(p.id, p);
    const arr = positionsBySku.get(p.sku);
    if (arr) arr.push(p);
    else positionsBySku.set(p.sku, [p]);
  }
  const positionByActiveCode = new Map<string, string>();
  const activeCodesByPosition = new Map<string, Map<string, string>>();
  for (const c of snapshot.activeClientCodes) {
    const norm = normalizeCode(c.client_code);
    positionByActiveCode.set(`${c.client_id}::${norm}`, c.position_id);
    let sub = activeCodesByPosition.get(c.position_id);
    if (!sub) {
      sub = new Map();
      activeCodesByPosition.set(c.position_id, sub);
    }
    sub.set(c.client_id, norm);
  }
  return { positionById, positionsBySku, positionByActiveCode, activeCodesByPosition };
}

// ---------------------------------------------------------------------------
// Deltas por campo (regla A: solo columnas presentes)
// ---------------------------------------------------------------------------

function computeChanges(
  row: ParsedRow,
  position: PositionSnapshot,
  presentColumns: PricingField[],
  mappedClientId: string | null,
  activeCodesByPosition: Map<string, Map<string, string>>,
): { changes: FieldChange[]; codeReplace: boolean } {
  const changes: FieldChange[] = [];
  let codeReplace = false;

  const present = new Set(presentColumns);

  if (present.has("sale_price") && row.sale_price !== position.sale_price) {
    changes.push({ field: "sale_price", from: position.sale_price, to: row.sale_price });
  }
  if (present.has("par_price") && row.par_price !== position.par_price) {
    changes.push({ field: "par_price", from: position.par_price, to: row.par_price });
  }
  if (present.has("start_date") && row.start_date !== position.start_date) {
    changes.push({ field: "start_date", from: position.start_date, to: row.start_date });
  }
  if (present.has("end_date") && row.end_date !== position.end_date) {
    changes.push({ field: "end_date", from: position.end_date, to: row.end_date });
  }
  if (present.has("observations")) {
    const from = position === position ? (positionObs(position)) : null; // noop, see below
    // observations no está en PositionSnapshot; el snapshot definido no la incluye.
    // El motor no compara observations contra la posición porque el snapshot
    // no la trae. Si en el futuro se agrega, aquí se compara.
    void from;
  }

  // add_client_code / client_code_replace
  if (
    mappedClientId &&
    present.has("client_code") &&
    row.client_code &&
    row.client_code.trim().length > 0
  ) {
    const rowCodeNorm = normalizeCode(row.client_code);
    const codesForPos = activeCodesByPosition.get(position.id);
    const existingForClient = codesForPos?.get(mappedClientId) ?? null;
    if (existingForClient === null) {
      changes.push({
        field: "add_client_code",
        client_id: mappedClientId,
        client_code: row.client_code,
        description: row.client_description,
      });
    } else if (existingForClient !== rowCodeNorm) {
      codeReplace = true;
    }
    // igual → no cambia nada
  }

  return { changes, codeReplace };
}

// observations no vive en PositionSnapshot; helper vacío para futura extensión.
function positionObs(_p: PositionSnapshot): string | null {
  return null;
}

// ---------------------------------------------------------------------------
// Cascada por fila
// ---------------------------------------------------------------------------

type Resolution =
  | { kind: "resolved"; positionId: string; resolvedByCode: boolean }
  | { kind: "candidates"; positionIds: string[] } // caso 3
  | { kind: "code_sku_mismatch"; positionId: string } // caso 4
  | { kind: "not_in_agreement" } // caso 5
  | { kind: "not_in_catalog" } // caso 6
  | { kind: "no_anchor" }; // ni SKU ni código utilizable

function resolveRow(
  row: ParsedRow,
  snapshot: AgreementSnapshot,
  idx: Indexes,
  mappedClientId: string | null,
): Resolution {
  const hasSku = !!row.sku && row.sku.length > 0;
  const canUseCode =
    !!mappedClientId &&
    snapshot.clientIds.has(mappedClientId) &&
    !!row.client_code &&
    row.client_code.trim().length > 0;

  // Paso 1: código vigente
  if (canUseCode) {
    const key = `${mappedClientId}::${normalizeCode(row.client_code!)}`;
    const posId = idx.positionByActiveCode.get(key);
    if (posId) {
      // Paso 4: contradicción código ↔ SKU
      if (hasSku) {
        const pos = idx.positionById.get(posId)!;
        if (pos.sku !== row.sku) {
          return { kind: "code_sku_mismatch", positionId: posId };
        }
      }
      return { kind: "resolved", positionId: posId, resolvedByCode: true };
    }
    // Código no encuentra vigencia: caemos a SKU.
  }

  // Pasos 2/3/5/6 requieren SKU
  if (!hasSku) return { kind: "no_anchor" };

  const positions = idx.positionsBySku.get(row.sku!);
  if (positions && positions.length === 1) {
    return { kind: "resolved", positionId: positions[0].id, resolvedByCode: false };
  }
  if (positions && positions.length > 1) {
    const ids = positions.map((p) => p.id).sort();
    return { kind: "candidates", positionIds: ids };
  }
  // No hay posición con ese SKU.
  if (snapshot.catalogBySku.has(row.sku!)) return { kind: "not_in_agreement" };
  return { kind: "not_in_catalog" };
}

// ---------------------------------------------------------------------------
// Clasificación por fila (primera pasada)
// ---------------------------------------------------------------------------

function classifyOne(
  row: ParsedRow,
  presentColumns: PricingField[],
  snapshot: AgreementSnapshot,
  idx: Indexes,
  mappedClientId: string | null,
): ClassifiedRow {
  // Preludio: cellErrors → not_processable
  if (row.cellErrors && row.cellErrors.length > 0) {
    return {
      sourceRow: row.sourceRow,
      group: "not_processable",
      reason: "row_has_cell_errors",
      row,
    };
  }

  const res = resolveRow(row, snapshot, idx, mappedClientId);

  switch (res.kind) {
    case "not_in_catalog":
      return {
        sourceRow: row.sourceRow,
        group: "not_processable",
        reason: "sku_not_in_catalog",
        row,
      };
    case "no_anchor":
      return {
        sourceRow: row.sourceRow,
        group: "not_processable",
        reason: "no_anchor",
        row,
      };
    case "not_in_agreement":
      return { sourceRow: row.sourceRow, group: "not_in_agreement", row };
    case "candidates": {
      const candidates: Candidate[] = res.positionIds.map((id) => {
        const p = idx.positionById.get(id)!;
        return {
          position_id: p.id,
          status: p.status,
          sale_price: p.sale_price,
          par_price: p.par_price,
          start_date: p.start_date,
          end_date: p.end_date,
        };
      });
      return {
        sourceRow: row.sourceRow,
        group: "requires_decision",
        reason: "sku_in_multiple_positions",
        candidates,
        row,
      };
    }
    case "code_sku_mismatch":
      return {
        sourceRow: row.sourceRow,
        group: "requires_decision",
        reason: "code_sku_mismatch",
        resolvedPositionId: res.positionId,
        row,
      };
    case "resolved": {
      const position = idx.positionById.get(res.positionId)!;
      const { changes, codeReplace } = computeChanges(
        row,
        position,
        presentColumns,
        mappedClientId,
        idx.activeCodesByPosition,
      );

      if (codeReplace) {
        return {
          sourceRow: row.sourceRow,
          group: "requires_decision",
          reason: "client_code_replace",
          resolvedPositionId: position.id,
          changes,
          row,
        };
      }

      if (changes.length === 0) {
        return {
          sourceRow: row.sourceRow,
          group: "unchanged",
          resolvedPositionId: position.id,
          changes: [],
          row,
        };
      }

      const isPublished =
        position.status === "active" ||
        position.status === "requires_review" ||
        position.status === "excluded";

      const onlyAddCode = changes.every((c) => c.field === "add_client_code");

      // Regla B: mayor consecuencia domina.
      // - Publicada + cualquier cambio (incluye solo add_client_code) → grupo 2.
      //   NOTA: "solo agrega código nuevo a cualquier posición" cae en grupo 3
      //   solo cuando no toca campos de la posición publicada.
      // Reinterpretación conservadora del enunciado:
      //   * onlyAddCode → grupo 3 sin importar estado.
      //   * cualquier otro cambio → grupo 2 si publicada, grupo 3 si draft.
      let group: DiffGroup;
      if (onlyAddCode) group = "modifies_draft_or_adds_code";
      else if (isPublished) group = "modifies_published";
      else group = "modifies_draft_or_adds_code";

      return {
        sourceRow: row.sourceRow,
        group,
        resolvedPositionId: position.id,
        changes,
        row,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Duplicados intra-archivo (segunda pasada)
// ---------------------------------------------------------------------------

function changesKey(changes: FieldChange[] | undefined): string {
  if (!changes || changes.length === 0) return "[]";
  // Orden estable por field (+ client_id + client_code para add_client_code).
  const norm = [...changes].sort((a, b) => {
    if (a.field !== b.field) return a.field < b.field ? -1 : 1;
    if (a.field === "add_client_code" && b.field === "add_client_code") {
      const ka = `${a.client_id}::${normalizeCode(a.client_code)}`;
      const kb = `${b.client_id}::${normalizeCode(b.client_code)}`;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    }
    return 0;
  });
  return JSON.stringify(norm);
}

function reclassifyDuplicates(rows: ClassifiedRow[]): void {
  const byPos = new Map<string, ClassifiedRow[]>();
  for (const r of rows) {
    // Solo consideramos filas que resolvieron a UNA posición y ya están
    // en 2/3/5. code_sku_mismatch y client_code_replace ya son grupo 1;
    // los ignoramos aquí (siguen siendo decisiones individuales).
    if (
      (r.group === "modifies_published" ||
        r.group === "modifies_draft_or_adds_code" ||
        r.group === "unchanged") &&
      r.resolvedPositionId
    ) {
      const arr = byPos.get(r.resolvedPositionId);
      if (arr) arr.push(r);
      else byPos.set(r.resolvedPositionId, [r]);
    }
  }
  for (const [, group] of byPos) {
    if (group.length < 2) continue;
    const keys = new Set(group.map((r) => changesKey(r.changes)));
    if (keys.size <= 1) continue; // todas idénticas → no es conflicto
    for (const r of group) {
      r.group = "requires_decision";
      r.reason = "duplicate_in_file";
      // resolvedPositionId y changes se conservan como contexto.
    }
  }
}

// ---------------------------------------------------------------------------
// Punto de entrada
// ---------------------------------------------------------------------------

const EMPTY_TOTALS: DiffTotals = {
  requires_decision: 0,
  modifies_published: 0,
  modifies_draft_or_adds_code: 0,
  not_in_agreement: 0,
  unchanged: 0,
  not_processable: 0,
};

export function classifyImport(input: ClassifyImportInput): DiffResult {
  const { rows, presentColumns, snapshot, mappedClientId } = input;
  const idx = buildIndexes(snapshot);

  const classified: ClassifiedRow[] = rows.map((row) =>
    classifyOne(row, presentColumns, snapshot, idx, mappedClientId),
  );

  reclassifyDuplicates(classified);

  const totals: DiffTotals = { ...EMPTY_TOTALS };
  for (const r of classified) totals[r.group] += 1;

  return { rows: classified, totals };
}
