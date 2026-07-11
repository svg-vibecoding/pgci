import { useState } from "react";
import type {
  CSSProperties,
  HTMLAttributes,
  TableHTMLAttributes,
  ThHTMLAttributes,
  TdHTMLAttributes,
} from "react";

/**
 * Table — primitivos de tabla de datos para interfaces operativas.
 * Exporta: Table, TableCaption, TableHeader, TableBody,
 *          TableRow, TableHead, TableCell.
 *
 * Tabla base (sin sorting/filtros/paginación). Soporta columnas
 * numéricas (alineadas a la derecha con tabular-nums), celdas mono
 * para códigos/SKUs/NITs, y StatusBadge en celdas sin cortes de línea.
 */

export type TableProps = TableHTMLAttributes<HTMLTableElement>;

export function Table({ children, style, ...rest }: TableProps) {
  return (
    <div style={{ overflowX: "auto", width: "100%" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontFamily: "var(--font-body)",
          fontSize: 13,
          lineHeight: "18px",
          ...style,
        }}
        {...rest}
      >
        {children}
      </table>
    </div>
  );
}

export type TableCaptionProps = HTMLAttributes<HTMLTableCaptionElement>;

export function TableCaption({ children, style, ...rest }: TableCaptionProps) {
  return (
    <caption
      style={{
        fontFamily: "var(--font-ui)",
        fontSize: 11,
        fontWeight: "var(--fw-bold)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--text-tertiary)",
        padding: "0 0 10px",
        textAlign: "left",
        captionSide: "top",
        ...style,
      }}
      {...rest}
    >
      {children}
    </caption>
  );
}

export type TableHeaderProps = HTMLAttributes<HTMLTableSectionElement>;

export function TableHeader({ children, style, ...rest }: TableHeaderProps) {
  return (
    <thead
      style={{
        background: "var(--surface-page)",
        borderBottom: "1px solid var(--border-default)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </thead>
  );
}

export type TableBodyProps = HTMLAttributes<HTMLTableSectionElement>;

export function TableBody({ children, ...rest }: TableBodyProps) {
  return <tbody {...rest}>{children}</tbody>;
}

export type TableRowProps = HTMLAttributes<HTMLTableRowElement> & {
  /** Activa el resaltado al pasar el cursor (filas interactivas). */
  interactive?: boolean;
};

export function TableRow({
  children,
  interactive = false,
  style,
  ...rest
}: TableRowProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <tr
      onMouseEnter={interactive ? () => setHovered(true) : undefined}
      onMouseLeave={interactive ? () => setHovered(false) : undefined}
      style={{
        borderBottom: "1px solid var(--border-subtle)",
        background: hovered ? "var(--surface-page)" : "transparent",
        transition: "background var(--dur-fast) var(--ease-standard)",
        cursor: interactive ? "pointer" : "default",
        ...style,
      }}
      {...rest}
    >
      {children}
    </tr>
  );
}

export type TableHeadProps = ThHTMLAttributes<HTMLTableCellElement> & {
  /** Alinea a la derecha para columnas numéricas. */
  numeric?: boolean;
};

export function TableHead({
  children,
  numeric = false,
  style,
  ...rest
}: TableHeadProps) {
  const headStyle: CSSProperties = {
    fontFamily: "var(--font-body)",
    fontWeight: "var(--fw-regular)",
    fontSize: "var(--body-md)",
    lineHeight: "var(--body-md-lh)",
    color: "var(--text-tertiary)",
    padding: "10px 16px",
    textAlign: numeric ? "right" : "left",
    whiteSpace: "nowrap",
    ...style,
  };
  return (
    <th style={headStyle} {...rest}>
      {children}
    </th>
  );
}

export type TableCellProps = TdHTMLAttributes<HTMLTableCellElement> & {
  /** Alinea a la derecha con tabular-nums. */
  numeric?: boolean;
  /** Usa fuente monoespaciada — para códigos, SKUs, NITs. */
  mono?: boolean;
};

export function TableCell({
  children,
  numeric = false,
  mono = false,
  style,
  ...rest
}: TableCellProps) {
  const cellStyle: CSSProperties = {
    padding: "11px 16px",
    color: "var(--text-secondary)",
    fontFamily: mono ? "var(--font-mono)" : "var(--font-body)",
    fontSize: mono ? 12 : 13,
    textAlign: numeric ? "right" : "left",
    verticalAlign: "middle",
    fontVariantNumeric: numeric ? "tabular-nums" : undefined,
    whiteSpace: mono || numeric ? "nowrap" : undefined,
    ...style,
  };
  return (
    <td style={cellStyle} {...rest}>
      {children}
    </td>
  );
}
