import type { ClassifiedRow } from "@/lib/agreement-import";

/**
 * Header del reporte: 3 métricas sobre el ARCHIVO (hechos, no decisiones).
 */
export function ImportReportHeader({
  totalRows,
  rows,
  activeClientCodes,
}: {
  totalRows: number;
  rows: ClassifiedRow[];
  activeClientCodes: Array<{ client_code: string }>;
}) {
  const codesInFile = new Set<string>();
  for (const r of rows) {
    const c = r.row.client_code?.trim();
    if (c) codesInFile.add(c.toUpperCase());
  }
  const activeSet = new Set(
    activeClientCodes.map((c) => c.client_code.trim().toUpperCase()),
  );
  let unidentified = 0;
  for (const c of codesInFile) if (!activeSet.has(c)) unidentified++;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Metric label="Filas totales" value={totalRows} />
      <Metric label="Códigos Jaivaná únicos" value={codesInFile.size} />
      <Metric
        label="Jaivaná no identificados"
        value={unidentified}
        tone={unidentified > 0 ? "alert" : "muted"}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number;
  tone?: "muted" | "alert";
}) {
  const valueCls =
    tone === "alert" ? "text-primary" : "text-text-primary";
  return (
    <div className="rounded-lg border border-border bg-white px-4 py-3">
      <div className="suma-caption text-text-tertiary">{label}</div>
      <div
        className={"mt-1 tabular-nums text-2xl font-bold " + valueCls}
      >
        {value}
      </div>
    </div>
  );
}
