import { Info } from "lucide-react";
import type {
  CatalogProduct,
  ClassifiedRow,
} from "@/lib/agreement-import";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/sumatec";
import {
  GroupShell,
  ReportTable,
  Th,
  ProductCell,
  PriceCell,
  DateRangeCell,
  ClientCodeCell,
} from "../parts";
import type { DecisionsState } from "../state";
import { EmptyGroup } from "./Group1RequiresDecision";

export function Group4NotInAgreement({
  rows,
  catalogBySku,
  decisions,
}: {
  rows: ClassifiedRow[];
  catalogBySku: Map<string, CatalogProduct>;
  decisions: DecisionsState;
}) {
  const complete = rows.filter(isComplete);
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
              onClick={() => decisions.setMany(rows, { kind: "create_draft" })}
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
          <div className="mb-3 flex items-start gap-2 rounded-md border border-border/60 bg-muted/40 p-2.5 suma-caption text-text-secondary">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-text-tertiary" />
            <span>
              Nada se crea por defecto. Marca las filas que quieras crear como
              borradores.
            </span>
          </div>
          <ReportTable
            head={
              <>
                <Th className="w-8" align="center">
                  Crear
                </Th>
                <Th>Producto</Th>
                <Th align="right">Precio</Th>
                <Th>Vigencia</Th>
                <Th>Código propuesto</Th>
                <Th>Nota</Th>
              </>
            }
          >
            {rows.map((r) => {
              const decision = decisions.get(r.sourceRow);
              const willCreate = decision.kind === "create_draft";
              const sku = r.row.sku ?? null;
              const catalog = sku ? catalogBySku.get(sku) : undefined;
              const rowComplete = isComplete(r);
              return (
                <tr key={r.sourceRow} className={willCreate ? "bg-info/5" : ""}>
                  <td className="px-2 py-1.5 text-center align-top">
                    <Checkbox
                      checked={willCreate}
                      onCheckedChange={(v) =>
                        decisions.set(r.sourceRow, {
                          kind: v ? "create_draft" : "ignore",
                        })
                      }
                      aria-label="Crear como borrador"
                    />
                  </td>
                  <ProductCell
                    sku={sku}
                    brand={catalog?.commercial_brand ?? null}
                    description={catalog?.commercial_description ?? null}
                    sourceRow={r.sourceRow}
                    muted={!willCreate}
                  />
                  <PriceCell value={r.row.sale_price} muted={!willCreate} />
                  <DateRangeCell
                    start={r.row.start_date}
                    end={r.row.end_date}
                    muted={!willCreate}
                  />
                  <ClientCodeCell
                    code={r.row.client_code}
                    description={r.row.client_description}
                    muted={!willCreate}
                  />
                  <td className="px-2 py-1.5 align-top">
                    {!rowComplete && (
                      <Chip color="warning" variant="soft" size="small">
                        Datos incompletos
                      </Chip>
                    )}
                  </td>
                </tr>
              );
            })}
          </ReportTable>
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
