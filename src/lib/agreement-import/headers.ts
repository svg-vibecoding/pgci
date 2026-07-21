// Reconocimiento estricto de encabezados con normalización cosmética
// (trim, colapso de espacios, lowercase, strip diacríticos, strip BOM).
// NO existen sinónimos ni abreviaturas.

import type { PricingField } from "./types";

export const CANONICAL_HEADERS: Record<PricingField, string> = {
  sku: "Código Jaivaná",
  client_code: "Código del cliente",
  client_description: "Descripción del cliente",
  sale_price: "Precio de venta",
  par_price: "Precio par",
  start_date: "Fecha inicio",
  end_date: "Fecha fin",
  observations: "Observaciones",
};

/** Orden canónico estable para presentColumns y para la plantilla. */
export const CANONICAL_ORDER: PricingField[] = [
  "sku",
  "client_code",
  "client_description",
  "sale_price",
  "par_price",
  "start_date",
  "end_date",
  "observations",
];

export function normalizeHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "") // BOM al inicio
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// Mapa precomputado normalizado → campo canónico.
const NORMALIZED_TO_FIELD: Map<string, PricingField> = (() => {
  const m = new Map<string, PricingField>();
  for (const field of CANONICAL_ORDER) {
    m.set(normalizeHeader(CANONICAL_HEADERS[field]), field);
  }
  return m;
})();

export function matchCanonical(header: string): PricingField | null {
  return NORMALIZED_TO_FIELD.get(normalizeHeader(header)) ?? null;
}
