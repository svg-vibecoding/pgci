import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Encabezado reutilizable de resumen colapsable: una línea con el conteo /
 * texto de resumen a la izquierda y un enlace "Ver detalle / Ocultar" a la
 * derecha. El enlace usa el color accent (azul Sumatec) para diferenciarse
 * del CTA primario rojo.
 */
export function SummaryToggle({
  summary,
  open,
  onToggle,
  canToggle = true,
  openLabel = "Ocultar",
  closedLabel = "Ver detalle",
  className,
}: {
  summary: string;
  open: boolean;
  onToggle: () => void;
  canToggle?: boolean;
  openLabel?: string;
  closedLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full items-center justify-between", className)}>
      <p className="suma-body font-medium text-text-primary">{summary}</p>
      {canToggle && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto px-0 py-0 text-xs font-medium text-accent hover:text-accent/80"
          onClick={onToggle}
        >
          {open ? openLabel : closedLabel}
        </Button>
      )}
    </div>
  );
}
