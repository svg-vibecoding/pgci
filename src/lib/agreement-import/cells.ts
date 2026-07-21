// Parsers puros por celda. Testeables sin librerías de archivo.

import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Texto / SKU
// ---------------------------------------------------------------------------

/** SKU: SIEMPRE texto. Nunca coerción numérica. Ceros a la izquierda se preservan. */
export function parseSku(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length === 0 ? null : s;
}

export function parseText(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length === 0 ? null : s;
}

// ---------------------------------------------------------------------------
// Precio — desambiguación determinista por posición del separador
// ---------------------------------------------------------------------------

export type PriceParse = { value: number | null; ok: boolean };

/**
 * Parsea un precio aceptando es-CO ("1.234.567,50") y en-US ("998,390.70")
 * en la misma pasada. La decisión es POR CELDA (nunca global).
 *
 * Reglas:
 *   1. Strip: quitar "$", espacios, NBSP, y cualquier char que no sea dígito, "." o ",".
 *   2. Ambos separadores → el más a la derecha es decimal; el otro es miles.
 *   3. Un solo separador seguido de EXACTAMENTE 3 dígitos → miles; cualquier otra cantidad → decimal.
 *   4. Sin separadores → Number directo.
 *   5. null/""/undefined → null (celda vacía, sin error).
 *   6. number finito → tal cual, incluye 0.
 *   7. NaN / no finito → ok:false.
 */
export function parsePrice(value: unknown): PriceParse {
  if (value == null) return { value: null, ok: true };

  if (typeof value === "number") {
    return Number.isFinite(value) ? { value, ok: true } : { value: null, ok: false };
  }

  const raw = String(value);
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { value: null, ok: true };

  // Preservar signo si aparece; lo reponemos al final.
  const negative = /^\s*-/.test(trimmed);
  // Strip: dejar solo dígitos, "." y ",".
  const stripped = trimmed.replace(/[^0-9.,]/g, "");
  if (stripped.length === 0) return { value: null, ok: false };

  const lastDot = stripped.lastIndexOf(".");
  const lastComma = stripped.lastIndexOf(",");
  let normalized: string;

  if (lastDot >= 0 && lastComma >= 0) {
    // Ambos separadores: el más a la derecha es decimal.
    if (lastComma > lastDot) {
      // decimal = ","  → quitar "." y cambiar "," por "."
      normalized = stripped.replace(/\./g, "").replace(",", ".");
    } else {
      // decimal = "."  → quitar ","
      normalized = stripped.replace(/,/g, "");
    }
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? "." : ",";
    const idx = lastDot >= 0 ? lastDot : lastComma;
    // Debe haber un único separador. Si aparece más de una vez y son iguales,
    // el separador es forzosamente miles (ej. "1.234.567" o "1,234,567").
    const count = (stripped.match(sep === "." ? /\./g : /,/g) || []).length;
    const tail = stripped.slice(idx + 1);
    const isThousands = count > 1 || /^\d{3}$/.test(tail);
    if (isThousands) {
      normalized = stripped.replace(sep === "." ? /\./g : /,/g, "");
    } else {
      // decimal
      normalized = sep === "," ? stripped.replace(",", ".") : stripped;
    }
  } else {
    normalized = stripped;
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) return { value: null, ok: false };
  return { value: negative ? -n : n, ok: true };
}

// ---------------------------------------------------------------------------
// Fechas — sin corrimiento por huso horario
// ---------------------------------------------------------------------------

export type DateParse = { value: string | null; ok: boolean };

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function pad4(n: number): string {
  return String(n).padStart(4, "0");
}

function isRealDate(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (y < 1900 || y > 9999) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  // Verificación real (año bisiesto etc.) usando UTC para no depender del huso.
  const test = new Date(Date.UTC(y, m - 1, d));
  return (
    test.getUTCFullYear() === y &&
    test.getUTCMonth() === m - 1 &&
    test.getUTCDate() === d
  );
}

function toIso(y: number, m: number, d: number): string {
  return `${pad4(y)}-${pad2(m)}-${pad2(d)}`;
}

/** Convierte un serial de Excel a {y,m,d} usando SheetJS (evita el bug 1900). */
function fromExcelSerial(n: number): { y: number; m: number; d: number } | null {
  if (!Number.isFinite(n)) return null;
  const parsed = XLSX.SSF.parse_date_code(n);
  if (!parsed) return null;
  const { y, m, d } = parsed;
  if (!isRealDate(y, m, d)) return null;
  return { y, m, d };
}

/**
 * Fechas: acepta Date nativo (cellDates:true), serial numérico, ISO,
 * DD/MM/YYYY y DD-MM-YYYY. Ambigüedad día/mes → DD/MM (colombiano).
 * Salida siempre "YYYY-MM-DD" sin corrimiento de huso.
 */
export function parseDate(value: unknown): DateParse {
  if (value == null || value === "") return { value: null, ok: true };

  // Date nativo (viene por cellDates:true). Extraer con SSF a partir del serial
  // equivalente para no depender de getters locales/UTC del entorno.
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return { value: null, ok: false };
    // SheetJS ofrece datenum(): Date → serial de Excel; luego SSF lo desglosa
    // sin huso horario. Fallback a getters UTC si no está disponible.
    const ssf = XLSX.SSF as unknown as {
      parse_date_code: typeof XLSX.SSF.parse_date_code;
    };
    const utilAny = XLSX.utils as unknown as { datenum?: (d: Date) => number };
    if (typeof utilAny.datenum === "function") {
      const serial = utilAny.datenum(value);
      const parts = fromExcelSerial(serial);
      if (parts) return { value: toIso(parts.y, parts.m, parts.d), ok: true };
    }
    // Fallback: getters UTC (SheetJS suele fijar la hora en UTC noon).
    const y = value.getUTCFullYear();
    const m = value.getUTCMonth() + 1;
    const d = value.getUTCDate();
    if (isRealDate(y, m, d)) return { value: toIso(y, m, d), ok: true };
    void ssf;
    return { value: null, ok: false };
  }

  if (typeof value === "number") {
    const parts = fromExcelSerial(value);
    if (parts) return { value: toIso(parts.y, parts.m, parts.d), ok: true };
    return { value: null, ok: false };
  }

  if (typeof value === "string") {
    const s = value.trim();
    if (s.length === 0) return { value: null, ok: true };

    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (iso) {
      const y = Number(iso[1]);
      const m = Number(iso[2]);
      const d = Number(iso[3]);
      if (isRealDate(y, m, d)) return { value: toIso(y, m, d), ok: true };
      return { value: null, ok: false };
    }

    const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
    if (dmy) {
      const d = Number(dmy[1]);
      const m = Number(dmy[2]);
      const y = Number(dmy[3]);
      if (isRealDate(y, m, d)) return { value: toIso(y, m, d), ok: true };
      return { value: null, ok: false };
    }

    return { value: null, ok: false };
  }

  return { value: null, ok: false };
}
