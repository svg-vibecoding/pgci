import type { ReactNode } from "react";
import type {
  CatalogProduct,
  ClassifiedRow,
} from "@/lib/agreement-import";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

/**
 * Group 4 — Nuevas posiciones.
 * Tabla plana: checkbox (crear) · Producto · Precio · Vigencia · Código propuesto.
 * Todo nace en draft. La importación solo CREA — no publica.
 * Los datos se muestran tal como vienen: vacíos si faltan, sin juzgar
 * completitud.
 */
export function Group4NewPositions({
  rows,
  catalogBySku,
  decisions,
  icon,
}: {
  rows: ClassifiedRow[];
  catalogBySku: Map<string, CatalogProduct>;
  decisions: DecisionsState;
  icon?: ReactNode;
}) {
  const markedCount = rows.reduce(
    (n, r) => n + (decisions.get(r.sourceRow).kind === "create_draft" ? 1 : 0),
    0,
  );

  return (
    <GroupShell
      id="g4"
      icon={icon}
      title="Nuevas posiciones"
      count={rows.length}
      hint="No están en el acuerdo. El estado lo trae el archivo; tú defines cuáles crear. Nada se crea por defecto."
      toolbar={
        rows.length > 0 && (
          <>
            <span className="suma-caption text-text-tertiary tabular-nums">
              {markedCount} de {rows.length} marcadas
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => decisions.setMany(rows, { kind: "create_draft" })}
            >
              Crear todas
            </Button>
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
            </>
          }
        >
          {rows.map((r) => {
            const decision = decisions.get(r.sourceRow);
            const willCreate = decision.kind === "create_draft";
            const sku = r.row.sku ?? null;
            const catalog = sku ? catalogBySku.get(sku) : undefined;
            return (
              <tr
                key={r.sourceRow}
                className={willCreate ? "bg-info/5" : ""}
              >
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
                  description={catalog?.erp_description ?? null}
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
              </tr>
            );
          })}
        </ReportTable>
      )}
    </GroupShell>
  );
}
