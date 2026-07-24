import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import type { CellError, ClassifiedRow } from "@/lib/agreement-import";
import { CANONICAL_HEADERS } from "@/lib/agreement-import";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  GroupShell,
  ReportTable,
  Th,
  FilterTab,
  FilterTabsBar,
} from "../parts";
import { EmptyGroup } from "./Group1RequiresDecision";

/**
 * Group 6 — Filas no procesables.
 *
 * Agrupa POR FILA del archivo (no por error). Cada fila puede tener varios
 * problemas. Los problemas de SKU (sku_not_in_catalog / no_anchor) afectan
 * a la fila entera y ocultan cualquier otro problema — si el producto no
 * existe, señalar el precio no aporta.
 */

type FilterKey = "all" | "sku" | "dates" | "prices";

type SkuProblem = { kind: "sku"; description: string };
type CellProblem = {
  kind: "cell";
  field: CellError["field"];
  fieldLabel: string;
  reason: string; // "no reconocida" | "no reconocido"
  rawValue: string;
};
type Problem = SkuProblem | CellProblem;

function reasonPhrase(field: CellError["field"], raw: string): string {
  // Concordancia: fechas → "no reconocida", precios → "no reconocido".
  const s = raw.toLowerCase();
  if (s.includes("fecha")) return "no reconocida";
  if (s.includes("precio")) return "no reconocido";
  // Fallback por si el motor introduce nuevos motivos.
  return field === "start_date" || field === "end_date"
    ? "no reconocida"
    : "no reconocido";
}

function rowProblems(r: ClassifiedRow): Problem[] {
  if (r.reason === "no_anchor") {
    return [{ kind: "sku", description: "SKU no asignado" }];
  }
  if (r.reason === "sku_not_in_catalog") {
    return [{ kind: "sku", description: "SKU no identificado en el catálogo" }];
  }
  const errs = r.row.cellErrors ?? [];
  return errs.map<Problem>((e) => ({
    kind: "cell",
    field: e.field,
    fieldLabel: CANONICAL_HEADERS[e.field],
    reason: reasonPhrase(e.field, e.reason),
    rawValue: e.rawValue ?? "",
  }));
}

function hasKind(problems: Problem[], kind: FilterKey): boolean {
  if (kind === "sku") return problems.some((p) => p.kind === "sku");
  if (kind === "dates")
    return problems.some(
      (p) =>
        p.kind === "cell" &&
        (p.field === "start_date" || p.field === "end_date"),
    );
  if (kind === "prices")
    return problems.some(
      (p) =>
        p.kind === "cell" &&
        (p.field === "sale_price" || p.field === "par_price"),
    );
  return true;
}

export function Group6NotProcessable({
  rows,
  icon,
}: {
  rows: ClassifiedRow[];
  icon?: React.ReactNode;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const enriched = useMemo(
    () => rows.map((r) => ({ row: r, problems: rowProblems(r) })),
    [rows],
  );

  const counts = useMemo(() => {
    let sku = 0;
    let dates = 0;
    let prices = 0;
    for (const { problems } of enriched) {
      if (hasKind(problems, "sku")) sku++;
      if (hasKind(problems, "dates")) dates++;
      if (hasKind(problems, "prices")) prices++;
    }
    return { sku, dates, prices };
  }, [enriched]);

  const visible = enriched.filter(({ problems }) => hasKind(problems, filter));

  function downloadXlsx() {
    const data = enriched.map(({ row, problems }) => ({
      Fila: row.sourceRow,
      [CANONICAL_HEADERS.sku]: row.row.sku ?? "",
      [CANONICAL_HEADERS.client_code]: row.row.client_code ?? "",
      Motivos: problems
        .map((p) =>
          p.kind === "sku"
            ? p.description
            : `${p.fieldLabel}: ${p.reason}${p.rawValue ? ` (${p.rawValue})` : ""}`,
        )
        .join(" · "),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "No procesables");
    XLSX.writeFile(wb, "filas_no_procesables.xlsx");
  }

  return (
    <GroupShell
      id="g6"
      icon={icon}
      title="Filas no procesables"
      count={rows.length}
      hint="Filas del archivo que el sistema no logra clasificar para importar. Resuelve las inconsistencias para actualizar."
      tone="muted"
    >
      {rows.length === 0 ? (
        <EmptyGroup message="Todas las filas se pudieron procesar." />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FilterTabsBar>
              <FilterTab
                active={filter === "all"}
                onClick={() => setFilter("all")}
                label="Todas"
                count={rows.length}
              />
              <FilterTab
                active={filter === "sku"}
                onClick={() => setFilter("sku")}
                label="Código Jaivaná"
                count={counts.sku}
              />
              <FilterTab
                active={filter === "dates"}
                onClick={() => setFilter("dates")}
                label="Fechas"
                count={counts.dates}
              />
              <FilterTab
                active={filter === "prices"}
                onClick={() => setFilter("prices")}
                label="Precios"
                count={counts.prices}
              />
            </FilterTabsBar>
            <Button size="sm" variant="outline" onClick={downloadXlsx}>
              <Download className="mr-1 h-3.5 w-3.5" /> Descargar Excel
            </Button>
          </div>

          <ReportTable
            head={
              <>
                <Th className="w-[220px]">Fila en archivo</Th>
                <Th>Detalles</Th>
              </>
            }
          >
            {visible.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-8 text-center">
                  <p className="suma-caption text-text-tertiary">
                    No hay filas en este filtro.
                  </p>
                </td>
              </tr>
            ) : (
              visible.map(({ row, problems }) => (
                <tr
                  key={row.sourceRow}
                  className="border-b border-border/60 bg-card last:border-b-0 hover:bg-surface-page"
                >
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-baseline gap-2">
                      <span className="tabular-nums text-[11px] text-text-tertiary">
                        Fila
                      </span>
                      <span className="tabular-nums text-[13px] font-semibold text-text-primary">
                        #{row.sourceRow}
                      </span>
                    </div>
                    <div className="mt-0.5 font-mono text-[12.5px] text-text-secondary">
                      {row.row.client_code || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <ul className="space-y-1">
                      {problems.map((p, i) => (
                        <li
                          key={i}
                          className="text-[13px] leading-[1.4] text-text-primary"
                        >
                          {p.kind === "sku" ? (
                            <span>{p.description}</span>
                          ) : (
                            <ProblemLine
                              label={p.fieldLabel}
                              reason={p.reason}
                              rawValue={p.rawValue}
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))
            )}
          </ReportTable>
        </div>
      )}
    </GroupShell>
  );
}

function ProblemLine({
  label,
  reason,
  rawValue,
}: {
  label: string;
  reason: string;
  rawValue: string;
}) {
  return (
    <span>
      <span className="text-text-tertiary">·</span>{" "}
      <span className="font-semibold text-text-primary">{label}</span>
      <span className="text-text-secondary">: {reason}</span>
      {rawValue && (
        <>
          <span className="text-text-tertiary"> · </span>
          <span
            className={cn(
              "font-mono font-semibold text-text-primary break-all",
            )}
          >
            {rawValue}
          </span>
        </>
      )}
    </span>
  );
}
