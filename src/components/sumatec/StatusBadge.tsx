import type { CSSProperties, HTMLAttributes } from "react";
import {
  CheckCircle2,
  Clock,
  Eye,
  Check,
  TriangleAlert,
  XCircle,
  Info,
  Minus,
  type LucideIcon,
} from "lucide-react";

export type StatusBadgeStatus =
  | "active"
  | "pending"
  | "review"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

export type StatusBadgeProps = Omit<HTMLAttributes<HTMLSpanElement>, "color"> & {
  /** Clave semántica de estado — controla color e icono por defecto. */
  status?: StatusBadgeStatus;
  /** Sobrescribe la etiqueta por defecto del estado. */
  label?: string;
  /** 'md' (default) para cards/paneles, 'sm' para tablas densas. */
  size?: "sm" | "md";
  /** Muestra el icono junto a la etiqueta (default: true). */
  withIcon?: boolean;
  /** Sobrescribe el icono por defecto del estado. */
  icon?: LucideIcon;
};

const STATUS_CONFIG: Record<
  StatusBadgeStatus,
  { icon: LucideIcon; label: string }
> = {
  active: { icon: CheckCircle2, label: "Activo" },
  pending: { icon: Clock, label: "Pendiente" },
  review: { icon: Eye, label: "Revisar" },
  success: { icon: Check, label: "Completado" },
  warning: { icon: TriangleAlert, label: "Alerta" },
  danger: { icon: XCircle, label: "Crítico" },
  info: { icon: Info, label: "Info" },
  neutral: { icon: Minus, label: "Sin estado" },
};

/**
 * StatusBadge — indicador de estado compacto para tablas, cards y listas.
 * Usa los tokens de dominio `--status-*`. No acoplado a ningún producto.
 * Funciona con y sin icono. Iconografía vía lucide-react (sin FontAwesome).
 */
export function StatusBadge({
  status = "neutral",
  label,
  size = "md",
  withIcon = true,
  icon,
  style,
  ...rest
}: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.neutral;
  const text = label !== undefined ? label : cfg.label;
  const Icon = icon ?? cfg.icon;
  const sm = size === "sm";

  const badgeStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    flexShrink: 0,
    minWidth: 20,
    height: 20,
    padding: "0 7px",
    fontFamily: "var(--font-ui)",
    fontWeight: "var(--fw-bold)",
    fontSize: sm ? 10 : 11,
    lineHeight: 1,
    letterSpacing: "0.02em",
    color: `var(--status-${status}-strong, var(--status-neutral-strong))`,
    background: `var(--status-${status}-soft, var(--status-neutral-soft))`,
    borderRadius: "var(--radius-pill)",
    whiteSpace: "nowrap",
    ...style,
  };

  return (
    <span style={badgeStyle} {...rest}>
      {withIcon && (
        <Icon size={sm ? 11 : 12} strokeWidth={2.5} aria-hidden="true" />
      )}
      {text}
    </span>
  );
}
