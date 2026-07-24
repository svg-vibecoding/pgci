import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import type {
  CatalogProduct,
  ClassifiedRow,
} from "@/lib/agreement-import";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatMoneyCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { GroupShell } from "../parts";
import type { DecisionsState } from "../state";
import { EmptyGroup } from "./Group1RequiresDecision";

/**
 * Group 4 — Nuevas posiciones.
 * Tabla densa, una fila por posición nueva. Escala a miles de filas.
 *
 * RN-IMP-07: NADA viene preseleccionado. El default es NO crear.
 * Crear posiciones nuevas requiere intención explícita del usuario.
 */

type FilterKey = "all" | "selected" | "discarded";

export function Group4NewPositions({
  rows,
  catalogBySku,
  decisions,
  icon,
}: {
  rows: ClassifiedRow[];
  catalogBySku: Map<string, CatalogProduct>;
  decisions: DecisionsState;
  icon?: ReactNode;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");

  const marked = useMemo(
    () =>
      rows.reduce(
        (n, r) =>
          n + (decisions.get(r.sourceRow).kind === "create_draft" ? 1 : 0),
        0,
      ),
    [rows, decisions],
  );
  const discarded = rows.length - marked;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const d = decisions.get(r.sourceRow);
      const isSelected = d.kind === "create_draft";
      if (filter === "selected" && !isSelected) return false;
      if (filter === "discarded" && isSelected) return false;
      if (!q) return true;
      const sku = r.row.sku ?? "";
      const cat = sku ? catalogBySku.get(sku) : undefined;
      const hay = [
        sku,
        cat?.commercial_brand ?? "",
        cat?.erp_description ?? "",
        r.row.client_code ?? "",
        r.row.client_description ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, filter, query, decisions, catalogBySku]);

  return (
    <GroupShell
      id="g4"
      icon={icon}
      title="Nuevas posiciones"
      count={rows.length}
      hint="Estas filas pueden crearse como posiciones del acuerdo. Las que selecciones quedarán en gestión, listas para completar y publicar."
      headerRight={
        rows.length > 0 ? (
          <span className="suma-caption text-text-tertiary tabular-nums font-normal">
            <span className="font-semibold text-text-primary">{rows.length}</span>{" "}
            {rows.length === 1 ? "posición nueva" : "posiciones nuevas"}{" "}
            <span className="text-text-tertiary">·</span>{" "}
            <span className="font-semibold text-text-primary">{marked}</span>{" "}
            se {marked === 1 ? "creará" : "crearán"}
          </span>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <EmptyGroup message="Todas las filas del archivo corresponden a posiciones existentes." />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-sm">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busca por código o descripción Jaivaná…"
                className="h-9 pl-8 text-[13px]"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => decisions.setMany(rows, { kind: "ignore" })}
                disabled={marked === 0}
              >
                Descartar todas
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  decisions.setMany(rows, { kind: "create_draft" })
                }
                disabled={discarded === 0}
              >
                Crear todas
              </Button>
            </div>
          </div>

          <div className="border-b border-border/60">
            <div className="flex items-center gap-1">
              <FilterTab
                active={filter === "all"}
                onClick={() => setFilter("all")}
                label="Todas"
                count={rows.length}
              />
              <FilterTab
                active={filter === "selected"}
                onClick={() => setFilter("selected")}
                label="Se crearán"
                count={marked}
              />
              <FilterTab
                active={filter === "discarded"}
                onClick={() => setFilter("discarded")}
                label="Descartadas"
                count={discarded}
              />
            </div>
          </div>

          <div className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-page">
                <tr className="border-b border-border text-left">
                  <th scope="col" className="suma-body w-10 px-4 py-2.5 text-center font-normal text-text-tertiary">-</th>
                  <th scope="col" className="suma-body px-4 py-2.5 font-normal text-text-tertiary whitespace-nowrap">Sumatec</th>
                  <th scope="col" className="suma-body px-4 py-2.5 font-normal text-text-tertiary whitespace-nowrap">Código del cliente</th>
                  <th scope="col" className="suma-body px-4 py-2.5 font-normal text-right whitespace-nowrap text-text-tertiary">
                    Vigencia
                  </th>
                  <th scope="col" className="suma-body px-4 py-2.5 font-normal text-right whitespace-nowrap text-text-tertiary">
                    Precios de venta
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center">
                      <p className="suma-caption text-text-tertiary">
                        {query
                          ? "Sin resultados para tu búsqueda."
                          : filter === "selected"
                            ? "Aún no has marcado ninguna."
                            : "No hay posiciones descartadas."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <PositionRow
                      key={r.sourceRow}
                      row={r}
                      catalog={
                        r.row.sku ? catalogBySku.get(r.row.sku) : undefined
                      }
                      decisions={decisions}
                    />
                  ))
                )}
              </tbody>
            </table>
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
        "relative px-3 py-2 text-[13px] transition-colors -mb-px border-b-2",
        active
          ? "text-text-primary font-semibold border-text-primary"
          : "text-text-tertiary hover:text-text-primary font-normal border-transparent",
      )}
    >
      {label}{" "}
      <span className="tabular-nums font-normal opacity-70">({count})</span>
    </button>
  );
}

