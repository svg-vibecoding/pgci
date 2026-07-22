import type { ClassifiedRow } from "@/lib/agreement-import";
import { IndicatorCard } from "@/components/setup/IndicatorCard";

/**
 * Header del reporte: 3 métricas sobre el ARCHIVO (hechos, no decisiones).
 * Usa IndicatorCard para unificar con el resto de vistas.
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
      <IndicatorCard label="Filas totales" value={totalRows} />
      <IndicatorCard label="Códigos Jaivaná únicos" value={codesInFile.size} />
      <IndicatorCard
        label="Jaivaná no identificados"
        value={
          <span className={unidentified > 0 ? "text-primary" : undefined}>
            {unidentified}
          </span>
        }
      />
    </div>
  );
}
