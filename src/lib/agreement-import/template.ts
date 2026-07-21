// Plantilla .xlsx descargable. Columna del SKU (A) forzada a formato TEXTO
// para preservar ceros a la izquierda cuando el usuario teclea "0083".

import * as XLSX from "xlsx";

import { CANONICAL_HEADERS, CANONICAL_ORDER } from "./headers";

const COLUMN_WIDTHS: Record<string, number> = {
  sku: 16,
  client_code: 18,
  client_description: 36,
  sale_price: 14,
  par_price: 14,
  start_date: 12,
  end_date: 12,
  observations: 40,
};

export function downloadPricingTemplate(): void {
  const headers = CANONICAL_ORDER.map((f) => CANONICAL_HEADERS[f]);
  const ws = XLSX.utils.aoa_to_sheet([headers]);

  // Forzar formato TEXTO en la columna A (SKU) para 1000 filas de datos.
  const skuCol = CANONICAL_ORDER.indexOf("sku"); // 0
  for (let r = 1; r <= 1000; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: skuCol });
    ws[addr] = { t: "s", v: "", z: "@" };
  }

  // Actualizar rango total para incluir las celdas pre-inicializadas.
  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: 1000, c: headers.length - 1 },
  });

  ws["!cols"] = CANONICAL_ORDER.map((f) => ({ wch: COLUMN_WIDTHS[f] ?? 16 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Precios");
  XLSX.writeFile(wb, "plantilla_acuerdo.xlsx");
}
