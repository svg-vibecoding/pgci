import Papa from "papaparse";
import * as XLSX from "xlsx";

// ----------------------------------------------------------------------------
// Encabezados estándar del spec PGCI_03.12_Productos_V1
// La plantilla descargable usa SIEMPRE estos encabezados.
// ----------------------------------------------------------------------------
export const PIM_HEADERS = [
  "Código Jaivaná",
  "Descripción Jaivaná",
  "Descripción comercial",
  "Marca Jaivaná",
  "Marca",
  "Referencia",
  "Clasificación",
  "Línea",
  "Grupo",
  "Subgrupo",
  "Unidad",
  "Estado",
] as const;

export type PimField =
  | "sku"
  | "erp_description"
  | "commercial_description"
  | "erp_brand"
  | "commercial_brand"
  | "brand_reference"
  | "product_classification"
  | "erp_product_category_n1"
  | "erp_product_category_n2"
  | "erp_product_category_n3"
  | "commercial_unit"
  | "status";

// Alias header → campo técnico. Incluye encabezados antiguos por compatibilidad.
const HEADER_ALIASES: Record<string, PimField> = {
  // Estándar nuevo
  "código jaivaná": "sku",
  "descripción jaivaná": "erp_description",
  "descripción comercial": "commercial_description",
  "marca jaivaná": "erp_brand",
  marca: "commercial_brand",
  referencia: "brand_reference",
  clasificación: "product_classification",
  línea: "erp_product_category_n1",
  grupo: "erp_product_category_n2",
  subgrupo: "erp_product_category_n3",
  unidad: "commercial_unit",
  estado: "status",
  // Compatibilidad con encabezados antiguos del repo
  "nombre del producto jaivaná erp": "erp_description",
  "nombre del producto comercial": "commercial_description",
  "marca jaivaná erp": "erp_brand",
  "marca comercial": "commercial_brand",
  "referencia comercial": "brand_reference",
  "clasificación del producto": "product_classification",
  "línea jaivaná erp": "erp_product_category_n1",
  "grupo jaivaná erp": "erp_product_category_n2",
  "subgrupo jaivaná erp": "erp_product_category_n3",
  "unidad de medida de ventas comercial": "commercial_unit",
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function headerToField(h: string): PimField | null {
  return HEADER_ALIASES[normalizeHeader(h)] ?? null;
}

// ----------------------------------------------------------------------------
// Tipos
// ----------------------------------------------------------------------------

export type PimRow = {
  sku: string;
  erp_description: string;
  commercial_description: string | null;
  erp_brand: string | null;
  commercial_brand: string;
  brand_reference: string | null;
  product_classification: string | null;
  erp_product_category_n1: string | null;
  erp_product_category_n2: string | null;
  erp_product_category_n3: string | null;
  commercial_unit: string | null;
  status: "active" | "inactive";
};

export type RowErrorField = PimField | "file";

export type RowError = {
  rowNumber: number;
  field: RowErrorField;
  error: string;
};

export type ParsedRow = {
  rowNumber: number;
  raw: Record<string, string>;
  sku: string; // SKU crudo, aunque la fila sea inválida (para detectar duplicados)
  data?: PimRow;
  errors: RowError[];
};

export type ParseResult = {
  rows: ParsedRow[];
  presentColumns: PimField[]; // array tipado, ordenado y estable para React
};

export type DuplicateSku = { sku: string; rows: number[] };

export type DiffGroups = {
  toCreate: PimRow[];
  toUpdate: {
    current: Record<string, unknown>;
    next: PimRow;
    changedFields: PimField[];
  }[];
  unchanged: PimRow[];
  errors: ParsedRow[];
  duplicateSkus: DuplicateSku[];
  presentColumns: PimField[];
};

// ----------------------------------------------------------------------------
// Helpers de extracción
// ----------------------------------------------------------------------------

function valueByField(
  raw: Record<string, string>,
  headerByField: Map<PimField, string>,
  field: PimField,
): string {
  const header = headerByField.get(field);
  if (!header) return "";
  const v = raw[header];
  if (v == null) return "";
  return String(v).trim();
}

function nullable(s: string): string | null {
  return s.length === 0 ? null : s;
}

function normalizeStatus(s: string): "active" | "inactive" | null {
  const v = s.trim().toLowerCase();
  if (v === "activo" || v === "active") return "active";
  if (v === "inactivo" || v === "inactive") return "inactive";
  return null;
}

function rowFromRaw(
  raw: Record<string, string>,
  rowNumber: number,
  headerByField: Map<PimField, string>,
): ParsedRow {
  const sku = valueByField(raw, headerByField, "sku");
  const erp_description = valueByField(raw, headerByField, "erp_description");
  const commercial_brand = valueByField(raw, headerByField, "commercial_brand");
  const statusRaw = valueByField(raw, headerByField, "status");
  const status = normalizeStatus(statusRaw);

  const errors: RowError[] = [];
  if (!sku) {
    errors.push({ rowNumber, field: "sku", error: "El código Jaivaná es obligatorio." });
  }
  if (!erp_description) {
    errors.push({
      rowNumber,
      field: "erp_description",
      error: "La descripción Jaivaná es obligatoria.",
    });
  }
  if (!commercial_brand) {
    errors.push({
      rowNumber,
      field: "commercial_brand",
      error: "La marca es obligatoria.",
    });
  }
  if (!statusRaw) {
    errors.push({ rowNumber, field: "status", error: "El estado es obligatorio." });
  } else if (status === null) {
    errors.push({
      rowNumber,
      field: "status",
      error: "El estado debe ser Activo o Inactivo.",
    });
  }

  if (errors.length > 0) {
    return { rowNumber, raw, sku, errors };
  }

  return {
    rowNumber,
    raw,
    sku,
    errors: [],
    data: {
      sku,
      erp_description,
      commercial_description: nullable(
        valueByField(raw, headerByField, "commercial_description"),
      ),
      erp_brand: nullable(valueByField(raw, headerByField, "erp_brand")),
      commercial_brand,
      brand_reference: nullable(valueByField(raw, headerByField, "brand_reference")),
      product_classification: nullable(
        valueByField(raw, headerByField, "product_classification"),
      ),
      erp_product_category_n1: nullable(
        valueByField(raw, headerByField, "erp_product_category_n1"),
      ),
      erp_product_category_n2: nullable(
        valueByField(raw, headerByField, "erp_product_category_n2"),
      ),
      erp_product_category_n3: nullable(
        valueByField(raw, headerByField, "erp_product_category_n3"),
      ),
      commercial_unit: nullable(valueByField(raw, headerByField, "commercial_unit")),
      status: status as "active" | "inactive",
    },
  };
}

function buildHeaderIndex(headers: string[]): {
  headerByField: Map<PimField, string>;
  presentColumns: PimField[];
} {
  const headerByField = new Map<PimField, string>();
  for (const h of headers) {
    const field = headerToField(h);
    if (field && !headerByField.has(field)) {
      headerByField.set(field, h);
    }
  }
  // Mantiene el orden canónico de PimField y deduplica.
  const canonical: PimField[] = [
    "sku",
    "erp_description",
    "commercial_description",
    "erp_brand",
    "commercial_brand",
    "brand_reference",
    "product_classification",
    "erp_product_category_n1",
    "erp_product_category_n2",
    "erp_product_category_n3",
    "commercial_unit",
    "status",
  ];
  const presentColumns = canonical.filter((f) => headerByField.has(f));
  return { headerByField, presentColumns };
}

// ----------------------------------------------------------------------------
// Parser principal
// ----------------------------------------------------------------------------

export async function parsePimFile(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase();
  let rawRows: Record<string, string>[];
  let headers: string[] = [];

  if (name.endsWith(".csv")) {
    const text = await file.text();
    const res = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      // dynamicTyping debe permanecer false (default) para no coercionar SKU a número.
    });
    rawRows = res.data ?? [];
    headers = (res.meta?.fields ?? []).map((h) => String(h));
  } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    // raw:false ya devuelve cadenas formateadas; cellText:true refuerza el texto.
    const wb = XLSX.read(buf, { type: "array", cellText: true, cellDates: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) {
      rawRows = [];
    } else {
      // Encabezados a partir de la primera fila
      const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        defval: "",
        raw: false,
      });
      headers = (aoa[0] ?? []).map((h) => String(h ?? ""));
      rawRows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
        defval: "",
        raw: false,
      });
    }
  } else {
    throw new Error("FORMAT");
  }

  const { headerByField, presentColumns } = buildHeaderIndex(headers);

  // Si no se reconoce el SKU, el archivo no tiene formato PIM.
  if (!headerByField.has("sku")) {
    throw new Error("FORMAT");
  }

  const rows = rawRows.map((r, i) => rowFromRaw(r, i + 2, headerByField));
  return { rows, presentColumns };
}

