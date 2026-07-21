import type { PricingField } from "@/lib/agreement-import";
import type { NotProcessableReason } from "@/lib/agreement-import/diff.types";
import type { ClassifiedRow } from "@/lib/agreement-import";
import { CANONICAL_HEADERS } from "@/lib/agreement-import";

export const FIELD_LABEL: Record<PricingField, string> = {
  sku: "SKU",
  client_code: "Código cliente",
  client_description: "Descripción cliente",
  sale_price: "Precio venta",
  par_price: "Precio par",
  start_date: "Fecha inicio",
  end_date: "Fecha fin",
  observations: "Observaciones",
};

export function describeRowReason(r: ClassifiedRow): string {
  const errs = r.row.cellErrors;
  if (errs && errs.length > 0) {
    return errs
      .map((e) => `${CANONICAL_HEADERS[e.field]}: ${e.reason.toLowerCase()}`)
      .join(" · ");
  }
  if (r.reason === "sku_not_in_catalog") {
    return "SKU no existe en el catálogo.";
  }
  if (r.reason === "no_anchor") {
    return "La fila no trae SKU ni un código de cliente utilizable.";
  }
  return "Motivo no especificado.";
}

export function reasonKind(r: ClassifiedRow): string {
  if (r.row.cellErrors && r.row.cellErrors.length > 0) {
    // Agrupar por el primer campo con error
    const first = r.row.cellErrors[0].field;
    return FIELD_LABEL[first] ?? "Formato";
  }
  const rn: NotProcessableReason | undefined = r.reason as
    | NotProcessableReason
    | undefined;
  if (rn === "sku_not_in_catalog") return "SKU no está en catálogo";
  if (rn === "no_anchor") return "Sin SKU ni código utilizable";
  return "Otro";
}
