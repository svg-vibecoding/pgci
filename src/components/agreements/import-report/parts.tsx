import type { ReactNode } from "react";
import { ChevronDown, TrendingDown, TrendingUp } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Chip, StatusBadge } from "@/components/sumatec";
import { formatMoneyCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FieldChange } from "@/lib/agreement-import";
import { FIELD_LABEL, statusMeta } from "./labels";

/**
 * GroupShell — acordeón uniforme para cada grupo del reporte.
 * Colapsado por defecto. Fila limpia: (icono) + título + conteo + chevron.
 * hint y toolbar se muestran dentro del cuerpo al abrir, para no competir
 * con el clic del acordeón.
 */
export function GroupShell({
  id,
  icon,
  title,
  count,
  hint,
  toolbar,
  children,
  tone = "default",
  headerRight,
}: {
  id?: string;
  icon?: ReactNode;
  title: string;
  count: number;
  hint?: string;
  toolbar?: ReactNode;
  children: ReactNode;
  tone?: "default" | "muted";
  headerRight?: ReactNode;
}) {
  const value = id ?? title.replace(/\s+/g, "-").toLowerCase();
  return (
    <Accordion type="multiple" className="w-full">
      <AccordionItem
        value={value}
        className={cn(
          "overflow-hidden rounded-lg border !border-b",
          tone === "muted"
            ? "border-border/60 bg-muted/20"
            : "border-border bg-white",
        )}
      >
        <AccordionTrigger className="group px-4 py-3 hover:no-underline [&>svg]:hidden">
          <div className="flex flex-1 items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {icon && (
                <span className="text-text-tertiary shrink-0">{icon}</span>
              )}
              <span className="suma-h4 text-text-primary truncate">
                {title}
              </span>
              {headerRight == null && (
                <span className="tabular-nums text-text-tertiary font-normal">
                  {count}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {headerRight}
              <ChevronDown className="h-4 w-4 text-text-tertiary transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </div>
          </div>
        </AccordionTrigger>

        <AccordionContent className="border-t border-border/60 px-4 pb-4 pt-3">
          {(hint || toolbar) && (
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              {hint ? (
                <p className="suma-caption text-text-tertiary max-w-2xl">
                  {hint}
                </p>
              ) : (
                <span />
              )}
              {toolbar && (
                <div className="flex flex-wrap items-center gap-2">
                  {toolbar}
                </div>
              )}
            </div>
          )}
          {children}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

/** Chip tipo-cambio para filtros de G2/G6. */
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
    <span onClick={onClick} className="cursor-pointer">
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

// ---------------------------------------------------------------------------
// Tabla + celdas compartidas (modo POSICIÓN, denso)
// ---------------------------------------------------------------------------

export function ReportTable({
  head,
  children,
  compact,
}: {
  head: ReactNode;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-md border border-border/60",
        compact && "text-xs",
      )}
    >
      <table className="w-full text-sm">
        <thead className="bg-surface-page">
          <tr className="border-b border-border text-left">
            {head}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">{children}</tbody>
      </table>
    </div>
  );
}

