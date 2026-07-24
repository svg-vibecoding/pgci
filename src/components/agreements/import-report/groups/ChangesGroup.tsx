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

type BlockKey = "relations" | "prices" | "dates" | "observations";

function categoryOf(f: FieldChange): Exclude<BlockKey, never> {
  if (f.field === "sale_price" || f.field === "par_price") return "prices";
  if (f.field === "start_date" || f.field === "end_date") return "dates";
  if (f.field === "observations") return "observations";
  return "relations";
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

// ---------------------------------------------------------------------------
// ChangesGroup — grupos B (publicadas) y C (en gestión).
// Default = aplicar. La acción es descartar; se puede revertir con "Incluir".
// ---------------------------------------------------------------------------

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
        if (!changes.some((c) => categoryOf(c) === filter)) return false;
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
      hint={`${changesCount} actualizaciones en ${positionsCount} posiciones. Se aplicarán al confirmar salvo las que descartes.`}
    >
      {rows.length === 0 ? (
        <EmptyGroup message={emptyMessage} />
      ) : (
        <div className="space-y-3">
          {/* Toolbar */}
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
              label="Todas"
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
                  Incluir todas ({positionsCount - activeCount})
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
                Descartar todas ({activeChangesCount})
              </Button>
            </div>
          </div>

          {/* Cards */}
          <div className="space-y-2">
            {visible.length === 0 ? (
              <p className="suma-caption text-text-tertiary px-1 py-4">
                Ninguna actualización coincide con el filtro.
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
// Card por posición
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
  const action = discarded
    ? `Incluir (${changes.length})`
    : `Descartar (${changes.length})`;

  return (
    <div
      className={cn(
        "rounded-lg border bg-white transition-colors",
        discarded ? "border-primary/20 bg-primary/[0.02]" : "border-border",
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 min-w-0 flex-col items-start text-left"
        >
          {/* Meta line */}
          <div className={cn("flex items-center gap-2 flex-wrap", discarded && "opacity-60")}>
            <span className="text-[11px] text-text-tertiary tabular-nums">
              #{row.sourceRow}
            </span>
            <span className="font-mono text-xs text-text-secondary">
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
          {/* Product name — protagonista */}
          {pos.erp_description && (
            <div
              className={cn(
                "mt-1 text-base font-bold uppercase tracking-wide text-text-primary line-clamp-1",
                discarded && "opacity-60",
              )}
            >
              {pos.erp_description}
            </div>
          )}
        </button>
        <div className="shrink-0 flex flex-col items-end gap-1">
          {discarded && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] font-semibold text-primary">
              Actualizaciones descartadas
            </span>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={discarded ? onRestore : onDiscard}
              className={cn(
                "text-xs transition-colors",
                discarded
                  ? "text-accent hover:text-accent/80 font-semibold"
                  : "text-text-tertiary hover:text-primary",
              )}
            >
              {action}
            </button>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-text-tertiary hover:text-text-primary"
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
        </div>
      </div>

      {open && (
        <div
          className={cn(
            "border-t border-border/60 px-4 pb-4 pt-4",
            discarded && "opacity-60",
          )}
        >
          <CardBody
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
// Body: Relaciones full-width arriba; resto rellena el ancho (1/2/3).
// ---------------------------------------------------------------------------

const REST_ORDER: Exclude<BlockKey, "relations">[] = [
  "prices",
  "dates",
  "observations",
];

const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-3",
};

function CardBody({
  pos,
  changes,
  clientsById,
}: {
  pos: PositionSnapshot;
  changes: FieldChange[];
  clientsById: Map<string, string>;
}) {
  const byCat = {
    prices: changes.filter((c) => categoryOf(c) === "prices"),
    dates: changes.filter((c) => categoryOf(c) === "dates"),
    observations: changes.filter((c) => categoryOf(c) === "observations"),
    relations: changes.filter((c) => categoryOf(c) === "relations"),
  };
  const rest = REST_ORDER.filter((k) => byCat[k].length > 0);
  const cols = GRID_COLS[rest.length] ?? GRID_COLS[3];

  return (
    <div className="space-y-3">
      {byCat.relations.length > 0 && (
        <RelationsBlock
          changes={byCat.relations}
          clientsById={clientsById}
        />
      )}
      {rest.length > 0 && (
        <div className={cn("grid gap-3", cols)}>
          {rest.map((key) =>
            key === "prices" ? (
              <PricesBlock key="prices" pos={pos} changes={byCat.prices} />
            ) : key === "dates" ? (
              <DatesBlock key="dates" pos={pos} changes={byCat.dates} />
            ) : (
              <ObservationsBlock
                key="observations"
                pos={pos}
                changes={byCat.observations}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bloque genérico
// ---------------------------------------------------------------------------

function BlockShell({
  Icon,
  label,
  counter,
  children,
  variant = "default",
}: {
  Icon: typeof Tag;
  label: string;
  counter?: string;
  children: React.ReactNode;
  variant?: "default" | "accent";
}) {
  const accent = variant === "accent";
  return (
    <section
      className={cn(
        "flex h-full flex-col rounded-md p-3",
        accent
          ? "bg-accent/[0.05] border border-accent/25"
          : "bg-muted/30 border border-transparent",
      )}
    >
      <header className="mb-2 flex items-start gap-2">
        <span
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded",
            accent ? "bg-accent/15 text-accent" : "bg-white text-text-secondary",
          )}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <div
            className={cn(
              "text-sm font-semibold leading-tight",
              accent ? "text-accent" : "text-text-primary",
            )}
          >
            {label}
          </div>
          {counter && (
            <div className="suma-caption text-text-tertiary leading-tight">
              {counter}
            </div>
          )}
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </section>
  );
}

// ---------- Helpers de conteo ----------

type Op = { kind: "cambio" | "nuevo" };

function opsFromPrice(changes: FieldChange[]): Op[] {
  const ops: Op[] = [];
  for (const c of changes) {
    if (c.field === "sale_price" || c.field === "par_price") {
      ops.push({ kind: c.from == null ? "nuevo" : "cambio" });
    }
  }
  return ops;
}

function opsFromDates(changes: FieldChange[]): Op[] {
  const ops: Op[] = [];
  for (const c of changes) {
    if (c.field === "start_date" || c.field === "end_date") {
      ops.push({ kind: c.from == null ? "nuevo" : "cambio" });
    }
  }
  return ops;
}

function opsFromObs(changes: FieldChange[]): Op[] {
  const ops: Op[] = [];
  for (const c of changes) {
    if (c.field === "observations") {
      ops.push({ kind: c.from == null ? "nuevo" : "cambio" });
    }
  }
  return ops;
}

function counterText(
  ops: Op[],
  gender: "m" | "f" = "m",
): string {
  const cambio = ops.filter((o) => o.kind === "cambio").length;
  const nuevo = ops.filter((o) => o.kind === "nuevo").length;
  const parts: string[] = [];
  if (cambio > 0) parts.push(`${cambio} ${cambio === 1 ? "cambio" : "cambios"}`);
  if (nuevo > 0) {
    const word =
      gender === "f"
        ? nuevo === 1
          ? "nueva"
          : "nuevas"
        : nuevo === 1
          ? "nuevo"
          : "nuevos";
    parts.push(`${nuevo} ${word}`);
  }
  return parts.join(" · ");
}

// ---------- Precios ----------

function PricesBlock({
  pos,
  changes,
}: {
  pos: PositionSnapshot;
  changes: FieldChange[];
}) {
  type PriceChange = { field: "sale_price" | "par_price"; from: number | null; to: number | null };
  const sale = changes.find(
    (c): c is PriceChange => c.field === "sale_price",
  );
  const par = changes.find(
    (c): c is PriceChange => c.field === "par_price",
  );

  const showPar = !!par || (pos.par_price != null && pos.par_price > 0);

  return (
    <BlockShell
      Icon={Tag}
      label="Precios de venta"
      counter={counterText(opsFromPrice(changes), "m")}
    >
      <div className="space-y-3 tabular-nums">
        <PriceLine
          label="Unidad"
          value={sale ? sale.to : pos.sale_price}
          previous={sale ? sale.from : null}
          state={sale ? (sale.from == null ? "new" : "changed") : "unchanged"}
        />
        {showPar && (
          <PriceLine
            label="Precio par"
            value={par ? par.to : pos.par_price}
            previous={par ? par.from : null}
            state={par ? (par.from == null ? "new" : "changed") : "unchanged"}
          />
        )}
      </div>
    </BlockShell>
  );
}

function PriceLine({
  label,
  value,
  previous,
  state,
}: {
  label: string;
  value: number | null;
  previous: number | null;
  state: "new" | "changed" | "unchanged";
}) {
  const isUnchanged = state === "unchanged";
  const isNew = state === "new";
  const pct = state === "changed" ? pctDelta(previous, value) : null;

  return (
    <div className={cn(isUnchanged && "opacity-50")}>
      <div className="suma-caption text-text-tertiary">{label}</div>
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "text-base font-bold",
            isUnchanged ? "text-text-tertiary" : "text-text-primary",
          )}
        >
          {value != null ? formatMoneyCOP(value) : "—"}
        </span>
        {pct != null && <DeltaPct pct={pct} />}
      </div>
      {isNew && <div className="mt-0.5 text-xs font-semibold text-accent">Nuevo</div>}
      {state === "changed" && previous != null && (
        <div className="mt-0.5 suma-caption text-text-tertiary">
          Antes: {formatMoneyCOP(previous)}
        </div>
      )}
      {isUnchanged && (
        <div className="mt-0.5 suma-caption text-text-tertiary">Sin cambios</div>
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
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
        up
          ? "bg-accent/10 text-accent"
          : "bg-orange-500/10 text-orange-600",
      )}
    >
      <span aria-hidden>{arrow}</span>
      {rounded}%
    </span>
  );
}

// ---------- Vigencias ----------

function DatesBlock({
  pos,
  changes,
}: {
  pos: PositionSnapshot;
  changes: FieldChange[];
}) {
  type DateChange = { field: "start_date" | "end_date"; from: string | null; to: string | null };
  const start = changes.find(
    (c): c is DateChange => c.field === "start_date",
  );
  const end = changes.find(
    (c): c is DateChange => c.field === "end_date",
  );

  const startValue = start ? start.to : pos.start_date;
  const endValue = end ? end.to : pos.end_date;
  const startState: DateState = start
    ? start.from == null
      ? "new"
      : "changed"
    : "unchanged";
  const endState: DateState = end
    ? end.from == null
      ? "new"
      : "changed"
    : "unchanged";

  // Ausencia crítica: hay op en la otra fecha y esta no existe ni en snapshot ni en archivo.
  const startMissing =
    startValue == null && (endState !== "unchanged");
  const endMissing =
    endValue == null && (startState !== "unchanged");

  return (
    <BlockShell
      Icon={Calendar}
      label="Vigencias"
      counter={counterText(opsFromDates(changes), "m")}
    >
      <div className="flex items-baseline gap-6 tabular-nums">
        <DateField
          label="Desde"
          value={startValue}
          previous={start ? start.from : null}
          state={startState}
          missing={startMissing}
          missingLabel="Sin fecha de inicio"
        />
        <span className="text-text-tertiary self-center -mx-3">→</span>
        <DateField
          label="Hasta"
          value={endValue}
          previous={end ? end.from : null}
          state={endState}
          missing={endMissing}
          missingLabel="Sin fecha fin"
        />
      </div>
    </BlockShell>
  );
}

type DateState = "new" | "changed" | "unchanged";

function DateField({
  label,
  value,
  previous,
  state,
  missing,
  missingLabel,
}: {
  label: string;
  value: string | null;
  previous: string | null;
  state: DateState;
  missing: boolean;
  missingLabel: string;
}) {
  const isUnchanged = state === "unchanged";
  const isNew = state === "new";
  return (
    <div className={cn(isUnchanged && !missing && "opacity-50")}>
      <div className="suma-caption text-text-tertiary">{label}</div>
      {missing ? (
        <div className="text-sm font-semibold text-primary">{missingLabel}</div>
      ) : (
        <div
          className={cn(
            "text-sm font-bold",
            isUnchanged ? "text-text-tertiary" : "text-text-primary",
          )}
        >
          {fmtDate(value)}
        </div>
      )}
      {isNew && !missing && (
        <div className="mt-0.5 text-xs font-semibold text-accent">Nuevo</div>
      )}
      {state === "changed" && previous != null && (
        <div className="mt-0.5 suma-caption text-text-tertiary">
          Antes: {fmtDate(previous)}
        </div>
      )}
      {isUnchanged && !missing && (
        <div className="mt-0.5 suma-caption text-text-tertiary">Sin cambios</div>
      )}
    </div>
  );
}

// ---------- Observaciones ----------

function ObservationsBlock({
  pos,
  changes,
}: {
  pos: PositionSnapshot;
  changes: FieldChange[];
}) {
  const [expanded, setExpanded] = useState(false);
  const obs = changes.find((c) => c.field === "observations") as
    | Extract<FieldChange, { field: "observations" }>
    | undefined;
  const to = obs ? obs.to : pos.observations;
  const from = obs ? obs.from : null;
  const isNew = obs ? obs.from == null : false;

  const showToggle = (to && to.length > 180) || (from && from.length > 180);

  return (
    <BlockShell
      Icon={AlignLeft}
      label="Observaciones"
      counter={counterText(opsFromObs(changes), "f")}
    >
      <div className="space-y-2">
        {isNew && (
          <div className="text-xs font-semibold text-accent">Nueva</div>
        )}
        <p
          className={cn(
            "text-sm text-text-primary leading-snug whitespace-pre-wrap",
            !expanded && "line-clamp-3",
          )}
        >
          {to || <span className="text-text-tertiary italic">vacío</span>}
        </p>
        {!isNew && from && (
          <>
            <p className="suma-caption text-text-tertiary">Antes</p>
            <p
              className={cn(
                "suma-caption text-text-tertiary leading-snug whitespace-pre-wrap",
                !expanded && "line-clamp-3",
              )}
            >
              {from}
            </p>
          </>
        )}
        {showToggle && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-semibold text-accent hover:text-accent/80"
          >
            {expanded ? "Ver menos" : "Ver más"}
          </button>
        )}
      </div>
    </BlockShell>
  );
}

// ---------- Relaciones ----------

function RelationsBlock({
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
    <BlockShell Icon={Link2} label="Relación" variant="accent">
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
              <span className="font-mono text-text-primary font-semibold">
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
    </BlockShell>
  );
}
