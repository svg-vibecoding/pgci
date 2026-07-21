import { useMemo, useState } from "react";
import type {
  ClassifiedRow,
  FieldChange,
  PositionSnapshot,
} from "@/lib/agreement-import";
import { Button } from "@/components/ui/button";
import {
  GroupShell,
  ChangeKindChip,
  ChangesInline,
  ReportTable,
  Th,
  ProductCell,
  StatusCell,
  PriceCell,
  DateRangeCell,
} from "../parts";
import type { DecisionsState } from "../state";
import { EmptyGroup } from "./Group1RequiresDecision";

type FilterKey = "all" | "sale_price" | "par_price" | "dates" | "observations";

function matches(ch: FieldChange[], f: FilterKey): boolean {
  if (f === "all") return true;
  if (f === "sale_price") return ch.some((c) => c.field === "sale_price");
  if (f === "par_price") return ch.some((c) => c.field === "par_price");
  if (f === "dates")
    return ch.some((c) => c.field === "start_date" || c.field === "end_date");
  if (f === "observations") return ch.some((c) => c.field === "observations");
  return true;
}

export function Group2ModifiesPublished({
  rows,
  positionsById,
  decisions,
}: {
  rows: ClassifiedRow[];
  positionsById: Map<string, PositionSnapshot>;
  decisions: DecisionsState;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const counts = useMemo(() => {
    const c = { sale_price: 0, par_price: 0, dates: 0, observations: 0 };
    for (const r of rows) {
      const ch = r.changes ?? [];
      if (ch.some((x) => x.field === "sale_price")) c.sale_price++;
      if (ch.some((x) => x.field === "par_price")) c.par_price++;
      if (ch.some((x) => x.field === "start_date" || x.field === "end_date"))
        c.dates++;
      if (ch.some((x) => x.field === "observations")) c.observations++;
    }
    return c;
  }, [rows]);

  const visible = rows.filter((r) => matches(r.changes ?? [], filter));

  return (
    <GroupShell
      title="Modifican posiciones publicadas"
      count={rows.length}
      hint="Cambian datos de posiciones activas, en revisión o excluidas. Por defecto se aplicarán."
      toolbar={
        <>
          <ChangeKindChip active={filter === "all"} onClick={() => setFilter("all")}>
            Todas
          </ChangeKindChip>
          <ChangeKindChip
            active={filter === "sale_price"}
            onClick={() => setFilter("sale_price")}
            count={counts.sale_price}
          >
            Precio venta
          </ChangeKindChip>
          <ChangeKindChip
            active={filter === "par_price"}
            onClick={() => setFilter("par_price")}
            count={counts.par_price}
          >
            Precio par
          </ChangeKindChip>
          <ChangeKindChip
            active={filter === "dates"}
            onClick={() => setFilter("dates")}
            count={counts.dates}
          >
            Vigencias
          </ChangeKindChip>
          <ChangeKindChip
            active={filter === "observations"}
            onClick={() => setFilter("observations")}
            count={counts.observations}
          >
            Observaciones
          </ChangeKindChip>
        </>
      }
    >
      {rows.length === 0 ? (
        <EmptyGroup message="Sin cambios sobre posiciones publicadas." />
      ) : (
        <ReportTable
          head={
            <>
              <Th>Producto</Th>
              <Th>Estado</Th>
              <Th align="right">Precio actual</Th>
              <Th>Vigencia actual</Th>
              <Th>Cambios propuestos</Th>
              <Th align="right">Acción</Th>
            </>
          }
        >
          {visible.map((r) => {
            const pos = r.resolvedPositionId
              ? positionsById.get(r.resolvedPositionId)
              : undefined;
            if (!pos) return null;
            const decision = decisions.get(r.sourceRow);
            const excluded = decision.kind === "ignore";
            return (
              <tr key={r.sourceRow} className={excluded ? "" : ""}>
                <ProductCell
                  sku={pos.sku}
                  brand={pos.commercial_brand}
                  description={pos.commercial_description}
                  sourceRow={r.sourceRow}
                  muted={excluded}
                />
                <StatusCell status={pos.status} muted={excluded} />
                <PriceCell value={pos.sale_price} muted={excluded} />
                <DateRangeCell
                  start={pos.start_date}
                  end={pos.end_date}
                  muted={excluded}
                />
                <td className={"px-2 py-1.5 align-top " + (excluded ? "opacity-60" : "")}>
                  <ChangesInline changes={r.changes ?? []} />
                </td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap">
                  {excluded ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => decisions.set(r.sourceRow, { kind: "apply" })}
                    >
                      Reincluir
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => decisions.set(r.sourceRow, { kind: "ignore" })}
                    >
                      Excluir
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </ReportTable>
      )}
    </GroupShell>
  );
}
