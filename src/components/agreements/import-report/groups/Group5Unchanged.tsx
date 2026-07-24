import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type {
  ClassifiedRow,
  PositionSnapshot,
} from "@/lib/agreement-import";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMoneyCOP, formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  GroupShell,
  ReportTable,
  Th,
  FilterTab,
  FilterTabsBar,
  StatusCell,
} from "../parts";
import { EmptyGroup } from "./Group1RequiresDecision";

/**
 * Group 5 — Sin cambios.
 *
 * Hereda la tabla de "Nuevas posiciones" pero:
 *  - Sin checkbox de selección.
 *  - Sin acciones (fila ni bloque). Nada que decidir.
 *  - Datos de la POSICIÓN existente (no del archivo).
 *
 * UI-only: distingue "Filas iguales" vs "Filas sin datos" derivando de
 * los valores del ParsedRow (todas las columnas presentes salvo SKU
 * vienen vacías → "sin datos"). No toca el motor.
 *
 * Volumen: puede llegar a miles. Renderiza 25 y crece con "Ver más".
 * El buscador filtra sobre el conjunto completo en memoria.
 */

type FilterKey = "all" | "equal" | "empty";
const PAGE_SIZE = 25;

function isEmptyRow(r: ClassifiedRow): boolean {
  const row = r.row;
  return (
    !row.client_code &&
    !row.client_description &&
    row.sale_price == null &&
    row.par_price == null &&
    !row.start_date &&
    !row.end_date &&
    !(row.observations && row.observations.trim().length > 0)
  );
}

