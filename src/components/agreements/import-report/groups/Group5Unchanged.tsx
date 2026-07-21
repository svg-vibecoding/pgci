import { useState } from "react";
import type {
  ClassifiedRow,
  PositionSnapshot,
} from "@/lib/agreement-import";
import { Button } from "@/components/ui/button";
import { GroupShell, EnrichedRow } from "../parts";
import { EmptyGroup } from "./Group1RequiresDecision";

export function Group5Unchanged({
  rows,
  positionsById,
}: {
  rows: ClassifiedRow[];
  positionsById: Map<string, PositionSnapshot>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <GroupShell
      title="Sin cambios"
      count={rows.length}
      hint="Filas que coinciden exactamente con la posición actual. No hay nada que hacer."
      tone="muted"
      toolbar={
        rows.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Ocultar filas" : "Ver filas"}
          </Button>
        )
      }
    >
      {rows.length === 0 ? (
        <EmptyGroup message="Todas las filas del archivo traen cambios." />
      ) : open ? (
        <div>
          {rows.slice(0, 300).map((r) => {
            const pos = r.resolvedPositionId
              ? positionsById.get(r.resolvedPositionId)
              : undefined;
            return (
              <EnrichedRow
                key={r.sourceRow}
                sourceRow={r.sourceRow}
                sku={r.row.sku ?? pos?.sku ?? null}
              />
            );
          })}
          {rows.length > 300 && (
            <p className="mt-2 suma-caption text-text-tertiary">
              …y {rows.length - 300} más.
            </p>
          )}
        </div>
      ) : (
        <p className="suma-caption text-text-tertiary">
          {rows.length} {rows.length === 1 ? "fila coincide" : "filas coinciden"}{" "}
          con el estado actual del acuerdo.
        </p>
      )}
    </GroupShell>
  );
}
