import type { ReactNode } from "react";
import { ChevronDown, TrendingDown, TrendingUp } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Chip, StatusBadge, IdentityCell } from "@/components/sumatec";
import { formatMoneyCOP, formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FieldChange } from "@/lib/agreement-import";
import { FIELD_LABEL, statusMeta } from "./labels";

/**
 * parts.tsx — piezas compartidas del reporte de importación.
 *
 * Regla del sistema (no negociable):
 *  - Toda tabla del reporte usa el MISMO estilo de header/celdas que el
 *    DataTable de Sumatec: header 11px uppercase tertiary sobre `surface-page`,
 *    celdas `px-4 py-3 align-top`, texto 13px Roboto, numéricas a la derecha
 *    con `tabular-nums`, filas separadas por `border-b border-border/60`.
 *  - Las celdas se importan desde este módulo (`ProductCell`, `StatusCell`,
 *    `PriceCell`, `DateRangeCell`, `ClientCodeCell`). No re-implementar
 *    layouts equivalentes por grupo.
 *  - Los tabs de filtro usan `FilterTab` (sublínea underline en text-primary),
 *    consistente con los tabs de posiciones del acuerdo.
 */

// ---------------------------------------------------------------------------
// Contenedor de grupo (acordeón)
// ---------------------------------------------------------------------------

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
            : "border-border bg-card",
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

// ---------------------------------------------------------------------------
// Filtros de tabla — tabs underline (mismo patrón que la app)
// ---------------------------------------------------------------------------

export function FilterTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative -mb-px border-b-2 px-3 py-2 text-[13px] transition-colors",
        active
          ? "border-text-primary font-semibold text-text-primary"
          : "border-transparent font-normal text-text-tertiary hover:text-text-primary",
      )}
    >
      {label}
      {count != null && (
        <span className="ml-1 tabular-nums font-normal opacity-70">
          ({count})
        </span>
      )}
    </button>
  );
}

export function FilterTabsBar({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-border/60">
      <div className="flex flex-wrap items-center gap-1">{children}</div>
    </div>
  );
}

/** Chip tipo-cambio para toolbars (G6). Usa el token Chip de Sumatec. */
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
        "overflow-hidden rounded-lg border border-border bg-card",
        compact && "text-xs",
      )}
    >
      <table className="w-full border-collapse font-body text-[13px] leading-5 text-text-secondary">
        <thead className="bg-surface-page">
          <tr className="border-b border-border">{head}</tr>
        </thead>
        <tbody>{children}</tbody>
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
        align === "right"
          ? "text-right"
          : align === "center"
            ? "text-center"
            : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

/** Fila del reporte — mismo border/hover que DataTable. */
export function Tr({
  children,
  onClick,
  className,
  highlighted,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  highlighted?: "warning" | "info" | "success" | null;
}) {
  const hl =
    highlighted === "warning"
      ? "bg-warning-soft/40"
      : highlighted === "info"
        ? "bg-info-soft/40"
        : highlighted === "success"
          ? "bg-success-soft/30"
          : "bg-card hover:bg-surface-page";
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b border-border/60 transition-colors last:border-b-0",
        hl,
        onClick && "cursor-pointer",
        className,
      )}
    >
      {children}
    </tr>
  );
}

/**
 * ProductCell — celda de producto para las tablas del reporte.
 * Reutiliza IdentityCell del sistema para SKU + descripción y añade una
 * línea meta discreta con `#fila` y la marca comercial.
 */
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
    <td className={cn("px-4 py-3 align-top", muted && "opacity-60")}>
      {(sourceRow != null || brand) && (
        <div className="mb-0.5 flex items-center gap-2 text-[11px]">
          {sourceRow != null && (
            <span className="tabular-nums text-text-tertiary">
              #{sourceRow}
            </span>
          )}
          {brand && (
            <span className="font-semibold uppercase tracking-wide text-accent">
              {brand}
            </span>
          )}
        </div>
      )}
      <IdentityCell code={sku || "—"} description={description ?? undefined} />
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
      <td
        className={cn(
          "px-4 py-3 align-top text-text-tertiary",
          muted && "opacity-60",
        )}
      >
        —
      </td>
    );
  const m = statusMeta(status);
  return (
    <td
      className={cn(
        "whitespace-nowrap px-4 py-3 align-top",
        muted && "opacity-60",
      )}
    >
      <StatusBadge size="sm" status={m.badge} label={overrideLabel ?? m.label} />
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
        "whitespace-nowrap px-4 py-3 text-right align-top tabular-nums text-text-primary",
        muted && "opacity-60",
      )}
    >
      {value != null ? formatMoneyCOP(value) : "—"}
    </td>
  );
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
      <td
        className={cn(
          "px-4 py-3 align-top text-text-tertiary",
          muted && "opacity-60",
        )}
      >
        —
      </td>
    );
  return (
    <td
      className={cn(
        "whitespace-nowrap px-4 py-3 align-top tabular-nums text-text-primary",
        muted && "opacity-60",
      )}
    >
      {formatDateShort(start)}
      <span className="mx-1 text-text-tertiary">→</span>
      {formatDateShort(end)}
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
      <td
        className={cn(
          "px-4 py-3 align-top text-text-tertiary",
          muted && "opacity-60",
        )}
      >
        —
      </td>
    );
  return (
    <td className={cn("px-4 py-3 align-top", muted && "opacity-60")}>
      {code ? (
        <IdentityCell code={code} description={description ?? undefined} />
      ) : (
        <span className="text-text-secondary line-clamp-2 max-w-[32ch]">
          {description}
        </span>
      )}
    </td>
  );
}

/**
 * DeltaValue — actual→nuevo (precio o texto), con Δ% solo si actual > 0.
 * Colores: subida en warning, bajada en success. Nunca colores crudos.
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
              <span className="mr-1.5 text-[10px] uppercase tracking-wide text-text-tertiary">
                {FIELD_LABEL[c.field]}
              </span>
              <DeltaValue from={c.from} to={c.to} kind="price" />
            </div>
          );
        }
        if (c.field === "start_date" || c.field === "end_date") {
          return (
            <div key={i} className="text-xs tabular-nums">
              <span className="mr-1.5 text-[10px] uppercase tracking-wide text-text-tertiary">
                {FIELD_LABEL[c.field]}
              </span>
              <span className="text-text-tertiary">
                {formatDateShort(c.from)}
              </span>
              <span className="mx-1 text-text-tertiary">→</span>
              <span className="font-semibold text-text-primary">
                {formatDateShort(c.to)}
              </span>
            </div>
          );
        }
        if (c.field === "observations") {
          return (
            <div key={i} className="text-xs">
              <span className="mr-1.5 text-[10px] uppercase tracking-wide text-text-tertiary">
                {FIELD_LABEL.observations}
              </span>
              <span className="mr-1 text-text-secondary line-through">
                {c.from || "vacío"}
              </span>
              <span className="text-text-primary">{c.to || "vacío"}</span>
            </div>
          );
        }
        if (c.field === "add_client_code") {
          return (
            <div key={i} className="text-xs">
              <span className="mr-1.5 text-[10px] uppercase tracking-wide text-text-tertiary">
                Nuevo código
              </span>
              <span className="font-mono font-semibold text-text-primary">
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
