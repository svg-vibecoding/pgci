/**
 * Componentes de marca y operación para productos digitales Sumatec.
 *
 * Híbrido controlado:
 *  - UI general (botones, inputs, forms, diálogos) → shadcn en src/components/ui.
 *  - Piezas de marca y operación (estados, datos, tablas) → estos componentes.
 *
 * Este directorio NO contiene comercio/catálogo/storefront.
 * Fuente de verdad: Sumatec Digital Design System (referencia versionada,
 * transversal a los productos digitales de Sumatec; PGCI es implementación).
 */
export { Badge } from "./Badge";
export type { SumatecBadgeColor, SumatecBadgeVariant } from "./Badge";

export { Chip } from "./Chip";
export type {
  SumatecChipColor,
  SumatecChipVariant,
  SumatecChipSize,
} from "./Chip";

export { StatusBadge } from "./StatusBadge";
export type { StatusBadgeProps, StatusBadgeStatus } from "./StatusBadge";

export {
  Table,
  TableCaption,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./Table";
export type {
  TableProps,
  TableCaptionProps,
  TableHeaderProps,
  TableBodyProps,
  TableRowProps,
  TableHeadProps,
  TableCellProps,
} from "./Table";
