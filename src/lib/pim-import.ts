import Papa from "papaparse";
import * as XLSX from "xlsx";

// Cabeceras visibles del archivo (orden fijo)
export const PIM_HEADERS = [
  "Código Jaivaná",
  "Nombre del producto Jaivaná ERP",
  "Nombre del producto Comercial",
  "Marca Jaivaná ERP",
  "Marca Comercial",
  "Referencia comercial",
  "Clasificación del Producto",
  "Línea Jaivaná ERP",
  "Grupo Jaivaná ERP",
  "Subgrupo Jaivaná ERP",
  "Unidad de medida de ventas comercial",
  "Estado",
] as const;

export type PimRow = {
  sku: string;
  erp_description: string;
  commercial_description: string | null;
  erp_brand: string | null;
  commercial_brand: string | null;
  brand_reference: string | null;
  product_classification: string | null;
  erp_product_category_n1: string | null;
  erp_product_category_n2: string | null;
  erp_product_category_n3: string | null;
  commercial_unit: string | null;
  status: "active" | "inactive";
};

export type ParsedRow = {
  rowNumber: number;
  raw: Record<string, string>;
  data?: PimRow;
  error?: string;
};

function pick(o: Record<string, any>, key: string): string {
  const v = o[key];
  return v == null ? "" : String(v).trim();
}
function nullable(s: string) {
  return s.length === 0 ? null : s;
}
function normalizeStatus(s: string): "active" | "inactive" {
  const v = s.trim().toLowerCase();
  if (v === "inactivo" || v === "inactive") return "inactive";
  return "active";
}

function rowFromRaw(raw: Record<string, string>, rowNumber: number): ParsedRow {
  const sku = pick(raw, "Código Jaivaná");
  const erp_description = pick(raw, "Nombre del producto Jaivaná ERP");
  if (!sku) return { rowNumber, raw, error: "El código Jaivaná es obligatorio." };
  if (!erp_description)
    return { rowNumber, raw, error: "El nombre del producto (Jaivaná ERP) es obligatorio." };
  return {
    rowNumber,
    raw,
    data: {
      sku,
      erp_description,
      commercial_description: nullable(pick(raw, "Nombre del producto Comercial")),
      erp_brand: nullable(pick(raw, "Marca Jaivaná ERP")),
      commercial_brand: nullable(pick(raw, "Marca Comercial")),
      brand_reference: nullable(pick(raw, "Referencia comercial")),
      product_classification: nullable(pick(raw, "Clasificación del Producto")),
      erp_product_category_n1: nullable(pick(raw, "Línea Jaivaná ERP")),
      erp_product_category_n2: nullable(pick(raw, "Grupo Jaivaná ERP")),
      erp_product_category_n3: nullable(pick(raw, "Subgrupo Jaivaná ERP")),
      commercial_unit: nullable(pick(raw, "Unidad de medida de ventas comercial")),
      status: normalizeStatus(pick(raw, "Estado") || "Activo"),
    },
  };
}

export async function parsePimFile(file: File): Promise<ParsedRow[]> {
  const name = file.name.toLowerCase();
  let rows: Record<string, string>[];
  if (name.endsWith(".csv")) {
    const text = await file.text();
    const res = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });
    rows = res.data;
  } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  } else {
    throw new Error("FORMAT");
  }
  return rows.map((r, i) => rowFromRaw(r as Record<string, string>, i + 2));
}

export function downloadPimTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([PIM_HEADERS as unknown as string[]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "PIM");
  XLSX.writeFile(wb, "plantilla_pim.xlsx");
}

export type DiffGroups = {
  toCreate: PimRow[];
  toUpdate: { current: any; next: PimRow }[];
  unchanged: PimRow[];
  errors: ParsedRow[];
  duplicateSkus: string[];
};

const COMPARE_FIELDS: (keyof PimRow)[] = [
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

export function diffAgainstExisting(parsed: ParsedRow[], existing: any[]): DiffGroups {
  const bySku = new Map(existing.map((p) => [p.sku, p]));
  const errors = parsed.filter((p) => p.error);

  const seen = new Map<string, number>();
  parsed
    .filter((p) => p.data)
    .forEach((p) => seen.set(p.data!.sku, (seen.get(p.data!.sku) ?? 0) + 1));
  const duplicateSkus = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);

  const toCreate: PimRow[] = [];
  const toUpdate: { current: any; next: PimRow }[] = [];
  const unchanged: PimRow[] = [];

  for (const p of parsed) {
    if (!p.data) continue;
    const existingRow = bySku.get(p.data.sku);
    if (!existingRow) {
      toCreate.push(p.data);
      continue;
    }
    const changed = COMPARE_FIELDS.some(
      (f) => (existingRow[f] ?? null) !== (p.data![f] ?? null),
    );
    if (changed) toUpdate.push({ current: existingRow, next: p.data });
    else unchanged.push(p.data);
  }
  return { toCreate, toUpdate, unchanged, errors, duplicateSkus };
}
