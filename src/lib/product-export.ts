import * as XLSX from "xlsx";

export type ExportProduct = {
  id: string;
  sku: string | null;
  erp_description: string | null;
  commercial_description: string | null;
  erp_brand: string | null;
  commercial_brand: string | null;
  brand_reference: string | null;
  product_classification: string | null;
  erp_product_category_n1: string | null;
  erp_product_category_n2: string | null;
  erp_product_category_n3: string | null;
  commercial_unit: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const HEADERS = [
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
  "Acuerdos",
  "Fecha de creación",
  "Última actualización",
];

const statusLabel = (s: string | null): string | null =>
  s === "active" ? "Activo" : s === "inactive" ? "Inactivo" : null;

const fmtDate = (v: string | null): string | null => {
  if (!v || !v.trim()) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es-CO");
};

const v = (s: string | null | undefined): string | null =>
  s && s.trim() ? s : null;

export function exportProductsXlsx(
  rows: ExportProduct[],
  agreementCounts: Map<string, number> | undefined,
  opts: { filtered: boolean },
) {
  const data = rows.map((p) => [
    v(p.sku),
    v(p.erp_description),
    v(p.commercial_description),
    v(p.erp_brand),
    v(p.commercial_brand),
    v(p.brand_reference),
    v(p.product_classification),
    v(p.erp_product_category_n1),
    v(p.erp_product_category_n2),
    v(p.erp_product_category_n3),
    v(p.commercial_unit),
    statusLabel(p.status),
    agreementCounts?.get(p.id) ?? 0,
    fmtDate(p.created_at),
    fmtDate(p.updated_at),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Productos");
  const name = opts.filtered
    ? "productos_pim_pgci_filtrados.xlsx"
    : "productos_pim_pgci.xlsx";
  XLSX.writeFile(wb, name);
}
