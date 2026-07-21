import type {
  ClassifiedRow,
  PositionSnapshot,
} from "@/lib/agreement-import";
import { Button } from "@/components/ui/button";
import { PositionCard } from "@/components/agreements/PositionCard";
import { GroupShell, ChangesBlock } from "../parts";
import type { DecisionsState } from "../state";
import { EmptyGroup } from "./Group1RequiresDecision";

export function Group3DraftsAndCodes({
  rows,
  positionsById,
  decisions,
}: {
  rows: ClassifiedRow[];
  positionsById: Map<string, PositionSnapshot>;
  decisions: DecisionsState;
}) {
  const drafts: ClassifiedRow[] = [];
  const newCodes: ClassifiedRow[] = [];
  for (const r of rows) {
    const pos = r.resolvedPositionId
      ? positionsById.get(r.resolvedPositionId)
      : undefined;
    if (pos?.status === "draft") drafts.push(r);
    else newCodes.push(r);
  }

  return (
    <GroupShell
      title="Modifican gestión / agregan códigos"
      count={rows.length}
      hint="Completan borradores o agregan un nuevo código a una posición existente. Se aplican por defecto."
    >
      {rows.length === 0 ? (
        <EmptyGroup message="Sin cambios en gestión ni códigos nuevos." />
      ) : (
        <div className="space-y-5">
          {drafts.length > 0 && (
            <Sub
              title="Completan borradores"
              rows={drafts}
              positionsById={positionsById}
              decisions={decisions}
            />
          )}
          {newCodes.length > 0 && (
            <Sub
              title="Agregan código a posición existente"
              rows={newCodes}
              positionsById={positionsById}
              decisions={decisions}
            />
          )}
        </div>
      )}
    </GroupShell>
  );
}

function Sub({
  title,
  rows,
  positionsById,
  decisions,
}: {
  title: string;
  rows: ClassifiedRow[];
  positionsById: Map<string, PositionSnapshot>;
  decisions: DecisionsState;
}) {
  return (
    <div>
      <h4 className="suma-caption text-text-tertiary uppercase tracking-wide mb-2">
        {title} ({rows.length})
      </h4>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((r) => {
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
              tone={excluded ? "muted" : "info"}
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
    </div>
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
