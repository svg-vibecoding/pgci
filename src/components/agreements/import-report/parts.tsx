import type { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Chip } from "@/components/sumatec";
import { formatMoneyCOP } from "@/lib/format";
import type { FieldChange } from "@/lib/agreement-import";
import { FIELD_LABEL } from "./labels";

/**
 * GroupShell — contenedor visual coherente para cada grupo del reporte.
 * Encabezado con título + conteo + hint neutro; cuerpo libre.
 */
export function GroupShell({
  title,
  count,
  hint,
  toolbar,
  children,
  tone = "default",
}: {
  title: string;
  count: number;
  hint?: string;
  toolbar?: ReactNode;
  children: ReactNode;
  tone?: "default" | "muted";
}) {
  return (
    <section
      className={
        "rounded-lg border " +
        (tone === "muted"
          ? "border-border/60 bg-muted/30"
          : "border-border bg-white")
      }
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <h3 className="suma-h4 text-text-primary">
            {title}{" "}
            <span className="text-text-tertiary font-normal">({count})</span>
          </h3>
          {hint && (
            <p className="mt-0.5 suma-caption text-text-tertiary">{hint}</p>
          )}
        </div>
        {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

/**
 * DeltaPrice — actual → nuevo con Δ% solo si actual > 0.
 * Colores: sube = warning, baja = success. Sin juicio en el texto.
 */
export function DeltaPrice({
  from,
  to,
  label,
}: {
  from: number | null;
  to: number | null;
  label: string;
}) {
  const showDelta = from != null && from > 0 && to != null;
  const delta = showDelta ? ((to! - from!) / from!) * 100 : null;
  const up = delta != null && delta > 0;
  const down = delta != null && delta < 0;
  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      <span className="suma-caption text-text-tertiary uppercase tracking-wide">
        {label}
      </span>
      {from != null && from > 0 ? (
        <>
          <span className="tabular-nums text-text-secondary">
            {formatMoneyCOP(from)}
          </span>
          <span className="text-text-tertiary">→</span>
          <span className="tabular-nums font-semibold text-text-primary">
            {formatMoneyCOP(to)}
          </span>
          {delta != null && Math.abs(delta) >= 0.005 && (
            <span
              className={
                "inline-flex items-center gap-0.5 tabular-nums text-xs font-semibold " +
                (up
                  ? "text-warning-strong"
                  : down
                    ? "text-success-strong"
                    : "text-text-tertiary")
              }
            >
              {up && <TrendingUp size={11} strokeWidth={2.5} />}
              {down && <TrendingDown size={11} strokeWidth={2.5} />}
              {delta > 0 ? "+" : ""}
              {delta.toFixed(1)}%
            </span>
          )}
        </>
      ) : (
        <>
          <span className="text-text-tertiary">nuevo:</span>
          <span className="tabular-nums font-semibold text-text-primary">
            {formatMoneyCOP(to)}
          </span>
        </>
      )}
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** ChangesBlock — muestra los cambios `actual → nuevo` de una fila. */
export function ChangesBlock({ changes }: { changes: FieldChange[] }) {
  if (changes.length === 0) return null;
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-2.5 space-y-1.5">
      {changes.map((c, i) => {
        if (c.field === "sale_price" || c.field === "par_price") {
          return (
            <DeltaPrice
              key={i}
              label={FIELD_LABEL[c.field]}
              from={c.from}
              to={c.to}
            />
          );
        }
        if (c.field === "start_date" || c.field === "end_date") {
          return (
            <div key={i} className="flex items-baseline gap-2 flex-wrap">
              <span className="suma-caption text-text-tertiary uppercase tracking-wide">
                {FIELD_LABEL[c.field]}
              </span>
              <span className="tabular-nums text-text-secondary">
                {formatDate(c.from)}
              </span>
              <span className="text-text-tertiary">→</span>
              <span className="tabular-nums font-semibold text-text-primary">
                {formatDate(c.to)}
              </span>
            </div>
          );
        }
        if (c.field === "observations") {
          return (
            <div key={i} className="space-y-0.5">
              <div className="suma-caption text-text-tertiary uppercase tracking-wide">
                {FIELD_LABEL.observations}
              </div>
              <div className="text-xs text-text-secondary line-through">
                {c.from || <em className="not-italic">vacío</em>}
              </div>
              <div className="text-xs text-text-primary">
                {c.to || <em className="text-text-tertiary">vacío</em>}
              </div>
            </div>
          );
        }
        if (c.field === "add_client_code") {
          return (
            <div key={i} className="flex items-baseline gap-2 flex-wrap">
              <span className="suma-caption text-text-tertiary uppercase tracking-wide">
                Nuevo código
              </span>
              <span className="font-mono font-semibold text-foreground">
                {c.client_code}
              </span>
              {c.description && (
                <span className="text-text-secondary">— {c.description}</span>
              )}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

/** Chip tipo-cambio para filtros de G2/G3. */
export function ChangeKindChip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
}) {
  return (
    <span onClick={onClick}>
      <Chip
        color={active ? "accent" : "neutral"}
        variant={active ? "solid" : "outline"}
        size="small"
      >
        {children}
        {count != null && (
          <span className="ml-1 text-[10.5px] opacity-80">({count})</span>
        )}
      </Chip>
    </span>
  );
}

/** Fila enriquecida para grupos INERTES (G5, G6): sin acciones. */
export function EnrichedRow({
  sourceRow,
  sku,
  brand,
  description,
  right,
  extra,
}: {
  sourceRow: number;
  sku: string | null;
  brand?: string | null;
  description?: string | null;
  right?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-border/60 py-2 first:border-t-0 first:pt-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-text-tertiary">Fila {sourceRow}</span>
          {brand && (
            <span className="text-xs font-semibold uppercase tracking-wide text-accent">
              {brand}
            </span>
          )}
          <span className="font-mono text-sm font-semibold text-foreground">
            {sku || "—"}
          </span>
        </div>
        {description && (
          <div className="text-sm text-muted-foreground">{description}</div>
        )}
        {extra}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
