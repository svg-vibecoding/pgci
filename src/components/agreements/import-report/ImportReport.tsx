import { useMemo } from "react";
import { AlertTriangle, Ban, CheckCircle2, FilePlus, PlusSquare, Wand2 } from "lucide-react";
import type {
  CatalogProduct,
  DiffResult,
  PositionSnapshot,
} from "@/lib/agreement-import";
import { useImportDecisions } from "./state";
import { StickyDecisionBar } from "./StickyDecisionBar";
import { Group1RequiresDecision } from "./groups/Group1RequiresDecision";
import { Group2ModifiesPublished } from "./groups/Group2ModifiesPublished";
import { Group3DraftsAndCodes } from "./groups/Group3DraftsAndCodes";
import { Group4NewPositions } from "./groups/Group4NewPositions";
import { Group5Unchanged } from "./groups/Group5Unchanged";
import { Group6NotProcessable } from "./groups/Group6NotProcessable";

/**
 * ImportReport — Card 3 completa del flujo de importación.
 * Habla en modo POSICIÓN. Orden secuencial 1→6.
 * - Header con 3 métricas del archivo.
 * - Sticky con conteos VIVOS derivados de las decisiones del usuario.
 * - Cada grupo es un acordeón, colapsado por defecto.
 */
export function ImportReport({
  result,
  positions,
  catalogBySku,
  clients,
}: {
  result: DiffResult;
  positions: PositionSnapshot[];
  catalogBySku: Map<string, CatalogProduct>;
  clients: Array<{ id: string; name: string }>;
}) {
  const decisions = useImportDecisions(result);
  const positionsById = useMemo(() => {
    const m = new Map<string, PositionSnapshot>();
    for (const p of positions) m.set(p.id, p);
    return m;
  }, [positions]);
  const clientsById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clients) m.set(c.id, c.name);
    return m;
  }, [clients]);


  const byGroup = useMemo(() => {
    const g = {
      requires_decision: [] as typeof result.rows,
      not_in_agreement: [] as typeof result.rows,
      modifies_published: [] as typeof result.rows,
      modifies_draft_or_adds_code: [] as typeof result.rows,
      not_processable: [] as typeof result.rows,
      unchanged: [] as typeof result.rows,
    };
    for (const r of result.rows) g[r.group].push(r);
    return g;
  }, [result]);

  const icon = (Icon: typeof AlertTriangle) => <Icon className="h-4 w-4" strokeWidth={2} />;

  return (
    <div className="space-y-4">
      <StickyDecisionBar decisions={decisions} />
      <div className="space-y-3">
        <Group1RequiresDecision
          rows={byGroup.requires_decision}
          catalogBySku={catalogBySku}
          decisions={decisions}
          icon={icon(AlertTriangle)}
        />
        <Group2ModifiesPublished
          rows={byGroup.modifies_published}
          positionsById={positionsById}
          clientsById={clientsById}
          decisions={decisions}
          icon={icon(Wand2)}
        />
        <Group3DraftsAndCodes
          rows={byGroup.modifies_draft_or_adds_code}
          positionsById={positionsById}
          clientsById={clientsById}
          decisions={decisions}
          icon={icon(FilePlus)}
        />

        <Group4NewPositions
          rows={byGroup.not_in_agreement}
          catalogBySku={catalogBySku}
          decisions={decisions}
          icon={icon(PlusSquare)}
        />
        <Group5Unchanged
          rows={byGroup.unchanged}
          positionsById={positionsById}
          icon={icon(CheckCircle2)}
        />
        <Group6NotProcessable
          rows={byGroup.not_processable}
          icon={icon(Ban)}
        />
      </div>
    </div>
  );
}
