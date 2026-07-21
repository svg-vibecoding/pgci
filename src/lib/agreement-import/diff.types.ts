// Tipos del motor de cruce (Paso 2). Client-safe.
// El motor NO consulta la base, NO escribe, NO calcula conflictos de SKU
// ni pending_reason. Solo clasifica filas parseadas en 6 grupos.

import type { ParsedRow, PricingField } from "./types";

// ---------------------------------------------------------------------------
// Snapshot de entrada (lo arma la orquestación; el motor solo lo consume)
// ---------------------------------------------------------------------------

export type DiffPositionStatus =
  | "active"
  | "requires_review"
  | "excluded"
  | "draft";

export type PositionSnapshot = {
  id: string;
  product_id: string;
  /** SKU del producto vinculado, denormalizado para comparación por SKU. */
  sku: string;
  status: DiffPositionStatus;
  sale_price: number | null;
  par_price: number | null;
  /** ISO YYYY-MM-DD. */
  start_date: string | null;
  /** ISO YYYY-MM-DD. */
  end_date: string | null;
};

/** Un código vigente (valid_until IS NULL) del acuerdo. */
export type ActiveClientCodeSnapshot = {
  position_id: string;
  client_id: string;
  /** Código tal cual está en la base; el motor lo normaliza al indexar. */
  client_code: string;
};

export type CatalogProduct = {
  product_id: string;
  sku: string;
  /** Se conserva por si downstream lo quiere leer; el motor no lo usa. */
  status: string;
};

export type AgreementSnapshot = {
  positions: PositionSnapshot[];
  activeClientCodes: ActiveClientCodeSnapshot[];
  /**
   * Catálogo acotado a los SKUs que aparecen en el archivo. La orquestación
   * hace la consulta; el motor solo lee.
   */
  catalogBySku: Map<string, CatalogProduct>;
  /** Empresas vigentes del acuerdo. */
  clientIds: Set<string>;
};

// ---------------------------------------------------------------------------
// Salida
// ---------------------------------------------------------------------------

export type DiffGroup =
  | "requires_decision"           // 1
  | "modifies_published"          // 2
  | "modifies_draft_or_adds_code" // 3
  | "not_in_agreement"            // 4
  | "unchanged"                   // 5
  | "not_processable";            // 6

export type FieldChange =
  | { field: "sale_price" | "par_price"; from: number | null; to: number | null }
  | { field: "start_date" | "end_date"; from: string | null; to: string | null }
  | { field: "observations"; from: string | null; to: string | null }
  | {
      field: "add_client_code";
      client_id: string;
      client_code: string;
      description: string | null;
    };

export type Candidate = {
  position_id: string;
  status: DiffPositionStatus;
  sale_price: number | null;
  par_price: number | null;
  start_date: string | null;
  end_date: string | null;
};

export type DecisionReason =
  | "sku_in_multiple_positions"
  | "code_sku_mismatch"
  | "client_code_replace"
  | "duplicate_in_file";

export type NotProcessableReason =
  | "row_has_cell_errors"
  | "sku_not_in_catalog"
  | "no_anchor"; // fila sin SKU y sin código utilizable

export type ClassifiedRow = {
  sourceRow: number;
  group: DiffGroup;
  /** Grupos 2, 3, 5. En grupo 1 sólo si es duplicate_in_file o client_code_replace o code_sku_mismatch resuelto por código. */
  resolvedPositionId?: string;
  /** Solo en caso 3 (sku_in_multiple_positions). Orden estable por position_id. */
  candidates?: Candidate[];
  /**
   * Grupos 2, 3, 5 y también duplicate_in_file: TODOS los cambios que trae
   * la fila (regla B). En caso 3 NO se emite (la UI compara contra la
   * candidata que la persona elija).
   */
  changes?: FieldChange[];
  reason?: DecisionReason | NotProcessableReason;
  row: ParsedRow;
};

export type DiffTotals = Record<DiffGroup, number>;

export type DiffResult = {
  rows: ClassifiedRow[];
  totals: DiffTotals;
};

export type ClassifyImportInput = {
  rows: ParsedRow[];
  presentColumns: PricingField[];
  snapshot: AgreementSnapshot;
  /**
   * Cliente al que pertenecen los códigos del archivo (RN-IMP-09: un archivo
   * = un cliente). null = archivo sin columna de códigos o mono-cliente sin
   * mapear; el motor NO usa códigos para resolver y va directo por SKU.
   */
  mappedClientId: string | null;
};
