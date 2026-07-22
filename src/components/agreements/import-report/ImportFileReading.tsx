import type { ClassifiedRow, ParsedRow, PricingField } from "@/lib/agreement-import";
import { CANONICAL_HEADERS, CANONICAL_ORDER } from "@/lib/agreement-import";
import { Chip } from "@/components/sumatec";
import { ImportReportHeader } from "./ImportReportHeader";

/**
 * Card 2 — "Lectura del archivo".
 * Muestra HECHOS previos a la clasificación:
 *  - 3 métricas del archivo (filas, códigos únicos, no identificados).
 *  - Columnas mapeadas con conteo de valores no vacíos (N / total).
 *  - Columnas del archivo que no se usan (transparencia).
 */
export function ImportFileReading({
  totalRows,
  rows,
  presentColumns,
  ignoredColumns,
  classifiedRows,
  activeClientCodes,
}: {
  totalRows: number;
  rows: ParsedRow[];
  presentColumns: PricingField[];
  ignoredColumns: string[];
  classifiedRows: ClassifiedRow[];
  activeClientCodes: Array<{ client_code: string }>;
}) {
  return (
    <div className="space-y-5">
      <ImportReportHeader
        totalRows={totalRows}
        rows={classifiedRows}
        activeClientCodes={activeClientCodes}
      />

      <MappedColumns
        rows={rows}
        presentColumns={presentColumns}
        totalRows={totalRows}
      />

      <IgnoredColumns headers={ignoredColumns} />
    </div>
  );
}

function countNonEmpty(rows: ParsedRow[], field: PricingField): number {
  let n = 0;
  for (const r of rows) {
    const v = r[field];
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.trim().length === 0) continue;
    n++;
  }
  return n;
}

function MappedColumns({
  rows,
  presentColumns,
  totalRows,
}: {
  rows: ParsedRow[];
  presentColumns: PricingField[];
  totalRows: number;
}) {
  // Mostrar en orden canónico, solo las presentes.
  const ordered = CANONICAL_ORDER.filter((f) => presentColumns.includes(f));

  return (
    <section className="space-y-2">
      <h3 className="suma-body font-semibold text-text-primary">
        Columnas mapeadas
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {ordered.map((field) => {
          const n = countNonEmpty(rows, field);
          const partial = totalRows > 0 && n < totalRows;
          const wrapperCls =
            "rounded-lg border border-border bg-white px-3 py-2 " +
            (partial ? "border-l-4 border-l-accent" : "");
          return (
            <div key={field} className={wrapperCls}>
              <div className="suma-caption text-text-tertiary">
                {CANONICAL_HEADERS[field]}
              </div>
              <div className="mt-0.5 suma-body font-semibold tabular-nums text-text-primary">
                {n}{" "}
                <span className="font-normal text-text-tertiary">
                  / {totalRows}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function IgnoredColumns({ headers }: { headers: string[] }) {
  return (
    <section className="space-y-2">
      <h3 className="suma-body font-semibold text-text-primary">
        Columnas del archivo que no se usan
      </h3>
      {headers.length === 0 ? (
        <p className="suma-caption text-text-tertiary">
          No hay columnas adicionales: el archivo trae solo columnas que PGCI
          reconoce.
        </p>
      ) : (
        <>
          <p className="suma-caption text-text-tertiary">
            Estos encabezados vinieron en el archivo pero no corresponden a
            campos que PGCI lee en este paso. No afectan la clasificación.
          </p>
          <div className="flex flex-wrap gap-2">
            {headers.map((h) => (
              <Chip key={h} variant="outline" color="neutral">
                {h}
              </Chip>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
