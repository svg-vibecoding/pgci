/**
 * Formateo consistente para toda la plataforma PGCI.
 * Estándar colombiano: punto como separador de miles y coma como decimales.
 * No depende del ICU del runtime — el formato se construye manualmente
 * para garantizar consistencia en Cloudflare Workers y otros entornos.
 */

export function formatMoneyCOP(
  value: number | null | undefined,
  opts: { fractionDigits?: number } = {},
): string {
  if (value == null || Number.isNaN(value)) return "—";
  const fd = opts.fractionDigits ?? 2;
  const neg = value < 0;
  const abs = Math.abs(value);
  const [intPart, decPart = ""] = abs.toFixed(fd).split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const body = fd > 0 ? `${withThousands},${decPart}` : withThousands;
  return `${neg ? "-" : ""}$${body}`;
}

/**
 * Fecha corta estándar PGCI: "dd/mm/aa" con locale es-CO.
 * Usado en tablas densas (reporte de importación, listados) donde el
 * ancho de columna manda.
 */
export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}
