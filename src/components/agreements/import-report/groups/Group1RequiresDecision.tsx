import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type {
  CatalogProduct,
  ClassifiedRow,
} from "@/lib/agreement-import";
import { Chip } from "@/components/sumatec";
import { Button } from "@/components/ui/button";
import {
  GroupShell,
  ReportTable,
  Th,
  ProductCell,
  StatusCell,
  PriceCell,
  DateRangeCell,
} from "../parts";
import { DECISION_REASON_LABEL } from "../labels";
import type { DecisionsState } from "../state";

export function Group1RequiresDecision({
  rows,
  catalogBySku,
  decisions,
}: {
  rows: ClassifiedRow[];
  catalogBySku: Map<string, CatalogProduct>;
  decisions: DecisionsState;
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
            onClick={() => decisions.setMany(rows, { kind: "ignore" })}
          >
            Ignorar todas
          </Button>
        )
      }
    >
      {rows.length === 0 ? (
        <EmptyGroup message="No hay filas que requieran decisión." />
      ) : (
        <ReportTable
          head={
            <>
              <Th className="w-6" />
              <Th>Producto (archivo)</Th>
              <Th>Motivo</Th>
              <Th align="right">Precio</Th>
              <Th>Vigencia</Th>
              <Th>Código cliente</Th>
              <Th align="right">Estado decisión</Th>
              <Th align="right">Acciones</Th>
            </>
          }
        >
          {rows.map((r) => (
            <DecisionRow
              key={r.sourceRow}
              row={r}
              catalogBySku={catalogBySku}
              decisions={decisions}
            />
          ))}
        </ReportTable>
      )}
    </GroupShell>
  );
}

function DecisionRow({
  row,
  catalogBySku,
  decisions,
}: {
  row: ClassifiedRow;
  catalogBySku: Map<string, CatalogProduct>;
  decisions: DecisionsState;
}) {
  const [open, setOpen] = useState(true);
  const decision = decisions.get(row.sourceRow);
  const sku = row.row.sku ?? null;
  const catalog = sku ? catalogBySku.get(sku) : undefined;
  const reasonLabel = row.reason
    ? DECISION_REASON_LABEL[row.reason] ?? row.reason
    : "Requiere decisión";
  const candidates = row.candidates ?? [];
  const hasCandidates = candidates.length > 0;

  return (
    <Fragment>
      <tr className="bg-warning/5 hover:bg-warning/10">
        <td className="px-2 py-1.5 align-top">
          {hasCandidates && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-text-tertiary hover:text-text-primary"
              aria-label={open ? "Ocultar candidatas" : "Ver candidatas"}
            >
              {open ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}
        </td>
        <ProductCell
          sku={sku}
          brand={catalog?.commercial_brand ?? null}
          description={catalog?.commercial_description ?? null}
          sourceRow={row.sourceRow}
        />
        <td className="px-2 py-1.5 align-top">
          <Chip color="warning" variant="soft" size="small">
            {reasonLabel}
          </Chip>
          {hasCandidates && (
            <div className="mt-0.5 text-[11px] text-text-tertiary">
              {candidates.length}{" "}
              {candidates.length === 1 ? "candidata" : "candidatas"}
            </div>
          )}
        </td>
        <PriceCell value={row.row.sale_price} />
        <DateRangeCell start={row.row.start_date} end={row.row.end_date} />
        <td className="px-2 py-1.5 align-top">
          {row.row.client_code ? (
            <span className="font-mono text-xs font-semibold">
              {row.row.client_code}
            </span>
          ) : (
            <span className="text-text-tertiary">—</span>
          )}
        </td>
        <td className="px-2 py-1.5 align-top text-right">
          <DecisionChip decision={decision} />
        </td>
        <td className="px-2 py-1.5 align-top text-right whitespace-nowrap">
          <Button
            type="button"
            size="sm"
            variant={decision.kind === "create_new" ? "default" : "outline"}
            onClick={() =>
              decisions.set(row.sourceRow, { kind: "create_new" })
            }
          >
            Crear nueva
          </Button>{" "}
          <Button
            type="button"
            size="sm"
            variant={decision.kind === "ignore" ? "default" : "ghost"}
            onClick={() => decisions.set(row.sourceRow, { kind: "ignore" })}
          >
            Ignorar
          </Button>
        </td>
      </tr>
      {hasCandidates && open && (
        <tr className="bg-warning/[0.03]">
          <td className="px-2 py-2" />
          <td colSpan={7} className="px-2 pb-3">
            <div className="text-[11px] uppercase tracking-wide text-text-tertiary mb-1.5">
              Posiciones candidatas en el acuerdo
            </div>
            <div className="overflow-x-auto rounded border border-border/60 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-left text-[10.5px] uppercase tracking-wide text-text-tertiary">
                  <tr>
                    <Th>Estado</Th>
                    <Th align="right">Precio</Th>
                    <Th>Vigencia</Th>
                    <Th align="right">Acción</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {candidates.map((c) => {
                    const chosen =
                      decision.kind === "apply_to_candidate" &&
                      decision.positionId === c.position_id;
                    return (
                      <tr key={c.position_id} className={chosen ? "bg-info/5" : ""}>
                        <StatusCell status={c.status} />
                        <PriceCell value={c.sale_price} />
                        <DateRangeCell
                          start={c.start_date}
                          end={c.end_date}
                        />
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          <Button
                            type="button"
                            size="sm"
                            variant={chosen ? "default" : "outline"}
                            onClick={() =>
                              decisions.set(row.sourceRow, {
                                kind: "apply_to_candidate",
                                positionId: c.position_id,
                              })
                            }
                          >
                            {chosen ? "✓ Aplicada" : "Aplicar a esta"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
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

export function EmptyGroup({ message }: { message: string }) {
  return <p className="suma-caption text-text-tertiary">{message}</p>;
}
