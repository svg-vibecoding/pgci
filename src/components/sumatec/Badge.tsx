import type { CSSProperties, HTMLAttributes } from "react";

export type SumatecBadgeColor =
  | "neutral"
  | "primary"
  | "accent"
  | "info"
  | "success"
  | "warning"
  | "error";
export type SumatecBadgeVariant = "soft" | "solid";
export type SumatecBadgeSize = "small" | "medium";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  color?: SumatecBadgeColor;
  variant?: SumatecBadgeVariant;
  size?: SumatecBadgeSize;
  dot?: boolean;
};

const palette: Record<SumatecBadgeColor, { main: string; soft: string }> = {
  neutral: { main: "var(--gray-700)", soft: "var(--gray-100)" },
  primary: { main: "var(--color-primary)", soft: "var(--color-primary-soft)" },
  accent: { main: "var(--color-accent)", soft: "var(--color-accent-soft)" },
  info: { main: "var(--info-strong)", soft: "var(--info-soft)" },
  success: { main: "var(--success-strong)", soft: "var(--success-soft)" },
  warning: { main: "var(--warning-strong)", soft: "var(--warning-soft)" },
  error: { main: "var(--error-strong)", soft: "var(--error-soft)" },
};

const sizes: Record<SumatecBadgeSize, { height: number; padding: number; fontSize: number }> = {
  small: { height: 20, padding: 7, fontSize: 11 },
  medium: { height: 24, padding: 12, fontSize: 12 },
};

/** Badge — etiqueta de estado o conteo numérico. Usa `dot` para estado mínimo. */
export function Badge({
  children,
  color = "neutral",
  variant = "soft",
  size = "small",
  dot = false,
  style,
  ...rest
}: BadgeProps) {
  const tone = palette[color];

  if (dot) {
    return (
      <span
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: "var(--radius-pill)",
          background: tone.main,
          ...style,
        }}
        {...rest}
      />
    );
  }

  const solid = variant === "solid";
  const s = sizes[size];
  const badgeStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minWidth: s.height,
    height: s.height,
    padding: `0 ${s.padding}px`,
    fontFamily: "var(--font-ui)",
    fontWeight: "var(--fw-bold)",
    fontSize: s.fontSize,
    lineHeight: 1,
    letterSpacing: "0.02em",
    color: solid ? tone.soft : tone.main,
    background: solid ? tone.main : tone.soft,
    borderRadius: "var(--radius-pill)",
    ...style,
  };

  return (
    <span style={badgeStyle} {...rest}>
      {children}
    </span>
  );
}
