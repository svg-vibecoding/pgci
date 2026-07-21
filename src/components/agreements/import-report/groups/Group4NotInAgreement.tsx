import type {
  CatalogProduct,
  ClassifiedRow,
} from "@/lib/agreement-import";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/sumatec";
import { PositionCard } from "@/components/agreements/PositionCard";
import { GroupShell } from "../parts";
import type { DecisionsState } from "../state";
import { EmptyGroup } from "./Group1RequiresDecision";

/**
 * Filas cuyo SKU existe en catálogo pero no está en el acuerdo.
 * Default: IGNORAR. La persona puede marcar para crear como borrador.
 */
export function Group4NotInAgreement({
  rows,
  catalogBySku,
  decisions,
}: {
  rows: ClassifiedRow[];
  catalogBySku: Map<string, CatalogProduct>;
  decisions: DecisionsState;
}) {
  const complete = rows.filter((r) => isComplete(r));
  return (
    <GroupShell
      title="No están en el acuerdo"
      count={rows.length}
      hint="Estos SKUs existen en el catálogo pero aún no tienen posición aquí. Por defecto se ignoran."
      toolbar={
        rows.length > 0 && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                decisions.setMany(rows, { kind: "create_draft" })
              }
            >
              Crear todas como borrador
            </Button>
            {complete.length > 0 && complete.length !== rows.length && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  decisions.setMany(complete, { kind: "create_draft" })
                }
              >
                Solo las completas ({complete.length})
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => decisions.setMany(rows, { kind: "ignore" })}
            >
              Ignorar todas
            </Button>
          </>
        )
      }
    >
      {rows.length === 0 ? (
        <EmptyGroup message="Todas las filas del archivo corresponden a posiciones existentes." />
      ) : (
        <>
          <div className="mb-3 flex items-start gap-2 rounded-md border border-border/60 bg-muted/40 p-3 suma-caption text-text-secondary">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-text-tertiary" />
            <span>
              Nada se crea por defecto. Marca las filas que quieras crear como
              borradores en el acuerdo. Los borradores requieren gestión
              posterior (código cliente, revisión) antes de publicarse.
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {rows.map((r) => {
              const decision = decisions.get(r.sourceRow);
              const willCreate = decision.kind === "create_draft";
              const sku = r.row.sku ?? null;
              const catalog = sku ? catalogBySku.get(sku) : undefined;
              const complete = isComplete(r);
              return (
                <PositionCard
                  key={r.sourceRow}
                  status="pending"
                  statusLabel="Se crearía como borrador"
                  startDate={r.row.start_date ?? null}
                  endDate={r.row.end_date ?? null}
                  price={r.row.sale_price ?? null}
                  parPrice={r.row.par_price ?? null}
                  sku={sku}
                  brand={catalog ? "Catálogo" : undefined}
                  tone={willCreate ? "info" : "default"}
                  className={willCreate ? "" : "opacity-90"}
                  headerLeft={
                    <Checkbox
                      checked={willCreate}
                      onCheckedChange={(v) =>
                        decisions.set(r.sourceRow, {
                          kind: v ? "create_draft" : "ignore",
                        })
                      }
                      aria-label="Crear como borrador"
                    />
                  }
                  footer={
                    <div className="w-full flex items-center justify-between gap-2">
                      <span className="text-[11px] text-text-tertiary">
                        Fila {r.sourceRow}
                      </span>
                      {!complete && (
                        <Chip color="warning" variant="soft" size="small">
                          Datos incompletos
                        </Chip>
                      )}
                    </div>
                  }
                >
                  {r.row.client_code && (
                    <div className="text-xs text-text-secondary">
                      Código propuesto:{" "}
                      <span className="font-mono">{r.row.client_code}</span>
                    </div>
                  )}
                </PositionCard>
              );
            })}
          </div>
        </>
      )}
    </GroupShell>
  );
}

function isComplete(r: ClassifiedRow): boolean {
  return (
    r.row.sale_price != null &&
    r.row.start_date != null &&
    r.row.end_date != null
  );
}
