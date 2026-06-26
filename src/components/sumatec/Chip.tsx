import type { CSSProperties, HTMLAttributes, MouseEvent } from "react";
import { X, type LucideIcon } from "lucide-react";

export type SumatecChipColor =
  | "neutral"
  | "primary"
  | "accent"
  | "success"
  | "warning"
  | "info";
export type SumatecChipVariant = "soft" | "solid" | "outline";
export type SumatecChipSize = "small" | "medium" | "large";

type ChipProps = Omit<HTMLAttributes<HTMLSpanElement>, "onClick"> & {
  color?: SumatecChipColor;
  variant?: SumatecChipVariant;
  size?: SumatecChipSize;
  /** Icono opcional a la izquierda (componente lucide-react). */
  icon?: LucideIcon;
  selected?: boolean;
  onClick?: (e: MouseEvent<HTMLSpanElement>) => void;
  onRemove?: (e: MouseEvent<HTMLButtonElement>) => void;
};


const palette: Record<
  SumatecChipColor,
  { main: string; soft: string; border: string }
> = {
  neutral: {
    main: "var(--gray-700)",
    soft: "var(--gray-100)",
    border: "var(--border-default)",
  },
  primary: {
    main: "var(--color-primary)",
    soft: "var(--color-primary-soft)",
    border: "var(--red-200)",
  },
  accent: {
    main: "var(--color-accent)",
    soft: "var(--color-accent-soft)",
    border: "var(--blue-200)",
  },
  success: {
    main: "var(--success-strong)",
    soft: "var(--success-soft)",
    border: "#a7d8ba",
  },
  warning: {
    main: "var(--warning-strong)",
    soft: "var(--warning-soft)",
    border: "#f0d18a",
  },
  info: {
    main: "var(--info-strong)",
    soft: "var(--info-soft)",
    border: "var(--blue-200)",
  },
};

const heights: Record<SumatecChipSize, number> = {
  small: 24,
  medium: 30,
  large: 36,
};
const fontSizes: Record<SumatecChipSize, number> = {
  small: 12,
  medium: 13,
  large: 14,
};

/** Chip — token compacto de filtro / selección / removible. Forma píldora. */
export function Chip({
  children,
  color = "neutral",
  variant = "soft",
  size = "medium",
  icon: Icon,
  selected = false,
  onRemove,
  onClick,
  style,
  ...rest
}: ChipProps) {
  const tone = palette[color];
  const h = heights[size];
  const fs = fontSizes[size];

  let bg: string;
  let fg: string;
  let border: string;
  if (selected) {
    bg = tone.main;
    fg = "var(--text-on-brand)";
    border = tone.main;
  } else if (variant === "solid") {
    bg = tone.main;
    fg = "var(--text-on-brand)";
    border = tone.main;
  } else if (variant === "outline") {
    bg = "transparent";
    fg = tone.main;
    border = tone.border;
  } else {
    bg = tone.soft;
    fg = tone.main;
    border = "transparent";
  }

  const chipStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: h,
    padding: `0 ${onRemove ? 8 : 12}px 0 12px`,
    fontFamily: "var(--font-ui)",
    fontWeight: "var(--fw-semibold)",
    fontSize: fs,
    lineHeight: 1,
    color: fg,
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: "var(--radius-pill)",
    cursor: onClick ? "pointer" : "default",
    userSelect: "none",
    transition: "all var(--dur-fast) var(--ease-standard)",
    ...style,
  };

  return (
    <span onClick={onClick} style={chipStyle} {...rest}>
      {Icon && <Icon size={fs - 1} strokeWidth={2.25} aria-hidden="true" />}
      {children}
      {onRemove && (
        <button
          type="button"
          aria-label="Quitar"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(e);
          }}
          style={{
            display: "inline-flex",
            border: "none",
            background: "transparent",
            color: "inherit",
            cursor: "pointer",
            padding: 2,
            opacity: 0.8,
          }}
        >
          <X size={fs - 2} strokeWidth={2.5} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
