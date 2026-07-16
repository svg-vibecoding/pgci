import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RowAction } from "./types";

type Props<T> = {
  row: T;
  actions: RowAction<T>[];
  ariaLabel?: string;
};

export function RowActionsMenu<T>({ row, actions, ariaLabel }: Props<T>) {
  if (actions.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel ?? "Acciones de la fila"}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-sunken hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {actions.map((a, i) => (
          <DropdownMenuItem
            key={i}
            disabled={a.disabled}
            title={a.title}
            onSelect={() => {
              a.onSelect(row);
            }}
            className={
              a.destructive
                ? "text-destructive focus:bg-destructive/10 focus:text-destructive"
                : ""
            }
          >
            {a.icon ? <span className="mr-2 inline-flex">{a.icon}</span> : null}
            {a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
