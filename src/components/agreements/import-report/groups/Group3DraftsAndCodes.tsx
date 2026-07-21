import type {
  ClassifiedRow,
  PositionSnapshot,
} from "@/lib/agreement-import";
import { Button } from "@/components/ui/button";
import {
  GroupShell,
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
        <div className="space-y-4">
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
      <h4 className="suma-caption text-text-tertiary uppercase tracking-wide mb-1.5">
        {title} ({rows.length})
      </h4>
      <ReportTable
        head={
          <>
            <Th>Producto</Th>
            <Th>Estado</Th>
            <Th align="right">Precio actual</Th>
            <Th>Vigencia actual</Th>
            <Th>Se aplicará</Th>
            <Th align="right">Acción</Th>
          </>
        }
      >
        {rows.map((r) => {
          const pos = r.resolvedPositionId
            ? positionsById.get(r.resolvedPositionId)
            : undefined;
          if (!pos) return null;
          const decision = decisions.get(r.sourceRow);
          const excluded = decision.kind === "ignore";
          return (
            <tr key={r.sourceRow}>
              <ProductCell
                sku={pos.sku}
                brand={pos.commercial_brand}
                description={pos.erp_description}
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
    </div>
  );
}
