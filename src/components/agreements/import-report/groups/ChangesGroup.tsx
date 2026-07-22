import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import type {
  ClassifiedRow,
  FieldChange,
  PositionSnapshot,
} from "@/lib/agreement-import";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/sumatec";
import { formatMoneyCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { GroupShell } from "../parts";
import { statusMeta } from "../labels";
import type { DecisionsState } from "../state";
import { EmptyGroup } from "./Group1RequiresDecision";

type FilterKey =
  | "all"
  | "prices"
  | "dates"
  | "observations"
  | "relations";

type ChangeCategory = "prices" | "dates" | "observations" | "relations";

function categoryOf(f: FieldChange): ChangeCategory {
  if (f.field === "sale_price" || f.field === "par_price") return "prices";
  if (f.field === "start_date" || f.field === "end_date") return "dates";
  if (f.field === "observations") return "observations";
  return "relations";
}

function categoryCounts(changes: FieldChange[]) {
  const c = { prices: 0, dates: 0, observations: 0, relations: 0 };
  for (const ch of changes) c[categoryOf(ch)]++;
  return c;
}

function statusRank(s: string | undefined | null): number {
  switch (s) {
    case "active":
      return 0;
    case "requires_review":
      return 1;
    case "draft":
      return 2;
    case "excluded":
      return 3;
    default:
      return 9;
  }
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

/**
 * ChangesGroup — grupos B y C del reporte de importación.
 * Comportamiento: TODOS los cambios se aplican por defecto. La acción del
 * usuario es DESCARTAR. Un descarte se puede deshacer ("Recuperar cambios").
 */
export function ChangesGroup({
  id,
  icon,
  title,
  rows,
  positionsById,
  decisions,
  emptyMessage,
}: {
  id: string;
  icon?: React.ReactNode;
  title: string;
  rows: ClassifiedRow[];
  positionsById: Map<string, PositionSnapshot>;
  decisions: DecisionsState;
  emptyMessage: string;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const enriched = useMemo(() => {
    return rows
      .map((r) => {
        const pos = r.resolvedPositionId
          ? positionsById.get(r.resolvedPositionId)
          : undefined;
        return { r, pos, changes: r.changes ?? [] };
      })
      .filter((x) => !!x.pos)
      .sort((a, b) => {
        const s = statusRank(a.pos!.status) - statusRank(b.pos!.status);
        if (s !== 0) return s;
        return a.r.sourceRow - b.r.sourceRow;
      });
  }, [rows, positionsById]);

  const totals = useMemo(() => {
    const tot = { prices: 0, dates: 0, observations: 0, relations: 0, all: 0 };
    for (const { changes } of enriched) {
      for (const c of changes) {
        tot[categoryOf(c)]++;
        tot.all++;
      }
    }
    return tot;
  }, [enriched]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched.filter(({ pos, changes }) => {
      if (filter !== "all") {
        const key = filter === "prices"
          ? "prices"
          : filter === "dates"
            ? "dates"
            : filter === "observations"
              ? "observations"
              : "relations";
        if (!changes.some((c) => categoryOf(c) === key)) return false;
      }
      if (q) {
        const hay = [pos!.sku, pos!.commercial_brand, pos!.erp_description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [enriched, filter, query]);

  const positionsCount = enriched.length;
  const changesCount = totals.all;
  const activeCount = enriched.filter(
    (x) => decisions.get(x.r.sourceRow).kind === "apply",
  ).length;
  const activeChangesCount = enriched.reduce(
    (acc, x) =>
      acc + (decisions.get(x.r.sourceRow).kind === "apply" ? x.changes.length : 0),
    0,
  );

  return (
    <GroupShell
      id={id}
      icon={icon}
      title={title}
      count={changesCount}
      hint={`${changesCount} cambios en ${positionsCount} posiciones. Se aplicarán al confirmar salvo los que descartes.`}
    >
      {rows.length === 0 ? (
        <EmptyGroup message={emptyMessage} />
      ) : (
        <div className="space-y-3">
          {/* Toolbar: buscador + filtros + descartar todos */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen((s) => !s)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
                searchOpen
                  ? "border-accent text-accent bg-accent/5"
                  : "border-border text-text-tertiary hover:text-text-primary",
              )}
              aria-label="Buscar posición"
            >
              <Search className="h-4 w-4" />
            </button>
            {searchOpen && (
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="SKU, marca o producto…"
                className="h-8 max-w-xs"
              />
            )}
            <FilterTab
              active={filter === "all"}
              onClick={() => setFilter("all")}
              label="Todos"
              count={totals.all}
            />
            <FilterTab
              active={filter === "prices"}
              onClick={() => setFilter("prices")}
              label="Precios"
              count={totals.prices}
            />
            <FilterTab
              active={filter === "dates"}
              onClick={() => setFilter("dates")}
              label="Vigencias"
              count={totals.dates}
            />
            <FilterTab
              active={filter === "observations"}
              onClick={() => setFilter("observations")}
              label="Observaciones"
              count={totals.observations}
            />
            <FilterTab
              active={filter === "relations"}
              onClick={() => setFilter("relations")}
              label="Relaciones"
              count={totals.relations}
            />
            <div className="ml-auto flex items-center gap-2">
              {activeCount < positionsCount ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    decisions.setMany(
                      enriched.map((x) => x.r),
                      { kind: "apply" },
                    )
                  }
                >
                  Recuperar todos ({positionsCount - activeCount})
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                disabled={activeCount === 0}
                onClick={() =>
                  decisions.setMany(
                    enriched.map((x) => x.r),
                    { kind: "ignore" },
                  )
                }
              >
                Descartar todos ({activeChangesCount})
              </Button>
            </div>
          </div>

          {/* Lista de cards por posición */}
          <div className="space-y-2">
            {visible.length === 0 ? (
              <p className="suma-caption text-text-tertiary px-1 py-4">
                Ningún cambio coincide con el filtro.
              </p>
            ) : (
              visible.map(({ r, pos, changes }) => (
                <PositionChangeCard
                  key={r.sourceRow}
                  row={r}
                  pos={pos!}
                  changes={changes}
                  discarded={decisions.get(r.sourceRow).kind === "ignore"}
                  onDiscard={() =>
                    decisions.set(r.sourceRow, { kind: "ignore" })
                  }
                  onRestore={() =>
                    decisions.set(r.sourceRow, { kind: "apply" })
                  }
                />
              ))
            )}
          </div>
        </div>
      )}
    </GroupShell>
  );
}

function FilterTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 text-xs rounded-md transition-colors",
        active
          ? "text-text-primary font-semibold border-b-2 border-primary rounded-none"
          : "text-text-tertiary hover:text-text-primary",
      )}
    >
      {label} <span className="tabular-nums">({count})</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Card por posición (colapsable individual)
// ---------------------------------------------------------------------------

function PositionChangeCard({
  row,
  pos,
  changes,
  discarded,
  onDiscard,
  onRestore,
}: {
  row: ClassifiedRow;
  pos: PositionSnapshot;
  changes: FieldChange[];
  discarded: boolean;
  onDiscard: () => void;
  onRestore: () => void;
}) {
  const [open, setOpen] = useState(false);
  const counts = categoryCounts(changes);
  const status = statusMeta(pos.status);

  const changesLabel = discarded
    ? `Recuperar cambios (${changes.length})`
    : `Descartar cambios (${changes.length})`;

  return (
    <div
      className={cn(
        "rounded-lg border bg-white transition-colors",
        discarded ? "border-border/60 bg-muted/20" : "border-border",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-start gap-3 min-w-0 text-left"
        >
          <div className={cn("min-w-0 flex-1", discarded && "opacity-60")}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10.5px] text-text-tertiary tabular-nums">
                #{row.sourceRow}
              </span>
              <span className="font-mono text-sm font-semibold text-foreground">
                {pos.sku || "—"}
              </span>
              {pos.commercial_brand && (
                <>
                  <span className="text-text-tertiary">·</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">
                    {pos.commercial_brand}
                  </span>
                </>
              )}
              <StatusBadge status={status.badge} label={status.label} />
            </div>
            {pos.erp_description && (
              <div className="text-xs text-muted-foreground line-clamp-1">
                {pos.erp_description}
              </div>
            )}
          </div>
        </button>
        <button
          type="button"
          onClick={discarded ? onRestore : onDiscard}
          className={cn(
            "shrink-0 text-xs transition-colors",
            discarded
              ? "text-accent hover:text-accent/80"
              : "text-text-tertiary hover:text-primary",
          )}
        >
          {changesLabel}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 text-text-tertiary hover:text-text-primary"
          aria-label={open ? "Colapsar" : "Expandir"}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </div>

      {open && (
        <div
          className={cn(
            "border-t border-border/60 px-3 pb-3 pt-2",
            discarded && "opacity-60",
          )}
        >
          <ChangeGrid pos={pos} changes={changes} counts={counts} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grid de cambios: SIEMPRE 4 columnas en orden fijo.
// Fila superior = "nuevo" (cómo quedará). Fila inferior = "actual".
// ---------------------------------------------------------------------------

const COLS: ChangeCategory[] = ["relations", "observations", "dates", "prices"];

const LABEL: Record<ChangeCategory, string> = {
  relations: "Relación",
  observations: "Observaciones",
  dates: "Vigencia",
  prices: "Precios de venta",
};

function ChangeGrid({
  pos,
  changes,
  counts,
}: {
  pos: PositionSnapshot;
  changes: FieldChange[];
  counts: ReturnType<typeof categoryCounts>;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2 lg:grid-cols-4">
      {COLS.map((col) => {
        const n = counts[col];
        const active = n > 0;
        return (
          <div
            key={`h-${col}`}
            className={cn(
              "text-[13px] font-normal",
              active ? "text-text-secondary" : "text-text-tertiary",
            )}
          >
            {LABEL[col]}{" "}
            <span className="tabular-nums text-text-tertiary">({n})</span>
          </div>
        );
      })}
      {COLS.map((col) => (
        <div key={`new-${col}`} className="text-sm">
          {counts[col] > 0 ? (
            <NewCell col={col} pos={pos} changes={changes} />
          ) : (
            <SinCambios />
          )}
        </div>
      ))}
      {COLS.map((col) => (
        <div key={`old-${col}`} className="text-xs text-text-tertiary">
          {counts[col] > 0 ? (
            <OldCell col={col} pos={pos} changes={changes} />
          ) : (
            <span className="text-text-tertiary/60">—</span>
          )}
        </div>
      ))}
    </div>
  );
}

function NewCell({
  col,
  pos,
  changes,
}: {
  col: ChangeCategory;
  pos: PositionSnapshot;
  changes: FieldChange[];
}) {
  if (col === "prices") {
    const sale = changes.find((c) => c.field === "sale_price");
    const par = changes.find((c) => c.field === "par_price");
    const saleValue =
      sale && sale.field === "sale_price"
        ? sale.to
        : pos.sale_price;
    const parValue =
      par && par.field === "par_price" ? par.to : pos.par_price;
    return (
      <div className="space-y-0.5 tabular-nums">
        <div className={cn("font-semibold", sale ? "text-text-primary" : "text-text-tertiary")}>
          {saleValue != null ? formatMoneyCOP(saleValue) : "—"}
        </div>
        {(par || pos.par_price != null) && (
          <div className={cn(par ? "text-text-primary" : "text-text-tertiary")}>
            <span className="text-[10px] uppercase tracking-wide mr-1">Par</span>
            {parValue != null ? formatMoneyCOP(parValue) : "—"}
          </div>
        )}
      </div>
    );
  }
  if (col === "dates") {
    const start = changes.find((c) => c.field === "start_date");
    const end = changes.find((c) => c.field === "end_date");
    const startTo =
      start && start.field === "start_date" ? start.to : pos.start_date;
    const endTo = end && end.field === "end_date" ? end.to : pos.end_date;
    return (
      <div className="space-y-0.5 tabular-nums">
        <div className={cn(start ? "text-text-primary font-semibold" : "text-text-tertiary")}>
          <span className="text-[10px] uppercase tracking-wide mr-1">Desde</span>
          {fmtDate(startTo)}
        </div>
        <div className={cn(end ? "text-text-primary font-semibold" : "text-text-tertiary")}>
          <span className="text-[10px] uppercase tracking-wide mr-1">Hasta</span>
          {fmtDate(endTo)}
        </div>
      </div>
    );
  }
  if (col === "observations") {
    const obs = changes.find((c) => c.field === "observations");
    const value =
      obs && obs.field === "observations" ? obs.to : pos.observations;
    return (
      <div className="text-text-primary line-clamp-3">
        {value || <span className="text-text-tertiary">vacío</span>}
      </div>
    );
  }
  // relations: add_client_code
  const adds = changes.filter((c) => c.field === "add_client_code");
  return (
    <div className="space-y-1">
      {adds.map((c, i) => {
        if (c.field !== "add_client_code") return null;
        return (
          <div key={i}>
            <div className="font-mono font-semibold text-text-primary">
              {c.client_code}
            </div>
            {c.description && (
              <div className="text-[11px] text-text-tertiary line-clamp-1">
                {c.description}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OldCell({
  col,
  pos,
  changes,
}: {
  col: ChangeCategory;
  pos: PositionSnapshot;
  changes: FieldChange[];
}) {
  if (col === "prices") {
    const hasSale = changes.some((c) => c.field === "sale_price");
    const hasPar = changes.some((c) => c.field === "par_price");
    if (!hasSale && !hasPar) return <SinCambios />;
    return (
      <div className="space-y-0.5 tabular-nums">
        <div>
          {hasSale
            ? pos.sale_price != null
              ? formatMoneyCOP(pos.sale_price)
              : "vacío"
            : "Sin cambios"}
        </div>
        {(hasPar || pos.par_price != null) && (
          <div>
            <span className="text-[10px] uppercase tracking-wide mr-1">Par</span>
            {hasPar
              ? pos.par_price != null
                ? formatMoneyCOP(pos.par_price)
                : "vacío"
              : "Sin cambios"}
          </div>
        )}
      </div>
    );
  }
  if (col === "dates") {
    const hasStart = changes.some((c) => c.field === "start_date");
    const hasEnd = changes.some((c) => c.field === "end_date");
    if (!hasStart && !hasEnd) return <SinCambios />;
    return (
      <div className="space-y-0.5 tabular-nums">
        <div>
          <span className="text-[10px] uppercase tracking-wide mr-1">Desde</span>
          {hasStart ? fmtDate(pos.start_date) : "Sin cambios"}
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-wide mr-1">Hasta</span>
          {hasEnd ? fmtDate(pos.end_date) : "Sin cambios"}
        </div>
      </div>
    );
  }
  if (col === "observations") {
    const hasObs = changes.some((c) => c.field === "observations");
    if (!hasObs) return <SinCambios />;
    return (
      <div className="line-clamp-3">
        {pos.observations || <em>vacío</em>}
      </div>
    );
  }
  // relations
  return <SinCambios label="No había este código" />;
}

function SinCambios({ label = "Sin cambios" }: { label?: string }) {
  return <span className="text-text-tertiary italic">{label}</span>;
}

