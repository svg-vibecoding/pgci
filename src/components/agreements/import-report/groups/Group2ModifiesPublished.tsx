import { useMemo, useState } from "react";
import type {
  ClassifiedRow,
  FieldChange,
  PositionSnapshot,
} from "@/lib/agreement-import";
import { Button } from "@/components/ui/button";
import { PositionCard } from "@/components/agreements/PositionCard";
import { GroupShell, ChangeKindChip, ChangesBlock } from "../parts";
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
          <ChangeKindChip
            active={filter === "all"}
            onClick={() => setFilter("all")}
          >
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
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((r) => {
            const pos = r.resolvedPositionId
              ? positionsById.get(r.resolvedPositionId)
              : undefined;
            if (!pos) return null;
            const decision = decisions.get(r.sourceRow);
            const excluded = decision.kind === "ignore";
            return (
              <PositionCard
                key={r.sourceRow}
                status={statusToBadge(pos.status)}
                statusLabel={statusLabel(pos.status)}
                startDate={pos.start_date}
                endDate={pos.end_date}
                price={pos.sale_price}
                parPrice={pos.par_price}
                sku={pos.sku}
                tone={excluded ? "muted" : "default"}
                className={excluded ? "opacity-60" : ""}
                footer={
                  <>
                    <span className="text-[11px] text-text-tertiary mr-auto">
                      Fila {r.sourceRow}
                    </span>
                    {excluded ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          decisions.set(r.sourceRow, { kind: "apply" })
                        }
                      >
                        Reincluir
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          decisions.set(r.sourceRow, { kind: "ignore" })
                        }
                      >
                        Excluir
                      </Button>
                    )}
                  </>
                }
              >
                {r.changes && r.changes.length > 0 && (
                  <ChangesBlock changes={r.changes} />
                )}
              </PositionCard>
            );
          })}
        </div>
      )}
    </GroupShell>
  );
}

function statusToBadge(s: string) {
  if (s === "active") return "active" as const;
  if (s === "requires_review") return "review" as const;
  if (s === "excluded") return "danger" as const;
  if (s === "draft") return "pending" as const;
  return "neutral" as const;
}
function statusLabel(s: string) {
  if (s === "active") return "Activa";
  if (s === "requires_review") return "En revisión";
  if (s === "excluded") return "Excluida";
  if (s === "draft") return "Borrador";
  return s;
}
