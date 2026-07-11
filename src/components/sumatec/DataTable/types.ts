import type { ReactNode } from "react";

export type ColumnAlign = "left" | "right" | "center";

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  /** Ancho fijo en px o CSS string. Si se omite, la columna es flexible. */
  width?: number | string;
  /**
   * Peso de reparto del ancho sobrante entre columnas flexibles (sin `width`).
   * Default 1. Análogo a `flex-grow`.
   */
  flex?: number;
  align?: ColumnAlign;
  /** Aplica `tabular-nums` y alineación derecha por defecto. */
  numeric?: boolean;
  /** Fuerza truncado a 1 línea (opt-in). Por defecto las celdas hacen wrap. */
  truncate?: boolean;
  /**
   * Permite salto de línea del contenido. Default true.
   * Poner false en columnas numéricas/fechas/estado para no partir el valor.
   */
  wrap?: boolean;
  /** Clases extra para <th>. */
  headerClassName?: string;
  /** Clases extra para <td>. */
  cellClassName?: string;
  /** Evita que el click de la celda dispare onRowClick (para checkboxes, menús). */
  stopRowClick?: boolean;
};

export type RowAction<T> = {
  label: string;
  icon?: ReactNode;
  onSelect: (row: T) => void;
  destructive?: boolean;
  disabled?: boolean;
};

export type DataTableSelection<T> = {
  getRowId: (row: T) => string;
  selectedIds: Set<string>;
  onToggleRow: (row: T) => void;
  onToggleAll: () => void;
  masterState: "empty" | "indeterminate" | "checked";
  isRowSelectable?: (row: T) => boolean;
  rowDisabledReason?: (row: T) => string;
  ariaLabel?: string;
  masterDisabled?: boolean;
};

export type DataTableProps<T> = {
  data: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  /** Menú de acciones ⋯. Si devuelve [] no se muestra la columna. */
  rowActions?: (row: T) => RowAction<T>[];
  /** Click en toda la fila. */
  onRowClick?: (row: T) => void;
  selection?: DataTableSelection<T>;
  loading?: boolean;
  error?: { message?: string; onRetry?: () => void };
  empty?: { icon?: ReactNode; title: string; description?: string; action?: ReactNode };
  /** Altura máxima con scroll vertical interno. */
  maxHeight?: number | string;
  /**
   * "auto" (default): la tabla respeta el ancho del contenedor,
   * columnas flexibles se reparten el sobrante, sin scroll horizontal.
   * "fixed": layout tabla fijo, útil si necesitas anchos exactos.
   */
  layout?: "auto" | "fixed";
  /** Extra al contenedor exterior. */
  className?: string;
  /** ID interno para aria-labelledby de acciones. */
  ariaLabel?: string;
};
