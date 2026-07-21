import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DecisionsState } from "./state";

export function StickyDecisionBar({
  total,
  decisions,
  onConfirm,
}: {
  total: number;
  decisions: DecisionsState;
  onConfirm?: () => void;
}) {
  const blocked = decisions.pendingG1 > 0;
  return (
    <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-border bg-white/95 px-4 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 min-w-0">
          <Stat label="Total" value={total} />
          <Stat
            label="Requieren tu atención"
            value={decisions.pendingG1}
            tone={decisions.pendingG1 > 0 ? "warning" : "muted"}
            icon={decisions.pendingG1 > 0 ? "warn" : undefined}
          />
          <Stat
            label="Publicadas se modificarán"
            value={decisions.publishedWillChange}
            tone="info"
          />
          <Stat
            label="Se aplicarán"
            value={decisions.willApply}
            tone="success"
            icon="ok"
          />
        </div>
        <div className="flex items-center gap-2">
          {blocked && (
            <span className="suma-caption text-text-tertiary">
              Resuelve las {decisions.pendingG1}{" "}
              {decisions.pendingG1 === 1 ? "fila" : "filas"} pendientes
            </span>
          )}
          <Button
            type="button"
            disabled={blocked}
            onClick={onConfirm}
            title={
              blocked
                ? "Hay filas en 'Requieren decisión' sin resolver"
                : "Confirmar importación"
            }
          >
            Confirmar importación
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "muted",
  icon,
}: {
  label: string;
  value: number;
  tone?: "muted" | "warning" | "info" | "success";
  icon?: "warn" | "ok";
}) {
  const toneCls =
    tone === "warning"
      ? "text-warning-strong"
      : tone === "info"
        ? "text-accent"
        : tone === "success"
          ? "text-success-strong"
          : "text-text-primary";
  return (
    <div className="flex items-baseline gap-1.5">
      {icon === "warn" && (
        <AlertCircle
          className="h-3.5 w-3.5 text-warning-strong"
          strokeWidth={2.25}
        />
      )}
      {icon === "ok" && (
        <CheckCircle2
          className="h-3.5 w-3.5 text-success-strong"
          strokeWidth={2.25}
        />
      )}
      <span className={"tabular-nums text-base font-bold " + toneCls}>
        {value}
      </span>
      <span className="suma-caption text-text-tertiary">{label}</span>
    </div>
  );
}
