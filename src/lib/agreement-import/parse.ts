// Parser principal. Detecta formato, aplica lecturas con flags correctos,
// resuelve encabezados y devuelve filas tipadas + cellErrors.

import Papa from "papaparse";
import * as XLSX from "xlsx";

import {
  CANONICAL_HEADERS,
  CANONICAL_ORDER,
  matchCanonical,
} from "./headers";
import { parseDate, parsePrice, parseSku, parseText } from "./cells";
import {
  type CellError,
  type ParsedRow,
  type ParseResult,
  type PricingField,
  PricingFileFormatError,
} from "./types";

type RawRow = Record<string, unknown>;

function buildHeaderIndex(headers: string[]): {
  headerByField: Map<PricingField, string>;
  presentColumns: PricingField[];
} {
  const headerByField = new Map<PricingField, string>();
  const seen = new Set<PricingField>();

  for (const raw of headers) {
    if (raw == null) continue;
    const field = matchCanonical(String(raw));
    if (!field) continue;
    if (seen.has(field)) {
      throw new PricingFileFormatError(
        "DUPLICATE_HEADER",
        `El archivo tiene dos columnas para "${CANONICAL_HEADERS[field]}". Deja una sola y vuelve a subirlo.`,
        CANONICAL_HEADERS[field],
      );
    }
    seen.add(field);
    headerByField.set(field, raw);
  }

  if (!headerByField.has("sku")) {
    throw new PricingFileFormatError(
      "MISSING_SKU_HEADER",
      `No encuentro la columna "${CANONICAL_HEADERS.sku}" en el archivo. Descarga la plantilla y ajusta los encabezados antes de volver a subirlo.`,
    );
  }

  const presentColumns = CANONICAL_ORDER.filter((f) => headerByField.has(f));
  return { headerByField, presentColumns };
}

function readXlsx(buf: ArrayBuffer): { headers: string[]; rows: RawRow[] } {
  const wb = XLSX.read(buf, {
    type: "array",
    cellText: true,
    cellDates: true, // fechas como Date nativo cuando la celda tiene formato de fecha
    raw: false,
  });
  const sheetName = wb.SheetNames[0];
  const sheet = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!sheet) return { headers: [], rows: [] };

  // Encabezados desde la primera fila (raw:false = string formateado).
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });
  const headers = ((aoa[0] as unknown[]) ?? []).map((h) => (h == null ? "" : String(h)));

  // Cuerpo con raw:false: SheetJS entrega strings formateados.
  // Protege SKU con ceros a la izquierda ("0083" no colapsa a 83) y evita
  // que las fechas lleguen como Date nativo (que forzaría reinterpretación de huso).
  // defval:"" es consistente con isEmpty() (trata "" como vacío).
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, {
    defval: "",
    raw: false,
    blankrows: false,
  });

  return { headers, rows };
}

async function readCsv(file: File): Promise<{ headers: string[]; rows: RawRow[] }> {
  const text = await file.text();
  const res = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // clave: nunca coercionar (protege SKU y precios)
  });
  const rows = (res.data ?? []).filter((r) => r && typeof r === "object");
  const headers = (res.meta?.fields ?? []).map((h) => (h == null ? "" : String(h)));
  return { headers, rows };
}

function extractCellRaw(
  raw: RawRow,
  headerByField: Map<PricingField, string>,
  field: PricingField,
): unknown {
  const header = headerByField.get(field);
  if (!header) return null;
  const v = raw[header];
  return v === undefined ? null : v;
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  return false;
}

function parseRow(
  raw: RawRow,
  sourceRow: number,
  headerByField: Map<PricingField, string>,
  presentColumns: PricingField[],
): ParsedRow | null {
  const cellErrors: CellError[] = [];
  const out: ParsedRow = {
    sourceRow,
    sku: null,
    client_code: null,
    client_description: null,
    sale_price: null,
    par_price: null,
    start_date: null,
    end_date: null,
    observations: null,
    cellErrors,
  };

  // Contamos "no vacías" solo sobre columnas presentes en el archivo.
  let hasAnyValue = false;

  for (const field of presentColumns) {
    const rawVal = extractCellRaw(raw, headerByField, field);
    if (!isEmpty(rawVal)) hasAnyValue = true;

    switch (field) {
      case "sku":
        out.sku = parseSku(rawVal);
        break;
      case "client_code":
        out.client_code = parseText(rawVal);
        break;
      case "client_description":
        out.client_description = parseText(rawVal);
        break;
      case "observations":
        out.observations = parseText(rawVal);
        break;
      case "sale_price":
      case "par_price": {
        if (isEmpty(rawVal)) break;
        const r = parsePrice(rawVal);
        if (!r.ok) {
          cellErrors.push({ field, reason: "Precio no reconocido" });
        } else {
          if (field === "sale_price") out.sale_price = r.value;
          else out.par_price = r.value;
        }
        break;
      }
      case "start_date":
      case "end_date": {
        if (isEmpty(rawVal)) break;
        const r = parseDate(rawVal);
        if (!r.ok) {
          cellErrors.push({ field, reason: "Fecha no reconocida" });
        } else {
          if (field === "start_date") out.start_date = r.value;
          else out.end_date = r.value;
        }
        break;
      }
    }
  }

  // Fila totalmente vacía Y sin errores → descartar silenciosamente.
  if (!hasAnyValue && cellErrors.length === 0) return null;
  return out;
}

export async function parsePricingFile(file: File): Promise<ParseResult> {
  const name = (file.name || "").toLowerCase();
  let headers: string[];
  let rows: RawRow[];

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    ({ headers, rows } = readXlsx(buf));
  } else if (name.endsWith(".csv")) {
    ({ headers, rows } = await readCsv(file));
  } else {
    throw new PricingFileFormatError(
      "FORMAT_UNSUPPORTED",
      "Formato no soportado. Sube un archivo .xlsx, .xls o .csv.",
    );
  }

  const { headerByField, presentColumns } = buildHeaderIndex(headers);

  const parsed: ParsedRow[] = [];
  rows.forEach((raw, i) => {
    // sourceRow: fila 1 = cabecera; primera fila de datos = 2.
    const row = parseRow(raw, i + 2, headerByField, presentColumns);
    if (row) parsed.push(row);
  });

  return { rows: parsed, presentColumns };
}
