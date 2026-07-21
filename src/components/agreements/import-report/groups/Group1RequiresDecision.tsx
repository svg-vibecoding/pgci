import { useState } from "react";
import type {
  CatalogProduct,
  ClassifiedRow,
  DiffResult,
} from "@/lib/agreement-import";
import { Chip } from "@/components/sumatec";
import { Button } from "@/components/ui/button";
import { PositionCard } from "@/components/agreements/PositionCard";
import { GroupShell } from "../parts";
import type { DecisionsState } from "../state";

const REASON_LABEL: Record<string, string> = {
  sku_in_multiple_positions: "SKU en múltiples posiciones",
  code_sku_mismatch: "Código y SKU no coinciden",
  client_code_replace: "El código cliente ya está en otra posición",
  duplicate_in_file: "Duplicado en el archivo",
};

export function Group1RequiresDecision({
  rows,
  catalogBySku,
  decisions,
}: {
  rows: ClassifiedRow[];
  catalogBySku: Map<string, CatalogProduct>;
  decisions: DecisionsState;
  result: DiffResult;
}) {
  return (
    <GroupShell
      title="Requieren decisión"
      count={rows.length}
      hint="El archivo no permite resolver estas filas por sí solo. Elige qué hacer con cada una."
      toolbar={
        rows.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              decisions.setMany(rows, { kind: "ignore" })
            }
          >
            Ignorar todas
          </Button>
        )
      }
    >
      {rows.length === 0 ? (
        <EmptyGroup message="No hay filas que requieran decisión." />
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <DecisionItem
              key={r.sourceRow}
              row={r}
              catalogBySku={catalogBySku}
              decisions={decisions}
            />
          ))}
        </ul>
      )}
    </GroupShell>
  );
}

function DecisionItem({
  row,
  catalogBySku,
  decisions,
}: {
  row: ClassifiedRow;
  catalogBySku: Map<string, CatalogProduct>;
  decisions: DecisionsState;
}) {
  const [expanded, setExpanded] = useState(true);
  const decision = decisions.get(row.sourceRow);
  const sku = row.row.sku ?? null;
  // Catalog lookup returns product_id but no name/description; keep placeholders.
  const catalog = sku ? catalogBySku.get(sku) : undefined;
  const reasonLabel = row.reason
    ? REASON_LABEL[row.reason] ?? row.reason
    : "Requiere decisión";

  return (
    <li className="rounded-lg border border-warning/40 bg-warning/5">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 border-b border-warning/30">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-text-tertiary">
              Fila {row.sourceRow}
            </span>
            <Chip color="warning" variant="soft" size="small">
              {reasonLabel}
            </Chip>
          </div>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold text-foreground">
              {sku ?? "—"}
            </span>
            {catalog && (
              <span className="suma-caption text-text-tertiary">
                en catálogo
              </span>
            )}
            {row.row.client_code && (
              <span className="font-mono text-sm text-text-secondary">
                · {row.row.client_code}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DecisionChip decision={decision} />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Ocultar" : "Ver opciones"}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-3">
          {row.candidates && row.candidates.length > 0 ? (
            <>
              <p className="suma-caption text-text-secondary">
                Este SKU tiene {row.candidates.length}{" "}
                {row.candidates.length === 1 ? "posición" : "posiciones"} en el
                acuerdo. Elige a cuál aplicar la fila del archivo.
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {row.candidates.map((c) => {
                  const isChosen =
                    decision.kind === "apply_to_candidate" &&
                    decision.positionId === c.position_id;
                  return (
                    <PositionCard
                      key={c.position_id}
                      status={statusToBadge(c.status)}
                      statusLabel={statusLabel(c.status)}
                      startDate={c.start_date}
                      endDate={c.end_date}
                      price={c.sale_price}
                      parPrice={c.par_price}
                      tone={isChosen ? "info" : "default"}
                      footer={
                        <Button
                          type="button"
                          size="sm"
                          variant={isChosen ? "default" : "outline"}
                          onClick={() =>
                            decisions.set(row.sourceRow, {
                              kind: "apply_to_candidate",
                              positionId: c.position_id,
                            })
                          }
                        >
                          {isChosen ? "✓ Aplicar aquí" : "Aplicar a esta"}
                        </Button>
                      }
                    />
                  );
                })}
              </div>
            </>
          ) : (
            <p className="suma-caption text-text-secondary">
              No hay posiciones candidatas para esta fila.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
            <Button
              type="button"
              size="sm"
              variant={decision.kind === "create_new" ? "default" : "outline"}
              onClick={() =>
                decisions.set(row.sourceRow, { kind: "create_new" })
              }
            >
              Crear posición nueva
            </Button>
            <Button
              type="button"
              size="sm"
              variant={decision.kind === "ignore" ? "default" : "ghost"}
              onClick={() =>
                decisions.set(row.sourceRow, { kind: "ignore" })
              }
            >
              Ignorar esta fila
            </Button>
            {decision.kind !== "pending" && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  decisions.set(row.sourceRow, { kind: "pending" })
                }
              >
                Deshacer
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function DecisionChip({
  decision,
}: {
  decision: ReturnType<DecisionsState["get"]>;
}) {
  if (decision.kind === "pending")
    return (
      <Chip color="warning" variant="soft" size="small">
        Pendiente
      </Chip>
    );
  if (decision.kind === "ignore")
    return (
      <Chip color="neutral" variant="soft" size="small">
        Ignorar
      </Chip>
    );
  if (decision.kind === "create_new")
    return (
      <Chip color="info" variant="soft" size="small">
        Crear nueva
      </Chip>
    );
  if (decision.kind === "apply_to_candidate")
    return (
      <Chip color="success" variant="soft" size="small">
        Aplicar
      </Chip>
    );
  return null;
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

export function EmptyGroup({ message }: { message: string }) {
  return <p className="suma-caption text-text-tertiary">{message}</p>;
}
