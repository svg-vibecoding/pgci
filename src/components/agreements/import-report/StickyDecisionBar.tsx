import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DecisionsState } from "./state";

/**
 * Barra sticky de decisión. Habla de RESULTADO, no de clasificación inicial.
 * X e Y se recalculan con cada decisión del usuario.
 */
export function StickyDecisionBar({
  decisions,
  onConfirm,
}: {
  decisions: DecisionsState;
  onConfirm?: () => void;
}) {
  const blocked = decisions.pendingG1 > 0;
  const created = decisions.createdCount;
  const modified = decisions.modifiedCount;

  return (
    <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-border bg-white/95 px-4 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          {blocked ? (
            <p className="suma-body font-semibold text-text-primary">
              {decisions.pendingG1}{" "}
              {decisions.pendingG1 === 1 ? "fila necesita" : "filas necesitan"}{" "}
              tu decisión antes de continuar
            </p>
          ) : (
            <p className="suma-body font-semibold text-text-primary">
              Revisa qué pasará con tu acuerdo antes de confirmar. Nada se
              guarda todavía.
            </p>
          )}
          <p className="suma-caption text-text-secondary">
            Al confirmar: se crean{" "}
            <strong className="text-text-primary">
              {created} {created === 1 ? "posición nueva" : "posiciones nuevas"}
            </strong>{" "}
            y se modifican{" "}
            <strong className="text-text-primary">
              {modified} {modified === 1 ? "existente" : "existentes"}
            </strong>
            .
          </p>
        </div>
        <Button
          type="button"
          disabled={blocked}
          onClick={onConfirm}
          title={
            blocked
              ? "Hay filas en 'Requieren decisión' sin resolver"
              : "Confirmar importación"
          }
          className={cn(blocked && "cursor-not-allowed")}
        >
          Confirmar importación
        </Button>
      </div>
    </div>
  );
}
