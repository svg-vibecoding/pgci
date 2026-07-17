import { AlertTriangle, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Panel presentacional reutilizable para señalar que un elemento (código o SKU)
 * ya está vinculado a una posición del acuerdo. Se comparte entre el buscador
 * de código de cliente (`ClientCodeCard` en `LineEditDialog.tsx`) y el buscador
 * de SKU. Su única responsabilidad es visual: recibe secciones y las apila con
 * los tokens de estado (warning / info / muted) que hoy usa `takenAlert`.
 */

export type PositionTakenVariant = "warning" | "info" | "muted";

export type PositionTakenSection = {
  label: string;
  body: ReactNode;
};

const VARIANT_STYLES: Record<
  PositionTakenVariant,
  { container: string; divider: string; icon: "warning" | "info" }
> = {
  warning: {
    container:
      "rounded-md border border-warning/40 bg-warning/10 p-4 text-[var(--status-warning-strong)]",
    divider: "border-warning/20",
    icon: "warning",
  },
  info: {
    container:
      "rounded-md border border-info/40 bg-info/10 p-4 text-[var(--status-info-strong)]",
    divider: "border-info/20",
    icon: "info",
  },
  muted: {
    container: "rounded-md border border-border bg-muted p-4 text-muted-foreground",
    divider: "border-border",
    icon: "info",
  },
};

export function PositionTakenPanel({
  variant,
  title,
  titleRight,
  sections,
  className,
}: {
  variant: PositionTakenVariant;
  title: string;
  titleRight?: ReactNode;
  sections: PositionTakenSection[];
  className?: string;
}) {
  const styles = VARIANT_STYLES[variant];
  const Icon = styles.icon === "warning" ? AlertTriangle : Info;
  return (
    <div className={cn(styles.container, className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Icon className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-sm font-medium">{title}</p>
        </div>
        {titleRight && <div className="shrink-0">{titleRight}</div>}
      </div>
      <div className="mt-2 space-y-2 pl-6">
        {sections.map((s, i) => (
          <div key={`${s.label}-${i}`}>
            {i > 0 && <hr className={cn("mb-2", styles.divider)} />}
            <p className="text-xs font-semibold uppercase tracking-wide">{s.label}</p>
            <div className="mt-0 text-sm">{s.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function variantForPositionStatus(
  status: "active" | "requires_review" | "draft" | "excluded",
): PositionTakenVariant {
  if (status === "excluded") return "muted";
  if (status === "requires_review" || status === "draft") return "info";
  return "warning";
}
