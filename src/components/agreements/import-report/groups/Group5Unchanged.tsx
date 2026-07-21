import { useState } from "react";
import type {
  ClassifiedRow,
  PositionSnapshot,
} from "@/lib/agreement-import";
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
          <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
            {open ? "Ocultar filas" : "Ver filas"}
          </Button>
        )
      }
    >
      {rows.length === 0 ? (
        <EmptyGroup message="Todas las filas del archivo traen cambios." />
      ) : open ? (
        <ReportTable
          head={
            <>
              <Th>Producto</Th>
              <Th>Estado</Th>
              <Th align="right">Precio</Th>
              <Th>Vigencia</Th>
            </>
          }
        >
          {rows.slice(0, 500).map((r) => {
            const pos = r.resolvedPositionId
              ? positionsById.get(r.resolvedPositionId)
              : undefined;
            return (
              <tr key={r.sourceRow}>
                <ProductCell
                  sku={r.row.sku ?? pos?.sku ?? null}
                  brand={pos?.commercial_brand ?? null}
                  description={pos?.commercial_description ?? null}
                  sourceRow={r.sourceRow}
                  muted
                />
                <StatusCell status={pos?.status} muted />
                <PriceCell value={pos?.sale_price ?? null} muted />
                <DateRangeCell
                  start={pos?.start_date}
                  end={pos?.end_date}
                  muted
                />
              </tr>
            );
          })}
          {rows.length > 500 && (
            <tr>
              <td colSpan={4} className="px-2 py-2 suma-caption text-text-tertiary">
                …y {rows.length - 500} más.
              </td>
            </tr>
          )}
        </ReportTable>
      ) : (
        <p className="suma-caption text-text-tertiary">
          {rows.length}{" "}
          {rows.length === 1 ? "fila coincide" : "filas coinciden"} con el
          estado actual del acuerdo.
        </p>
      )}
    </GroupShell>
  );
}