export function Th({
  children,
  className,
  align,
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      scope="col"
      className={cn(
        "suma-body whitespace-nowrap px-4 py-2.5 font-normal text-text-tertiary",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </th>
  );
}

/** Cabecera "Producto" — SKU (mono) + descripción debajo + marca en pill. */
export function ProductCell({
  sku,
  brand,
  description,
  sourceRow,
  muted,
}: {
  sku?: string | null;
  brand?: string | null;
  description?: string | null;
  sourceRow?: number;
  muted?: boolean;
}) {
  return (
    <td className={cn("px-2 py-1.5 align-top", muted && "opacity-60")}>
      <div className="flex items-center gap-2 flex-wrap">
        {sourceRow != null && (
          <span className="text-[10.5px] text-text-tertiary tabular-nums">
            #{sourceRow}
          </span>
        )}
        {brand && (
          <span className="text-[10.5px] font-semibold uppercase tracking-wide text-accent">
            {brand}
          </span>
        )}
        <span className="font-mono text-sm font-semibold text-foreground">
          {sku || "—"}
        </span>
      </div>
      {description && (
        <div className="text-xs text-muted-foreground line-clamp-2 max-w-[42ch]">
          {description}
        </div>
      )}
    </td>
  );
}

export function StatusCell({
  status,
  overrideLabel,
  muted,
}: {
  status?: string | null;
  overrideLabel?: string;
  muted?: boolean;
}) {
  if (!status)
    return (
      <td className={cn("px-2 py-1.5 text-text-tertiary", muted && "opacity-60")}>
        —
      </td>
    );
  const m = statusMeta(status);
  return (
    <td className={cn("px-2 py-1.5 whitespace-nowrap", muted && "opacity-60")}>
      <StatusBadge status={m.badge} label={overrideLabel ?? m.label} />
    </td>
  );
}

export function PriceCell({
  value,
  muted,
}: {
  value: number | null | undefined;
  muted?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-2 py-1.5 whitespace-nowrap tabular-nums text-right",
        muted && "opacity-60",
      )}
    >
      {value != null ? formatMoneyCOP(value) : "—"}
    </td>
  );
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function DateRangeCell({
  start,
  end,
  muted,
}: {
  start?: string | null;
  end?: string | null;
  muted?: boolean;
}) {
  if (!start && !end)
    return (
      <td className={cn("px-2 py-1.5 text-text-tertiary", muted && "opacity-60")}>
        —
      </td>
    );
  return (
    <td
      className={cn(
        "px-2 py-1.5 whitespace-nowrap tabular-nums text-xs text-text-secondary",
        muted && "opacity-60",
      )}
    >
      {fmtDate(start)} → {fmtDate(end)}
    </td>
  );
}

export function ClientCodeCell({
  code,
  description,
  muted,
}: {
  code?: string | null;
  description?: string | null;
  muted?: boolean;
}) {
  if (!code && !description)
    return (
      <td className={cn("px-2 py-1.5 text-text-tertiary", muted && "opacity-60")}>
        —
      </td>
    );
  return (
    <td className={cn("px-2 py-1.5 align-top", muted && "opacity-60")}>
      {code && (
        <div className="font-mono text-xs font-semibold text-foreground">
          {code}
        </div>
      )}
      {description && (
        <div className="text-[11px] text-muted-foreground line-clamp-1 max-w-[24ch]">
          {description}
        </div>
      )}
    </td>
  );
}

/**
 * DeltaValue — actual→nuevo (precio o texto), con Δ% solo si actual > 0.
 * Se usa dentro de celdas Cambios.
 */
export function DeltaValue({
  from,
  to,
  kind,
}: {
  from: number | null;
  to: number | null;
  kind: "price";
}) {
  const showDelta = from != null && from > 0 && to != null;
  const delta = showDelta ? ((to! - from!) / from!) * 100 : null;
  const up = delta != null && delta > 0;
  const down = delta != null && delta < 0;
  return (
    <span className="inline-flex items-baseline gap-1.5 flex-wrap">
      {from != null && from > 0 ? (
        <>
          <span className="tabular-nums text-xs text-text-tertiary">
            {kind === "price" ? formatMoneyCOP(from) : String(from)}
          </span>
          <span className="text-text-tertiary">→</span>
          <span className="tabular-nums font-semibold text-text-primary">
            {kind === "price" ? formatMoneyCOP(to) : String(to)}
          </span>
          {delta != null && Math.abs(delta) >= 0.005 && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 tabular-nums text-[11px] font-semibold",
                up
                  ? "text-warning-strong"
                  : down
                    ? "text-success-strong"
                    : "text-text-tertiary",
              )}
            >
              {up && <TrendingUp size={10} strokeWidth={2.5} />}
              {down && <TrendingDown size={10} strokeWidth={2.5} />}
              {delta > 0 ? "+" : ""}
              {delta.toFixed(1)}%
            </span>
          )}
        </>
      ) : (
        <>
          <span className="text-text-tertiary text-xs">nuevo</span>
          <span className="tabular-nums font-semibold text-text-primary">
            {kind === "price" ? formatMoneyCOP(to) : String(to ?? "—")}
          </span>
        </>
      )}
    </span>
  );
}

/** Compacto: lista de cambios como líneas dentro de una celda de tabla. */
export function ChangesInline({ changes }: { changes: FieldChange[] }) {
  if (changes.length === 0)
    return <span className="text-text-tertiary">—</span>;
  return (
    <div className="space-y-0.5">
      {changes.map((c, i) => {
        if (c.field === "sale_price" || c.field === "par_price") {
          return (
            <div key={i} className="text-xs">
              <span className="text-text-tertiary uppercase tracking-wide text-[10px] mr-1.5">
                {FIELD_LABEL[c.field]}
              </span>
              <DeltaValue from={c.from} to={c.to} kind="price" />
            </div>
          );
        }
        if (c.field === "start_date" || c.field === "end_date") {
          return (
            <div key={i} className="text-xs tabular-nums">
              <span className="text-text-tertiary uppercase tracking-wide text-[10px] mr-1.5">
                {FIELD_LABEL[c.field]}
              </span>
              <span className="text-text-tertiary">{fmtDate(c.from)}</span>
              <span className="mx-1 text-text-tertiary">→</span>
              <span className="font-semibold text-text-primary">
                {fmtDate(c.to)}
              </span>
            </div>
          );
        }
        if (c.field === "observations") {
          return (
            <div key={i} className="text-xs">
              <span className="text-text-tertiary uppercase tracking-wide text-[10px] mr-1.5">
                {FIELD_LABEL.observations}
              </span>
              <span className="text-text-secondary line-through mr-1">
                {c.from || "vacío"}
              </span>
              <span className="text-text-primary">{c.to || "vacío"}</span>
            </div>
          );
        }
        if (c.field === "add_client_code") {
          return (
            <div key={i} className="text-xs">
              <span className="text-text-tertiary uppercase tracking-wide text-[10px] mr-1.5">
                Nuevo código
              </span>
              <span className="font-mono font-semibold text-foreground">
                {c.client_code}
              </span>
              {c.description && (
                <span className="text-text-secondary"> — {c.description}</span>
              )}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

/** Fila enriquecida para grupos INERTES (G5, G6). */
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
          <span className="text-[10.5px] text-text-tertiary tabular-nums">
            #{sourceRow}
          </span>
          {brand && (
            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-accent">
              {brand}
            </span>
          )}
          <span className="font-mono text-sm font-semibold text-foreground">
            {sku || "—"}
          </span>
        </div>
        {description && (
          <div className="text-xs text-muted-foreground">{description}</div>
        )}
        {extra}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
