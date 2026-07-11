import type { ReactNode } from "react";

type IdentityCellProps = {
  /** Título principal (nombre, descripción). */
  title: ReactNode;
  /** Subtítulo (código, SKU, NIT). */
  subtitle?: ReactNode;
  /** Subtítulo en fuente mono (para códigos). */
  monoSubtitle?: boolean;
  /** Título en mono. */
  monoTitle?: boolean;
  /** Insignia o icono a la derecha del título. */
  trailing?: ReactNode;
};

/**
 * IdentityCell — celda estándar de identidad para DataTable.
 * Dos líneas: título (primario, semibold) + subtítulo (secundario, más pequeño).
 * Trunca a 1 línea cada una con tooltip nativo.
 */
export function IdentityCell({
  title,
  subtitle,
  monoSubtitle = false,
  monoTitle = false,
  trailing,
}: IdentityCellProps) {
  const titleText = typeof title === "string" ? title : undefined;
  const subtitleText = typeof subtitle === "string" ? subtitle : undefined;
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className={`min-w-0 truncate font-semibold text-text-primary ${
            monoTitle ? "font-mono text-[13px]" : "text-[13px]"
          }`}
          title={titleText}
        >
          {title}
        </span>
        {trailing ? <span className="shrink-0">{trailing}</span> : null}
      </div>
      {subtitle ? (
        <div
          className={`mt-0.5 truncate text-[11.5px] text-text-tertiary ${
            monoSubtitle ? "font-mono" : ""
          }`}
          title={subtitleText}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}