// ----------------------------------------------------------------------------
// Plantilla
// ----------------------------------------------------------------------------

export function downloadPimTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([PIM_HEADERS as unknown as string[]]);
  // Forzar formato texto en la columna del SKU para preservar ceros a la izquierda.
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let r = range.s.r + 1; r <= 1000; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: 0 });
    ws[addr] = { t: "s", v: "", z: "@" };
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "PIM");
  XLSX.writeFile(wb, "plantilla_pim.xlsx");
}

// ----------------------------------------------------------------------------
// Diff contra productos existentes
// ----------------------------------------------------------------------------

// Campos opcionales que sólo se comparan si la columna estuvo presente en el archivo.
const OPTIONAL_FIELDS: PimField[] = [
  "commercial_description",
  "erp_brand",
  "brand_reference",
  "product_classification",
  "erp_product_category_n1",
  "erp_product_category_n2",
  "erp_product_category_n3",
  "commercial_unit",
];

// Campos obligatorios que siempre cuentan en el diff (status incluido).
const REQUIRED_DIFF_FIELDS: PimField[] = [
  "erp_description",
  "commercial_brand",
  "status",
];

function normalizeForCompare(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v);
  return s.length === 0 ? null : s;
}

export function diffAgainstExisting(
  parsed: ParsedRow[],
  existing: Array<Record<string, unknown>>,
  presentColumns: PimField[],
): DiffGroups {
  const bySku = new Map(existing.map((p) => [String(p.sku), p]));
  const errors = parsed.filter((p) => p.errors.length > 0);

  // Duplicados: usar TODAS las filas con SKU no vacío, no sólo filas válidas.
  const skuRowMap = new Map<string, number[]>();
  for (const p of parsed) {
    if (!p.sku) continue;
    const arr = skuRowMap.get(p.sku) ?? [];
    arr.push(p.rowNumber);
    skuRowMap.set(p.sku, arr);
  }
  const duplicateSkus: DuplicateSku[] = [];
  for (const [sku, rows] of skuRowMap) {
    if (rows.length > 1) duplicateSkus.push({ sku, rows: [...rows].sort((a, b) => a - b) });
  }
  duplicateSkus.sort((a, b) => a.sku.localeCompare(b.sku));

  const presentSet = new Set<PimField>(presentColumns);
  const compareFields: PimField[] = [
    ...REQUIRED_DIFF_FIELDS,
    ...OPTIONAL_FIELDS.filter((f) => presentSet.has(f)),
  ];

  const toCreate: PimRow[] = [];
  const toUpdate: DiffGroups["toUpdate"] = [];
  const unchanged: PimRow[] = [];

  for (const p of parsed) {
    if (!p.data) continue;
    const existingRow = bySku.get(p.data.sku);
    if (!existingRow) {
      toCreate.push(p.data);
      continue;
    }
    const changedFields: PimField[] = [];
    for (const f of compareFields) {
      const before = normalizeForCompare(existingRow[f]);
      const after = normalizeForCompare(p.data[f]);
      if (before !== after) changedFields.push(f);
    }
    if (changedFields.length > 0) toUpdate.push({ current: existingRow, next: p.data, changedFields });
    else unchanged.push(p.data);
  }

  return { toCreate, toUpdate, unchanged, errors, duplicateSkus, presentColumns };
}

