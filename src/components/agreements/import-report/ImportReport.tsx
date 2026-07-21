import { useMemo } from "react";
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
import { Group4NotInAgreement } from "./groups/Group4NotInAgreement";
import { Group5Unchanged } from "./groups/Group5Unchanged";
import { Group6NotProcessable } from "./groups/Group6NotProcessable";

/**
 * ImportReport — Card 3 completa del flujo de importación.
 * Habla en modo POSICIÓN. Orden priorizado: 1 → 4 → 2 → 3 → 6 → 5.
 * Barra sticky con conteos vivos y confirmación bloqueada mientras
 * G1 tenga pendientes.
 */
export function ImportReport({
  result,
  positions,
  catalogBySku,
}: {
  result: DiffResult;
  positions: PositionSnapshot[];
  catalogBySku: Map<string, CatalogProduct>;
}) {
  const decisions = useImportDecisions(result);
  const positionsById = useMemo(() => {
    const m = new Map<string, PositionSnapshot>();
    for (const p of positions) m.set(p.id, p);
    return m;
  }, [positions]);

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

  const total = result.rows.length;

  return (
    <div>
      <StickyDecisionBar total={total} decisions={decisions} />
      <div className="space-y-4">
        <Group1RequiresDecision
          rows={byGroup.requires_decision}
          catalogBySku={catalogBySku}
          decisions={decisions}
          result={result}
        />
        <Group4NotInAgreement
          rows={byGroup.not_in_agreement}
          catalogBySku={catalogBySku}
          decisions={decisions}
        />
        <Group2ModifiesPublished
          rows={byGroup.modifies_published}
          positionsById={positionsById}
          decisions={decisions}
        />
        <Group3DraftsAndCodes
          rows={byGroup.modifies_draft_or_adds_code}
          positionsById={positionsById}
          decisions={decisions}
        />
        <Group6NotProcessable rows={byGroup.not_processable} />
        <Group5Unchanged
          rows={byGroup.unchanged}
          positionsById={positionsById}
        />
      </div>
    </div>
  );
}
