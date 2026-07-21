import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { ClassifiedRow, DiffResult } from "@/lib/agreement-import";

/**
 * Decisiones locales del reporte de importación.
 * Nada se escribe hasta confirmar: todo vive en estado del cliente.
 */

export type Decision =
  | { kind: "pending" }
  | { kind: "apply" }
  | { kind: "ignore" }
  | { kind: "apply_to_candidate"; positionId: string }
  | { kind: "create_new" }
  | { kind: "create_draft" };

function defaultFor(row: ClassifiedRow): Decision {
  switch (row.group) {
    case "requires_decision":
      return { kind: "pending" };
    case "modifies_published":
    case "modifies_draft_or_adds_code":
      return { kind: "apply" };
    case "not_in_agreement":
      return { kind: "ignore" };
    default:
      return { kind: "apply" }; // G5/G6 se ignoran en el sticky
  }
}

export type DecisionsState = {
  get: (sourceRow: number) => Decision;
  set: (sourceRow: number, d: Decision) => void;
  setMany: (rows: ClassifiedRow[], d: Decision) => void;
  /** Total de decisiones pendientes en G1. */
  pendingG1: number;
  /** Filas de G2 con decisión "apply" (se modificarán posiciones publicadas). */
  publishedWillChange: number;
  /** Filas de G3 con decisión "apply". */
  draftsWillChange: number;
  /** Filas de G4 con decisión "create_draft". */
  newDrafts: number;
  /** Filas de G1 resueltas (no pending). */
  g1Resolved: number;
  /** Filas totales que "se aplicarán". */
  willApply: number;
};

export function useImportDecisions(result: DiffResult | null): DecisionsState {
  const [map, setMap] = useState<Map<number, Decision>>(new Map());

  // Reset defaults when the result changes
  useMemo(() => {
    if (!result) {
      setMap(new Map());
      return;
    }
    const next = new Map<number, Decision>();
    for (const r of result.rows) next.set(r.sourceRow, defaultFor(r));
    setMap(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const set = useCallback((sourceRow: number, d: Decision) => {
    setMap((prev) => {
      const next = new Map(prev);
      next.set(sourceRow, d);
      return next;
    });
  }, []);

  const setMany = useCallback((rows: ClassifiedRow[], d: Decision) => {
    setMap((prev) => {
      const next = new Map(prev);
      for (const r of rows) next.set(r.sourceRow, d);
      return next;
    });
  }, []);

  const get = useCallback(
    (sourceRow: number): Decision =>
      map.get(sourceRow) ?? { kind: "pending" },
    [map],
  );

  const stats = useMemo(() => {
    if (!result) {
      return {
        pendingG1: 0,
        publishedWillChange: 0,
        draftsWillChange: 0,
        newDrafts: 0,
        g1Resolved: 0,
        willApply: 0,
      };
    }
    let pendingG1 = 0;
    let publishedWillChange = 0;
    let draftsWillChange = 0;
    let newDrafts = 0;
    let g1Resolved = 0;
    let willApply = 0;
    for (const r of result.rows) {
      const d = map.get(r.sourceRow) ?? defaultFor(r);
      if (r.group === "requires_decision") {
        if (d.kind === "pending") pendingG1++;
        else {
          g1Resolved++;
          if (
            d.kind === "apply_to_candidate" ||
            d.kind === "create_new" ||
            d.kind === "apply"
          )
            willApply++;
        }
      } else if (r.group === "modifies_published") {
        if (d.kind === "apply") {
          publishedWillChange++;
          willApply++;
        }
      } else if (r.group === "modifies_draft_or_adds_code") {
        if (d.kind === "apply") {
          draftsWillChange++;
          willApply++;
        }
      } else if (r.group === "not_in_agreement") {
        if (d.kind === "create_draft") {
          newDrafts++;
          willApply++;
        }
      }
    }
    return {
      pendingG1,
      publishedWillChange,
      draftsWillChange,
      newDrafts,
      g1Resolved,
      willApply,
    };
  }, [result, map]);

  return { get, set, setMany, ...stats };
}
