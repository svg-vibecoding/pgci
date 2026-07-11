import type { ReactNode } from "react";

type IdentityCellProps = {
  /** Línea 1: código (SKU, código de cliente, NIT). Siempre mono. */
  code: ReactNode;
  /** Línea 2: descripción / nombre. Fuente normal. */
  description?: ReactNode;
  /** Insignia o icono a la derecha del código. */
  trailing?: ReactNode;
};

/**
 * IdentityCell — celda estándar de identidad para DataTable.
 *
 * Regla del sistema (no negociable):
 *  - Línea 1 = código en mono, semibold, text-primary, 12.5px.
 *  - Línea 2 = descripción en sans, regular, text-secondary, 13px
 *    (misma escala que las demás columnas de texto).
 *  - Sin gap extra entre líneas: leen como bloque.
 *  - Wrapping natural en 2 líneas máximo con tooltip nativo.
 */
export function IdentityCell({ code, description, trailing }: IdentityCellProps) {
  const codeText = typeof code === "string" ? code : undefined;
  const descText = typeof description === "string" ? description : undefined;
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className="min-w-0 truncate font-mono text-[12.5px] font-semibold text-text-primary"
          title={codeText}
        >
          {code}
        </span>
        {trailing ? <span className="shrink-0">{trailing}</span> : null}
      </div>
      {description ? (
        <div
          className="line-clamp-2 text-[13px] font-normal leading-[1.35] text-text-secondary"
          title={descText}
        >
          {description}
        </div>
      ) : null}
    </div>
  );
}
