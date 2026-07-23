import { useMemo, useState } from "react";
import {
  AlignLeft,
  Calendar,
  ChevronDown,
  Link2,
  Search,
  Tag,
} from "lucide-react";
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
  clientsById,
  decisions,
  emptyMessage,
}: {
  id: string;
  icon?: React.ReactNode;
  title: string;
  rows: ClassifiedRow[];
  positionsById: Map<string, PositionSnapshot>;
  clientsById: Map<string, string>;
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
                  clientsById={clientsById}
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
  clientsById,
  discarded,
  onDiscard,
  onRestore,
}: {
  row: ClassifiedRow;
  pos: PositionSnapshot;
  changes: FieldChange[];
  clientsById: Map<string, string>;
  discarded: boolean;
  onDiscard: () => void;
  onRestore: () => void;
}) {
  const [open, setOpen] = useState(false);
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
      <div className="flex items-center gap-3 px-4 py-3">
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
              <div className="mt-0.5 suma-subtitle text-text-primary line-clamp-1">
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
            "border-t border-border/60 px-4 pb-4 pt-4",
            discarded && "opacity-60",
          )}
        >
          <ChangeBlocks
            pos={pos}
            changes={changes}
            clientsById={clientsById}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bloques de cambio: solo se renderizan los que TIENEN cambios.
// Ancho igual repartido según cuántos bloques haya (1, 2, 3 o 4).
// Relaciones tiene tratamiento visual diferenciado (fondo accent suave).
// ---------------------------------------------------------------------------

type BlockKey = "relations" | "prices" | "dates" | "observations";

const BLOCK_ORDER: BlockKey[] = [
  "relations",
  "prices",
  "dates",
  "observations",
];

const BLOCK_META: Record<
  BlockKey,
  { label: string; Icon: typeof Tag }
> = {
  relations: { label: "Relaciones", Icon: Link2 },
  prices: { label: "Precios de venta", Icon: Tag },
  dates: { label: "Vigencias", Icon: Calendar },
  observations: { label: "Observaciones", Icon: AlignLeft },
};

// Enumeradas para que Tailwind las conserve.
const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-3",
  4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
};

function ChangeBlocks({
  pos,
  changes,
  clientsById,
}: {
  pos: PositionSnapshot;
  changes: FieldChange[];
  clientsById: Map<string, string>;
}) {
  const counts = categoryCounts(changes);
  const present = BLOCK_ORDER.filter((k) => counts[k] > 0);
  const cols = GRID_COLS[present.length] ?? GRID_COLS[4];

  return (
    <div className={cn("grid gap-3", cols)}>
      {present.map((key) => (
        <Block
          key={key}
          blockKey={key}
          pos={pos}
          changes={changes}
          clientsById={clientsById}
        />
      ))}
    </div>
  );
}

function Block({
  blockKey,
  pos,
  changes,
  clientsById,
}: {
  blockKey: BlockKey;
  pos: PositionSnapshot;
  changes: FieldChange[];
  clientsById: Map<string, string>;
}) {
  const { label, Icon } = BLOCK_META[blockKey];
  const isRelations = blockKey === "relations";

  return (
    <section
      className={cn(
        "flex h-full flex-col rounded-md p-3",
        isRelations
          ? "bg-accent/[0.04] border border-accent/20"
          : "border border-transparent",
      )}
    >
      <header className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            "grid h-6 w-6 place-items-center rounded",
            isRelations
              ? "bg-accent/10 text-accent"
              : "bg-muted text-text-secondary",
          )}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
          {label}
        </h4>
      </header>
      <div className="flex-1">
        {blockKey === "prices" && <PricesBody pos={pos} changes={changes} />}
        {blockKey === "dates" && <DatesBody pos={pos} changes={changes} />}
        {blockKey === "observations" && (
          <ObservationsBody pos={pos} changes={changes} />
        )}
        {blockKey === "relations" && (
          <RelationsBody changes={changes} clientsById={clientsById} />
        )}
      </div>
    </section>
  );
}

// ---------- Precios ----------

function PricesBody({
  pos,
  changes,
}: {
  pos: PositionSnapshot;
  changes: FieldChange[];
}) {
  const sale = changes.find((c) => c.field === "sale_price");
  const par = changes.find((c) => c.field === "par_price");
  const hasSale = !!sale;
  const hasPar = !!par;

  const saleTo = hasSale && sale.field === "sale_price" ? sale.to : pos.sale_price;
  const saleFrom = hasSale && sale.field === "sale_price" ? sale.from : pos.sale_price;
  const parTo = hasPar && par.field === "par_price" ? par.to : pos.par_price;
  const parFrom = hasPar && par.field === "par_price" ? par.from : pos.par_price;

  return (
    <div className="space-y-3 tabular-nums">
      <PriceLine
        label="Unidad"
        changed={hasSale}
        from={saleFrom}
        to={saleTo}
        emptyPrevText="no tenía precio unidad"
      />
      {(hasPar || pos.par_price != null) && (
        <PriceLine
          label="Par"
          changed={hasPar}
          from={parFrom}
          to={parTo}
          emptyPrevText="no tenía precio par"
        />
      )}
    </div>
  );
}

