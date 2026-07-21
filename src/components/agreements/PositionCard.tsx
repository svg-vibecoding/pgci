import type { ReactNode } from "react";
import { StatusBadge, type StatusBadgeStatus } from "@/components/sumatec";
import { formatMoneyCOP } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * PositionCard — tarjeta compartida para representar una posición del acuerdo.
 * Mirroriza la sub-tarjeta usada dentro de `SkuGroupCard` (lines.tsx) para
 * que el reporte de importación hable "en modo posición" con coherencia
 * visual total. Composición por slots: `headerLeft`, `headerRight`, `footer`
 * y `children` para bloques extra (por ejemplo actual→nuevo).
 */

export type PositionCardClientCode = {
  clientLabel: string;
  code: string;
  description?: string | null;
};

export type PositionCardTone = "default" | "muted" | "warning" | "info";

export type PositionCardProps = {
  status?: StatusBadgeStatus;
  statusLabel?: string;
  startDate?: string | null;
  endDate?: string | null;
  price?: number | null;
  parPrice?: number | null;
  /** SKU del producto. Si no hay, muestra "—" o se omite. */
  sku?: string | null;
  brand?: string | null;
  description?: string | null;
  /**
   * Códigos cliente asociados a la posición. Si el SKU no está en el
   * catálogo (o no hay marca/descripción), no se muestran esas líneas.
   */
  clientCodes?: PositionCardClientCode[];
  /** Slot arriba a la derecha (chips, switch, botón). */
  headerRight?: ReactNode;
  /** Slot arriba a la izquierda (checkbox de selección). */
  headerLeft?: ReactNode;
  /** Contenido extra debajo del cuerpo (ej. bloque "Cambios"). */
  children?: ReactNode;
  /** Fila de acciones al pie. */
  footer?: ReactNode;
  tone?: PositionCardTone;
  className?: string;
};

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const TONE_STYLES: Record<PositionCardTone, string> = {
  default: "border-border bg-white",
  muted: "border-border bg-muted/40",
  warning: "border-warning/40 bg-warning/5",
  info: "border-info/40 bg-info/5",
};

export function PositionCard({
  status,
  statusLabel,
  startDate,
  endDate,
  price,
  parPrice,
  sku,
  brand,
  description,
  clientCodes,
  headerRight,
  headerLeft,
  children,
  footer,
  tone = "default",
  className,
}: PositionCardProps) {
  const hasStatus = status !== undefined;
  const hasVigencia = startDate != null || endDate != null;
  const hasPrice = price != null;

  return (
    <div
      className={cn(
        "rounded-md border p-3 text-sm flex flex-col",
        TONE_STYLES[tone],
        className,
      )}
    >
      {/* Header: status · vigencia · precio · slots */}
      {(hasStatus || hasVigencia || hasPrice || headerRight || headerLeft) && (
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {headerLeft}
            {hasStatus && (
              <StatusBadge status={status} label={statusLabel} />
            )}
            {hasVigencia && (
              <span className="suma-caption text-text-secondary tabular-nums">
                {formatShortDate(startDate)} → {formatShortDate(endDate)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasPrice && (
              <span className="font-bold text-foreground tabular-nums">
                {formatMoneyCOP(price)}
              </span>
            )}
            {headerRight}
          </div>
        </div>
      )}

      {parPrice != null && parPrice > 0 && (
        <div className="mt-1 text-right text-[11.5px] text-text-tertiary tabular-nums">
          par {formatMoneyCOP(parPrice)}
        </div>
      )}

      {/* Body: SKU + marca + descripción (solo si hay datos reales) */}
      {(sku || brand || description) && (
        <div className="mt-2 border-t border-border/60 pt-2 space-y-0.5">
          {(sku || brand) && (
            <div>
              {brand && (
                <>
                  <span className="text-xs font-semibold uppercase tracking-wide text-accent">
                    {brand}
                  </span>
                  {sku && <span className="text-text-tertiary"> · </span>}
                </>
              )}
              {sku && (
                <span className="font-mono font-semibold text-foreground">
                  {sku}
                </span>
              )}
            </div>
          )}
          {description && (
            <div className="text-muted-foreground">{description}</div>
          )}
        </div>
      )}

      {/* Client codes */}
      {clientCodes && clientCodes.length > 0 && (
        <div className="mt-2 border-t border-border/60 pt-2 space-y-2">
          {clientCodes.map((c, i) => (
            <div key={`${c.code}-${i}`} className="text-sm">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-accent">
                  {c.clientLabel}
                </span>{" "}
                ·{" "}
                <span className="font-mono font-semibold text-foreground">
                  {c.code}
                </span>
              </div>
              {c.description && (
                <div className="text-muted-foreground">{c.description}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Extra content (changes block, etc.) */}
      {children && <div className="mt-2">{children}</div>}

      {/* Footer actions */}
      {footer && (
        <div className="mt-2 pt-2 border-t border-border/60 flex items-center justify-end gap-2">
          {footer}
        </div>
      )}
    </div>
  );
}
