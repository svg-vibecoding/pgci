import type { ClassifiedRow, ParsedRow, PricingField } from "@/lib/agreement-import";
import { CANONICAL_HEADERS, CANONICAL_ORDER } from "@/lib/agreement-import";
import { ImportReportHeader } from "./ImportReportHeader";

/**
 * Card 2 — "Lectura del archivo".
 * Muestra HECHOS previos a la clasificación:
 *  - 3 métricas del archivo (via IndicatorCard, unificado con el resto).
 *  - Columnas mapeadas: grid liviano sin bordes, con anillo de progreso
 *    (N/total) en la esquina superior derecha.
 *  - Columnas del archivo que no se usan: texto plano separado por "/", off.
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
    <div className="space-y-6">
      <section className="space-y-1.5">
        <ImportReportHeader
          totalRows={totalRows}
          rows={classifiedRows}
          activeClientCodes={activeClientCodes}
        />
      </section>

      <MappedColumns
        rows={rows}
        presentColumns={presentColumns}
        totalRows={totalRows}
      />

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
  const ordered = CANONICAL_ORDER.filter((f) => presentColumns.includes(f));

  return (
    <section className="space-y-1.5">
      <h3 className="suma-subtitle text-text-primary">Columnas mapeadas</h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-2 sm:grid-cols-3 lg:grid-cols-4">
        {ordered.map((field) => {
          const n = countNonEmpty(rows, field);
          return (
            <MappedColumnItem
              key={field}
              label={CANONICAL_HEADERS[field]}
              value={n}
              total={totalRows}
            />
          );
        })}
      </div>
    </section>
  );
}

function MappedColumnItem({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const ratio = total > 0 ? value / total : 0;
  return (
    <div className="relative pr-10">
      <div className="suma-body text-text-secondary">{label}</div>
      <div className="mt-0.5 suma-subtitle tabular-nums text-text-primary">
        {value}
        <span className="font-normal text-text-tertiary"> / {total}</span>
      </div>
      <ProgressRing ratio={ratio} className="absolute right-0 top-1/2 -translate-y-1/2" />
    </div>
  );
}

function ProgressRing({
  ratio,
  className,
}: {
  ratio: number;
  className?: string;
}) {
  const size = 28;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, ratio));
  const offset = c * (1 - clamped);

  const isEmpty = clamped === 0;
  const isFull = clamped === 1;
  const trackColor = "var(--gray-100)";
  const progressColor = isEmpty
    ? "var(--gray-200)"
    : isFull
      ? "var(--success-strong)"
      : "var(--color-accent)";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={trackColor}
        strokeWidth={stroke}
      />
      {!isEmpty && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={progressColor}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
    </svg>
  );
}

function IgnoredColumns({ headers }: { headers: string[] }) {
  return (
    <section className="space-y-1.5">
      <h3 className="suma-subtitle text-text-primary">
        Columnas del archivo que no se usan
      </h3>
      {headers.length === 0 ? (
        <p className="suma-body text-text-secondary">
          No hay columnas adicionales: el archivo trae solo columnas que PGCI
          reconoce.
        </p>
      ) : (
        <>
          <p className="suma-body text-text-secondary">
            Estos encabezados vinieron en el archivo pero no corresponden a
            campos que PGCI lee en este paso. No afectan la clasificación.
          </p>
          <p className="suma-body text-text-tertiary">
            {headers.join("  /  ")}
          </p>
        </>
      )}
    </section>
  );
}