function PriceLine({
  label,
  changed,
  from,
  to,
  emptyPrevText,
}: {
  label: string;
  changed: boolean;
  from: number | null;
  to: number | null;
  emptyPrevText: string;
}) {
  const pct = pctDelta(from, to);
  return (
    <div>
      <div className="suma-caption text-text-tertiary">{label}</div>
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "text-lg font-bold",
            changed ? "text-text-primary" : "text-text-tertiary",
          )}
        >
          {to != null ? formatMoneyCOP(to) : "—"}
        </span>
        {changed && pct != null && <DeltaPct pct={pct} />}
      </div>
      {changed && (
        <div className="mt-0.5 suma-caption text-text-tertiary">
          {from != null ? `antes ${formatMoneyCOP(from)}` : emptyPrevText}
        </div>
      )}
    </div>
  );
}

function pctDelta(from: number | null, to: number | null): number | null {
  if (from == null || to == null || from === 0) return null;
  return ((to - from) / from) * 100;
}

function DeltaPct({ pct }: { pct: number }) {
  const up = pct > 0;
  const arrow = up ? "↑" : pct < 0 ? "↓" : "";
  const rounded = Math.round(Math.abs(pct));
  return (
    <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-text-secondary bg-muted">
      <span aria-hidden>{arrow}</span>
      {rounded}%
    </span>
  );
}

// ---------- Vigencias ----------

function DatesBody({
  pos,
  changes,
}: {
  pos: PositionSnapshot;
  changes: FieldChange[];
}) {
  const start = changes.find((c) => c.field === "start_date");
  const end = changes.find((c) => c.field === "end_date");
  const hadPrev = pos.start_date || pos.end_date;
  const startTo = start && start.field === "start_date" ? start.to : pos.start_date;
  const endTo = end && end.field === "end_date" ? end.to : pos.end_date;
  const startFrom = start && start.field === "start_date" ? start.from : pos.start_date;
  const endFrom = end && end.field === "end_date" ? end.from : pos.end_date;

  return (
    <div className="tabular-nums">
      <div className="flex items-baseline gap-2 text-base font-bold text-text-primary">
        <span>{fmtDate(startTo)}</span>
        <span className="text-text-tertiary">→</span>
        <span>{fmtDate(endTo)}</span>
      </div>
      <div className="mt-1 suma-caption text-text-tertiary">
        {hadPrev
          ? `antes ${fmtDate(startFrom)} → ${fmtDate(endFrom)}`
          : "no tenía vigencia"}
      </div>
    </div>
  );
}

// ---------- Observaciones ----------

function ObservationsBody({
  pos,
  changes,
}: {
  pos: PositionSnapshot;
  changes: FieldChange[];
}) {
  const obs = changes.find((c) => c.field === "observations");
  const to = obs && obs.field === "observations" ? obs.to : pos.observations;
  const from = obs && obs.field === "observations" ? obs.from : pos.observations;

  return (
    <div>
      <p className="text-sm text-text-primary leading-snug line-clamp-4">
        {to || <span className="text-text-tertiary italic">vacío</span>}
      </p>
      <p className="mt-2 suma-caption text-text-tertiary leading-snug line-clamp-3">
        {from ? `antes: ${from}` : "no tenía observaciones"}
      </p>
    </div>
  );
}

// ---------- Relaciones ----------

function RelationsBody({
  changes,
  clientsById,
}: {
  changes: FieldChange[];
  clientsById: Map<string, string>;
}) {
  const adds = changes.filter(
    (c): c is Extract<FieldChange, { field: "add_client_code" }> =>
      c.field === "add_client_code",
  );
  return (
    <div className="space-y-1.5">
      <p className="suma-caption text-text-tertiary">
        Códigos de cliente agregados
      </p>
      <ul className="space-y-1">
        {adds.map((c, i) => {
          const clientName = clientsById.get(c.client_id) ?? c.client_id;
          return (
            <li
              key={i}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">
                {clientName}
              </span>
              <span className="text-text-tertiary">·</span>
              <span className="font-mono text-text-primary">
                {c.client_code}
              </span>
              {c.description && (
                <>
                  <span className="text-text-tertiary">·</span>
                  <span className="text-text-secondary line-clamp-1">
                    {c.description}
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

}

