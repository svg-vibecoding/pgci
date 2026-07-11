import type { CSSProperties } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RowActionsMenu } from "./RowActionsMenu";
import type { DataTableColumn, DataTableProps } from "./types";

/**
 * DataTable — tabla transversal del Sumatec Design System.
 *
 * Reglas (no negociables por vista):
 *  - Densidad única: header 36px, filas con padding 12/16, alto flexible según contenido.
 *  - Tipografía: header 11px uppercase Montserrat / body 13px Roboto.
 *  - Alineación numérica: siempre derecha con tabular-nums.
 *  - Acciones: una sola columna ⋯ (sticky derecha) con DropdownMenu.
 *  - Fila entera clickeable via onRowClick; el menú y checkbox no propagan.
 *  - Sin scroll horizontal: el contenido de texto envuelve; las columnas
 *    numéricas/fechas/estado no envuelven.
 *  - Loading = skeleton rows; empty/error = estados propios.
 */
export function DataTable<T>({
  data,
  columns,
  getRowId,
  rowActions,
  onRowClick,
  selection,
  loading,
  error,
  empty,
  maxHeight,
  layout = "auto",
  className,
  ariaLabel,
}: DataTableProps<T>) {
  const hasActions = !!rowActions;
  const hasSelection = !!selection;
  const totalCols = columns.length + (hasSelection ? 1 : 0) + (hasActions ? 1 : 0);

  const containerStyle: CSSProperties = maxHeight
    ? { maxHeight: typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight }
    : {};

  const alignClass = (col: DataTableColumn<T>) => {
    const a = col.align ?? (col.numeric ? "right" : "left");
    return a === "right"
      ? "text-right"
      : a === "center"
        ? "text-center"
        : "text-left";
  };

  const colStyle = (col: DataTableColumn<T>): CSSProperties => {
    if (col.width === undefined) return {};
    return { width: typeof col.width === "number" ? `${col.width}px` : col.width };
  };

  const cellWrapClass = (col: DataTableColumn<T>) => {
    if (col.truncate) return "truncate max-w-0";
    // Numéricas/fechas: no partir el valor.
    const noWrap = col.wrap === false || col.numeric === true;
    return noWrap ? "whitespace-nowrap" : "whitespace-normal break-words";
  };

  return (
    <div
      className={`overflow-hidden rounded-lg border border-border bg-card ${className ?? ""}`}
    >
      <div
        className={`w-full overflow-x-hidden ${maxHeight ? "overflow-y-auto" : ""}`}
        style={containerStyle}
      >
        <table
          className={`w-full border-collapse font-body text-[13px] leading-5 text-text-secondary ${
            layout === "fixed" ? "table-fixed" : "table-auto"
          }`}
          aria-label={ariaLabel}
        >
          <thead className="sticky top-0 z-10 bg-surface-page">
            <tr className="border-b border-border">
              {hasSelection && (
                <th
                  scope="col"
                  className="sticky left-0 z-20 w-10 bg-surface-page px-4 py-2.5"
                >
                  <div className="flex items-center justify-center">
                    <Checkbox
                      aria-label={selection.ariaLabel ?? "Seleccionar todo"}
                      className="data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground"
                      checked={
                        selection.masterState === "checked"
                          ? true
                          : selection.masterState === "indeterminate"
                            ? "indeterminate"
                            : false
                      }
                      disabled={selection.masterDisabled}
                      onCheckedChange={() => selection.onToggleAll()}
                    />
                  </div>
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  style={colStyle(col)}
                  className={[
                    "whitespace-nowrap px-4 py-2.5 font-ui text-[11px] font-bold uppercase tracking-[0.05em] text-text-tertiary",
                    alignClass(col),
                    col.headerClassName ?? "",
                  ].join(" ")}
                >
                  {col.header}
                </th>
              ))}
              {hasActions && (
                <th
                  scope="col"
                  aria-label="Acciones"
                  className="w-12 bg-surface-page px-4 py-2.5"
                />
              )}
            </tr>
          </thead>

          <tbody>
            {loading && <SkeletonRows cols={totalCols} />}

            {!loading && error && (
              <tr>
                <td colSpan={totalCols} className="px-6 py-12 text-center">
                  <div className="mx-auto max-w-md space-y-3">
                    <div className="text-sm text-destructive">
                      {error.message ?? "No fue posible cargar los datos."}
                    </div>
                    {error.onRetry && (
                      <button
                        type="button"
                        onClick={error.onRetry}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Reintentar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {!loading && !error && data.length === 0 && empty && (
              <tr>
                <td colSpan={totalCols} className="px-6 py-14 text-center">
                  <div className="mx-auto flex max-w-md flex-col items-center gap-2">
                    {empty.icon ? (
                      <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-surface-sunken text-text-tertiary">
                        {empty.icon}
                      </div>
                    ) : null}
                    <div className="text-sm font-semibold text-text-primary">
                      {empty.title}
                    </div>
                    {empty.description && (
                      <div className="text-[13px] text-text-tertiary">
                        {empty.description}
                      </div>
                    )}
                    {empty.action ? <div className="mt-2">{empty.action}</div> : null}
                  </div>
                </td>
              </tr>
            )}

            {!loading &&
              !error &&
              data.map((row, i) => {
                const id = getRowId(row);
                const selected = selection?.selectedIds.has(id) ?? false;
                const selectable = selection?.isRowSelectable?.(row) ?? true;
                const disabledReason = selection?.rowDisabledReason?.(row);
                const actions = rowActions?.(row) ?? [];
                const clickable = !!onRowClick;
                return (
                  <tr
                    key={id}
                    onClick={clickable ? () => onRowClick!(row) : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    onKeyDown={
                      clickable
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onRowClick!(row);
                            }
                          }
                        : undefined
                    }
                    className={[
                      "group border-b border-border/60 transition-colors",
                      selected
                        ? "bg-primary/[0.04]"
                        : "bg-card hover:bg-surface-page",
                      clickable
                        ? "cursor-pointer focus:outline-none focus-visible:bg-surface-page"
                        : "",
                    ].join(" ")}
                    style={
                      selected
                        ? { boxShadow: "inset 2px 0 0 0 var(--color-primary)" }
                        : undefined
                    }
                  >
                    {hasSelection && (
                      <td
                        onClick={(e) => e.stopPropagation()}
                        className="sticky left-0 z-[1] w-10 bg-inherit px-4 py-3 align-top"
                      >
                        <div className="flex items-center justify-center pt-0.5">
                          {selectable ? (
                            <Checkbox
                              aria-label={selection!.ariaLabel ?? "Seleccionar fila"}
                              checked={selected}
                              onCheckedChange={() => selection!.onToggleRow(row)}
                            />
                          ) : (
                            <DisabledCheckbox reason={disabledReason} />
                          )}
                        </div>
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        style={colStyle(col)}
                        onClick={
                          col.stopRowClick
                            ? (e) => e.stopPropagation()
                            : undefined
                        }
                        className={[
                          "px-4 py-3 align-top",
                          alignClass(col),
                          col.numeric ? "tabular-nums" : "",
                          cellWrapClass(col),
                          col.cellClassName ?? "",
                        ].join(" ")}
                      >
                        {col.cell(row, i)}
                      </td>
                    ))}
                    {hasActions && (
                      <td
                        onClick={(e) => e.stopPropagation()}
                        className="w-12 bg-inherit px-2 py-2 text-right align-top"
                      >
                        <RowActionsMenu row={row} actions={actions} />
                      </td>
                    )}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DisabledCheckbox({ reason }: { reason?: string }) {
  const box = (
    <Checkbox
      aria-label={reason ?? "No disponible"}
      disabled
      className="cursor-not-allowed border-border bg-surface-sunken opacity-100 data-[state=checked]:bg-muted data-[state=checked]:text-muted-foreground"
      checked={false}
    />
  );
  if (!reason) return <span className="inline-flex">{box}</span>;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{box}</span>
        </TooltipTrigger>
        <TooltipContent side="right">{reason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b border-border/60">
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div
                className="h-4 animate-pulse rounded bg-surface-sunken"
                style={{ width: `${40 + ((i * 17 + j * 11) % 45)}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