export function Group5Unchanged({
  rows,
  positionsById,
  icon,
}: {
  rows: ClassifiedRow[];
  positionsById: Map<string, PositionSnapshot>;
  icon?: React.ReactNode;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const { equalRows, emptyRows } = useMemo(() => {
    const eq: ClassifiedRow[] = [];
    const em: ClassifiedRow[] = [];
    for (const r of rows) (isEmptyRow(r) ? em : eq).push(r);
    return { equalRows: eq, emptyRows: em };
  }, [rows]);

  const filtered = useMemo(() => {
    const base =
      filter === "equal" ? equalRows : filter === "empty" ? emptyRows : rows;
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((r) => {
      const pos = r.resolvedPositionId
        ? positionsById.get(r.resolvedPositionId)
        : undefined;
      const hay = [
        r.row.sku ?? pos?.sku ?? "",
        pos?.commercial_brand ?? "",
        pos?.erp_description ?? "",
        r.row.client_code ?? "",
        r.row.client_description ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, equalRows, emptyRows, filter, query, positionsById]);

  // Reset paginación al cambiar filtro o búsqueda.
  const pageKey = `${filter}|${query}`;
  const [lastKey, setLastKey] = useState(pageKey);
  if (lastKey !== pageKey) {
    setLastKey(pageKey);
    setVisible(PAGE_SIZE);
  }

  const shown = filtered.slice(0, visible);
  const hasMore = filtered.length > shown.length;

  return (
    <GroupShell
      id="g5"
      icon={icon}
      title="Sin cambios"
      count={rows.length}
      hint="Filas del archivo que no aportan cambios: coinciden con la posición actual, o traen código Jaivaná pero sin datos que actualizar."
      tone="muted"
    >
      {rows.length === 0 ? (
        <EmptyGroup message="Todas las filas del archivo traen cambios." />
      ) : (
        <div className="space-y-3">
          <div className="relative w-full max-w-sm">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca por código o descripción…"
              className="h-9 pl-8 text-[13px]"
            />
          </div>

          <FilterTabsBar>
            <FilterTab
              active={filter === "all"}
              onClick={() => setFilter("all")}
              label="Todas"
              count={rows.length}
            />
            <FilterTab
              active={filter === "equal"}
              onClick={() => setFilter("equal")}
              label="Filas iguales"
              count={equalRows.length}
            />
            <FilterTab
              active={filter === "empty"}
              onClick={() => setFilter("empty")}
              label="Filas sin datos"
              count={emptyRows.length}
            />
          </FilterTabsBar>

          <ReportTable
            head={
              <>
                <Th>Sumatec</Th>
                <Th>Código del cliente</Th>
                <Th align="right">Vigencia</Th>
                <Th align="right">Precios de venta</Th>
                <Th>Estado</Th>
              </>
            }
          >
            {shown.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center">
                  <p className="suma-caption text-text-tertiary">
                    {query
                      ? "Sin resultados para tu búsqueda."
                      : "No hay filas en este filtro."}
                  </p>
                </td>
              </tr>
            ) : (
              shown.map((r) => (
                <UnchangedRow
                  key={r.sourceRow}
                  row={r}
                  position={
                    r.resolvedPositionId
                      ? positionsById.get(r.resolvedPositionId)
                      : undefined
                  }
                />
              ))
            )}
          </ReportTable>

          <div className="flex items-center justify-between gap-3">
            <span className="suma-caption text-text-tertiary tabular-nums">
              <span className="font-semibold text-text-primary">
                {shown.length}
              </span>{" "}
              de{" "}
              <span className="font-semibold text-text-primary">
                {filtered.length}
              </span>
            </span>
            {hasMore && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
              >
                Ver más…
              </Button>
            )}
          </div>
        </div>
      )}
    </GroupShell>
  );
}

function UnchangedRow({
  row,
  position,
}: {
  row: ClassifiedRow;
  position: PositionSnapshot | undefined;
}) {
  const sku = row.row.sku ?? position?.sku ?? null;
  const brand = position?.commercial_brand ?? null;
  const description = position?.erp_description ?? null;
  const clientCode = row.row.client_code ?? null;
  const clientDesc = row.row.client_description ?? null;
  const start = position?.start_date ?? null;
  const end = position?.end_date ?? null;
  const sale = position?.sale_price ?? null;
  const par = position?.par_price ?? null;
  const obs =
    position?.observations?.trim() || row.row.observations?.trim() || null;

  const singleLinePad = "pt-5";

  return (
    <>
      <tr
        className={cn(
          "border-b border-border/60 bg-card hover:bg-surface-page",
          obs && "!border-b-0",
        )}
      >
        <td className="px-4 py-3 align-top">
          <div className="mb-0.5 flex items-center gap-2 text-[11px]">
            <span className="tabular-nums text-text-tertiary">
              #{row.sourceRow}
            </span>
            <span className="font-mono text-[12.5px] font-semibold text-text-primary">
              {sku || "—"}
            </span>
            {brand && (
              <span className="font-semibold uppercase tracking-wide text-accent">
                {brand}
              </span>
            )}
          </div>
          {description && (
            <div className="text-[13px] font-normal leading-[1.35] text-text-primary line-clamp-2 max-w-[42ch]">
              {description}
            </div>
          )}
        </td>
        <td className="px-4 py-3 align-top">
          {clientCode ? (
            <>
              <div className="font-mono text-[12.5px] font-semibold text-text-primary">
                {clientCode}
              </div>
              {clientDesc && (
                <div className="text-[13px] font-normal leading-[1.35] text-text-primary line-clamp-2 max-w-[32ch]">
                  {clientDesc}
                </div>
              )}
            </>
          ) : (
            <span className={cn("block text-text-tertiary", singleLinePad)}>
              —
            </span>
          )}
        </td>
        <td
          className={cn(
            "whitespace-nowrap px-4 py-3 text-right align-top tabular-nums text-[13px] text-text-primary",
            singleLinePad,
          )}
        >
          {start || end ? (
            <>
              {formatDateShort(start)}{" "}
              <span className="text-text-tertiary">→</span>{" "}
              {formatDateShort(end)}
            </>
          ) : (
            <span className="text-text-tertiary">—</span>
          )}
        </td>
        <td
          className={cn(
            "whitespace-nowrap px-4 py-3 text-right align-top tabular-nums",
            singleLinePad,
          )}
        >
          {sale != null ? (
            <div className="text-[13px] font-semibold text-text-primary">
              {formatMoneyCOP(sale)}
            </div>
          ) : (
            <span className="text-text-tertiary">—</span>
          )}
          {par != null && par > 0 && (
            <div className="text-[12px] text-text-secondary">
              <span className="mr-1">Par</span>
              {formatMoneyCOP(par)}
            </div>
          )}
        </td>
        <StatusCell status={position?.status} />
      </tr>
      {obs && (
        <tr className="border-b border-border/60 bg-card">
          <td colSpan={5} className="px-4 pb-3 pt-0">
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
