import type { PricingField } from "@/lib/agreement-import";
import type { NotProcessableReason } from "@/lib/agreement-import/diff.types";
import type { ClassifiedRow } from "@/lib/agreement-import";
import { CANONICAL_HEADERS } from "@/lib/agreement-import";
import type { StatusBadgeStatus } from "@/components/sumatec";

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

const STATUS_TABLE: Record<
  string,
  { badge: StatusBadgeStatus; label: string }
> = {
  active: { badge: "active", label: "Activa" },
  requires_review: { badge: "review", label: "En revisión" },
  excluded: { badge: "danger", label: "Excluida" },
  draft: { badge: "pending", label: "Borrador" },
};

export function statusMeta(s: string | null | undefined): {
  badge: StatusBadgeStatus;
  label: string;
} {
  if (!s) return { badge: "neutral", label: "—" };
  return STATUS_TABLE[s] ?? { badge: "neutral", label: s };
}

export const DECISION_REASON_LABEL: Record<string, string> = {
  sku_in_multiple_positions: "SKU en múltiples posiciones",
  code_sku_mismatch: "Código y SKU no coinciden",
  client_code_replace: "El código cliente ya está en otra posición",
  duplicate_in_file: "Duplicado en el archivo",
};
