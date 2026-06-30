import Papa from "papaparse";
import * as XLSX from "xlsx";

// Encabezados estándar de la importación de información comercial (spec §7.2).
export const AGREEMENT_IMPORT_HEADERS = [
  "Código Jaivaná",
  "Código del cliente",
  "Descripción del cliente",
  "Precio de venta",
  "Precio par",
  "Fecha inicio",
  "Fecha fin",
  "Observaciones",
] as const;

export type AgreementImportField =
  | "sku"
  | "client_code"
  | "description"
  | "sale_price"
  | "par_price"
  | "start_date"
  | "end_date"
  | "observations";

const HEADER_ALIASES: Record<string, AgreementImportField> = {
  "código jaivaná": "sku",
  "codigo jaivana": "sku",
  sku: "sku",
  "código del cliente": "client_code",
  "codigo del cliente": "client_code",
  "código cliente": "client_code",
  "descripción del cliente": "description",
  "descripcion del cliente": "description",
  "descripción cliente": "description",
  "precio de venta": "sale_price",
  "precio venta": "sale_price",
  "precio par": "par_price",
  "fecha inicio": "start_date",
  "fecha fin": "end_date",
  observaciones: "observations",
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function headerToField(h: string): AgreementImportField | null {
  return HEADER_ALIASES[normalizeHeader(h)] ?? null;
}

export type ParsedImportRow = {
  row_number: number;
  sku: string | null;
  client_code: string | null;
  description: string | null;
  sale_price: number | null;
  par_price: number | null;
  start_date: string | null;
  end_date: string | null;
  observations: string | null;
  format_errors: string[];
};

export type ParsedImportResult = {
  rows: ParsedImportRow[];
  format_errors: ParsedImportRow[];
};

type RawImportRow = Record<string, unknown>;

function parsePrice(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v ?? "")
    .trim()
    .replace(/\$/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function datePartsToIso(year: number, month: number, day: number): string | null {
  if (!isValidDateParts(year, month, day)) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed) return null;
  return datePartsToIso(parsed.y, parsed.m, parsed.d);
}

function rawValueLabel(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  const s = String(v ?? "").trim();
  return s || "vacío";
}

function parseDate(v: unknown): { value: string | null; error?: string } {
  if (v == null) return { value: null };

  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return { value: null, error: `Fecha inválida: ${rawValueLabel(v)}` };
    return { value: datePartsToIso(v.getFullYear(), v.getMonth() + 1, v.getDate()) };
  }

  if (typeof v === "number") {
    const value = excelSerialToIso(v);
    return value ? { value } : { value: null, error: `Fecha inválida: ${rawValueLabel(v)}` };
  }

  const s = String(v).trim();
  if (!s) return { value: null };
  // Formatos aceptados: YYYY-MM-DD y DD/MM/YYYY o DD-MM-YYYY. Siempre día primero.
  const m1 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m1) {
    const value = datePartsToIso(Number(m1[1]), Number(m1[2]), Number(m1[3]));
    return value ? { value } : { value: null, error: `Fecha inválida: ${s}` };
  }
  const m2 = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(s);
  if (m2) {
    const value = datePartsToIso(Number(m2[3]), Number(m2[2]), Number(m2[1]));
    return value ? { value } : { value: null, error: `Fecha inválida: ${s}` };
  }

  const maybeSerial = Number(s);
  if (/^\d+(\.\d+)?$/.test(s)) {
    const value = excelSerialToIso(maybeSerial);
    if (value) return { value };
  }

  return { value: null, error: `Fecha inválida: ${s}` };
}

function valueAt(
  raw: RawImportRow,
  headerByField: Map<AgreementImportField, string>,
  field: AgreementImportField,
): unknown {
  const h = headerByField.get(field);
  if (!h) return "";
  const v = raw[h];
  return typeof v === "string" ? v.trim() : (v ?? "");
}

function buildHeaderIndex(headers: string[]): Map<AgreementImportField, string> {
  const map = new Map<AgreementImportField, string>();
  for (const h of headers) {
    const f = headerToField(h);
    if (f && !map.has(f)) map.set(f, h);
  }
  return map;
}

