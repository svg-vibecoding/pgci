import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export type MappingClient = {
  id: string;
  name: string;
  can_manage: boolean;
};

/**
 * Card "Cliente de los códigos".
 * Se renderiza SOLO cuando el archivo trae la columna "Código del cliente" con
 * valores y el usuario tiene permiso sobre más de un cliente del acuerdo.
 * El componente asume que el filtro por can_manage y la lógica mono/multi
 * cliente ya se resolvió afuera.
 */
export function ClientCodeMapping({
  clients,
  selectedId,
  onSelect,
}: {
  clients: MappingClient[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="suma-body text-text-secondary">
        Elige el cliente al que pertenecen los productos de la columna{" "}
        <span className="font-medium text-text-primary">Código del cliente</span>{" "}
        y <span className="font-medium text-text-primary">Descripción del cliente</span>.
      </p>
      <div
        role="radiogroup"
        aria-label="Cliente de los códigos"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {clients.map((c) => {
          const disabled = !c.can_manage;
          const selected = c.id === selectedId;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onSelect(c.id)}
              className={cn(
                "group relative flex items-start gap-3 rounded-lg border bg-white px-4 py-3 text-left transition",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                selected
                  ? "border-primary shadow-[0_0_0_1px_var(--color-primary)]"
                  : "border-border hover:border-text-tertiary",
                disabled && "cursor-not-allowed opacity-60 hover:border-border",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                  selected
                    ? "border-primary bg-primary"
                    : "border-text-tertiary bg-white",
                )}
              >
                {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block suma-subtitle text-text-primary truncate">
                  {c.name}
                </span>
                {disabled && (
                  <span className="mt-1 flex items-center gap-1 suma-caption text-text-tertiary">
                    <Lock className="h-3 w-3" />
                    Sin permiso de catálogo
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {selectedId === null && (
        <p className="suma-caption text-text-tertiary">
          Elige un cliente para ver cómo se cruzan los códigos.
        </p>
      )}
    </div>
  );
}
