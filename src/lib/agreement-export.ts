import * as XLSX from "xlsx";

export type ExportAgreementLine = {
  client_code: string | null;
  client_description: string | null;
  sku: string | null;
  erp_description: string | null;
  commercial_brand: string | null;
  sale_price: number | null;
  par_price: number | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  observations: string | null;
};

const HEADERS = [
  "Código del cliente",
  "Descripción del cliente",
  "Código Jaivaná",
  "Descripción Jaivaná",
  "Marca",
  "Precio de venta",
  "Precio par",
  "Fecha inicio",
  "Fecha fin",
  "Estado",
  "Observaciones",
];

const STATUS_LABEL: Record<string, string> = {
  active: "Activa",
  requires_review: "Requiere revisión",
  draft: "En gestión",
  excluded: "Excluida",
  archived: "Archivada",
};

const fmtDate = (v: string | null): string | null => {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es-CO");
};

const v = <T>(value: T | null | undefined): T | null => (value == null ? null : value);

const parseLocalDate = (iso: string | null): Date | null => {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

const coversToday = (
  lineEnd: string | null,
  agreementEnd: string | null,
): boolean => {
  const effective = lineEnd ?? agreementEnd;
  if (!effective) return true;
  const d = parseLocalDate(effective);
  if (!d) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() >= today.getTime();
};

export type AgreementExportPreset = "all" | "active" | "filtered";

const fileNameFor = (
  preset: AgreementExportPreset,
  agreementName: string,
): string => {
  const safe = agreementName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .toLowerCase()
    .slice(0, 60);
  const suffix =
    preset === "active" ? "activas" : preset === "filtered" ? "filtradas" : "todas";
  return `acuerdo_${safe || "posiciones"}_${suffix}.xlsx`;
};

export function exportAgreementLines(
  lines: ExportAgreementLine[],
  opts: {
    preset: AgreementExportPreset;
    agreementName: string;
    agreementEndDate: string | null;
  },
) {
  const data = lines.map((l) => {
    const statusLabel =
      l.status === "active"
        ? coversToday(l.end_date, opts.agreementEndDate)
          ? "Activa"
          : "Vencida"
        : l.status
          ? STATUS_LABEL[l.status] ?? l.status
          : null;
    return [
      v(l.client_code),
      v(l.client_description),
      v(l.sku),
      v(l.erp_description),
      v(l.commercial_brand),
      l.sale_price ?? null,
      l.par_price ?? null,
      fmtDate(l.start_date),
      fmtDate(l.end_date),
      statusLabel,
      v(l.observations),
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Posiciones");
  XLSX.writeFile(wb, fileNameFor(opts.preset, opts.agreementName));
}