function rowFromRaw(
  raw: RawImportRow,
  rowNumber: number,
  headerByField: Map<AgreementImportField, string>,
): ParsedImportRow {
  const errors: string[] = [];

  const sku = String(valueAt(raw, headerByField, "sku") || "").trim() || null;
  const client_code = String(valueAt(raw, headerByField, "client_code") || "").trim() || null;
  const description = String(valueAt(raw, headerByField, "description") || "").trim() || null;
  const observations = String(valueAt(raw, headerByField, "observations") || "").trim() || null;

  const saleRaw = valueAt(raw, headerByField, "sale_price");
  let sale_price: number | null = null;
  if (saleRaw) {
    sale_price = parsePrice(saleRaw);
    if (sale_price === null) errors.push("Precio de venta inválido");
  }
  const parRaw = valueAt(raw, headerByField, "par_price");
  let par_price: number | null = null;
  if (parRaw) {
    par_price = parsePrice(parRaw);
    if (par_price === null) errors.push("Precio par inválido");
  }

  const startRes = parseDate(valueAt(raw, headerByField, "start_date"));
  if (startRes.error) errors.push(startRes.error);
  const endRes = parseDate(valueAt(raw, headerByField, "end_date"));
  if (endRes.error) errors.push(endRes.error);

  return {
    row_number: rowNumber,
    sku,
    client_code,
    description,
    sale_price,
    par_price,
    start_date: startRes.value,
    end_date: endRes.value,
    observations,
    format_errors: errors,
  };
}

export async function parseAgreementFile(file: File): Promise<ParsedImportResult> {
  const name = file.name.toLowerCase();
  let rawRows: RawImportRow[] = [];
  let headers: string[] = [];

  if (name.endsWith(".csv")) {
    const text = await file.text();
    const res = Papa.parse<RawImportRow>(text, {
      header: true,
      skipEmptyLines: true,
    });
    rawRows = res.data ?? [];
    headers = (res.meta?.fields ?? []).map((h) => String(h));
  } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellText: false, cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (sheet) {
      const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        defval: "",
        raw: true,
      });
      headers = (aoa[0] ?? []).map((h) => String(h ?? ""));
      rawRows = XLSX.utils.sheet_to_json<RawImportRow>(sheet, {
        defval: "",
        raw: true,
      });
    }
  } else {
    throw new Error("FORMAT");
  }

  const headerByField = buildHeaderIndex(headers);
  if (headerByField.size === 0) throw new Error("FORMAT");

  const rows: ParsedImportRow[] = [];
  const format_errors: ParsedImportRow[] = [];
  rawRows.forEach((r, i) => {
    const parsed = rowFromRaw(r, i + 2, headerByField);
    // Fila completamente vacía: se ignora
    const allEmpty =
      !parsed.sku &&
      !parsed.client_code &&
      !parsed.description &&
      parsed.sale_price === null &&
      parsed.par_price === null &&
      !parsed.start_date &&
      !parsed.end_date &&
      !parsed.observations;
    if (allEmpty) return;
    if (parsed.format_errors.length > 0) format_errors.push(parsed);
    else rows.push(parsed);
  });

  return { rows, format_errors };
}

export function downloadAgreementImportTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([AGREEMENT_IMPORT_HEADERS as unknown as string[]]);
  // Forzar texto en la columna del SKU.
  for (let r = 1; r <= 1000; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: 0 });
    ws[addr] = { t: "s", v: "", z: "@" };
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Información comercial");
  XLSX.writeFile(wb, "plantilla_acuerdo.xlsx");
}

// ---------------------------------------------------------------------------
// Tipos compartidos con la UI / server fn
// ---------------------------------------------------------------------------

export type ImportPendingReason = "no_sku" | "no_price" | "no_dates";

export const PENDING_REASON_LABELS: Record<ImportPendingReason, string> = {
  no_sku: "Sin SKU Jaivaná",
  no_price: "Sin precio",
  no_dates: "Sin vigencia",
};