// ----------------------------------------------------------------------------
// Payloads para upsert: solo columnas presentes + obligatorias.
// Esto evita pisar campos opcionales ausentes en el archivo.
// ----------------------------------------------------------------------------

export function buildUpsertPayload(
  row: PimRow,
  presentColumns: PimField[],
): Partial<PimRow> & { sku: string } {
  const presentSet = new Set<PimField>(presentColumns);
  const payload: Record<string, unknown> = {
    sku: row.sku,
    erp_description: row.erp_description,
    commercial_brand: row.commercial_brand,
    status: row.status,
  };
  for (const f of OPTIONAL_FIELDS) {
    if (presentSet.has(f)) payload[f] = row[f];
  }
  return payload as Partial<PimRow> & { sku: string };
}

// ----------------------------------------------------------------------------
// Etiquetas UI y derivaciones puras del diff (para previsualización)
// ----------------------------------------------------------------------------

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
  if (field === "status") {
    if (value === "active") return "Activo";
    if (value === "inactive") return "Inactivo";
  }
  return String(value);
}

export type Inactivation = { sku: string; erp_description: string };

export function getInactivations(diff: DiffGroups): Inactivation[] {
  const out: Inactivation[] = [];
  for (const u of diff.toUpdate) {
    if (u.current.status === "active" && u.next.status === "inactive") {
      out.push({ sku: u.next.sku, erp_description: u.next.erp_description });
    }
  }
  return out;
}

export type ClearedField = {
  sku: string;
  field: PimField;
  before: string;
};

export function getClearedFields(diff: DiffGroups): ClearedField[] {
  const presentSet = new Set<PimField>(diff.presentColumns);
  const out: ClearedField[] = [];
  for (const u of diff.toUpdate) {
    for (const f of OPTIONAL_FIELDS) {
      if (!presentSet.has(f)) continue;
      const before = u.current[f];
      const after = u.next[f];
      const beforeStr = before === null || before === undefined ? "" : String(before);
      if (after === null && beforeStr.length > 0) {
        out.push({ sku: u.next.sku, field: f, before: beforeStr });
      }
    }
  }
  return out;
}