function PositionRow({
  row,
  catalog,
  decisions,
}: {
  row: ClassifiedRow;
  catalog: CatalogProduct | undefined;
  decisions: DecisionsState;
}) {
  const decision = decisions.get(row.sourceRow);
  const willCreate = decision.kind === "create_draft";
  const sku = row.row.sku ?? null;
  const brand = catalog?.commercial_brand ?? null;
  const description = catalog?.erp_description ?? null;
  const clientCode = row.row.client_code ?? null;
  const clientDesc = row.row.client_description ?? null;
  const start = row.row.start_date;
  const end = row.row.end_date;
  const sale = row.row.sale_price;
  const par = row.row.par_price;
  const obs = row.row.observations?.trim() || null;

  const toggle = () =>
    decisions.set(row.sourceRow, {
      kind: willCreate ? "ignore" : "create_draft",
    });

  // Spacer que mimetiza la altura de la primera línea del bloque Sumatec
  // (SKU + meta) para anclar el contenido de las columnas de un solo valor
  // con la SEGUNDA línea (descripción), no con el SKU.
  const rowSpacer = (
    <div aria-hidden className="text-[13px] leading-[1.5]">&nbsp;</div>
  );

  return (
    <>
      <tr className={cn("align-top border-b border-border/60", obs && "!border-b-0")}>
        <td className="w-10 px-3 py-3">
          <Checkbox
            checked={willCreate}
            onCheckedChange={toggle}
            aria-label="Crear como borrador"
          />
        </td>
        <td className="px-2 py-3">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[11px] text-text-tertiary tabular-nums">
              #{row.sourceRow}
            </span>
            <span className="text-text-tertiary">{"\n"}</span>
            <span className="font-mono text-[13px] font-semibold text-text-primary">
              {sku || "—"}
            </span>
            {brand && (
              <span className="ml-1 text-[11px] font-semibold uppercase tracking-wide text-accent">
                {brand}
              </span>
            )}
          </div>
          {description && (
            <div className="text-[13px] font-normal text-text-primary line-clamp-2 max-w-[42ch] uppercase">
              {description}
            </div>
          )}
        </td>
        <td className="px-2 py-3">
          {clientCode ? (
            <>
              <div className="font-mono text-[13px] font-semibold text-text-primary">
                {clientCode}
              </div>
              {clientDesc && (
                <div className="text-[13px] font-normal text-text-primary line-clamp-2 max-w-[32ch] uppercase">
                  {clientDesc}
                </div>
              )}
            </>
          ) : (
            <>
              {rowSpacer}
              <span className="text-text-tertiary">—</span>
            </>
          )}
        </td>
        <td className="px-2 py-3 whitespace-nowrap tabular-nums text-[13px] text-text-primary text-right">
          {rowSpacer}
          {start || end ? (
            <>
              {fmtDate(start)} <span className="text-text-tertiary">→</span>{" "}
              {fmtDate(end)}
            </>
          ) : (
            <span className="text-text-tertiary">—</span>
          )}
        </td>
        <td className="px-2 py-3 whitespace-nowrap tabular-nums text-right">
          {rowSpacer}
          {sale != null ? (
            <div className="text-[13px] font-semibold text-text-primary">
              {formatMoneyCOP(sale)}
            </div>
          ) : (
            <span className="text-text-tertiary">-</span>
          )}
          {par != null && par > 0 && (
            <div className="text-[12px] text-text-secondary">
              <span className="mr-1">Par</span>
              {formatMoneyCOP(par)}
            </div>
          )}
        </td>
      </tr>
      {obs && (
        <tr className="align-top border-b border-border/60">
          <td />
          <td colSpan={4} className="px-2 pb-3 pt-0">
            <div className="text-[12.5px] text-text-secondary">
              <div className="font-semibold text-text-primary mb-0.5">
                Observaciones:
              </div>
              {obs}
            </div>
          </td>
        </tr>
      )}
    </>
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
