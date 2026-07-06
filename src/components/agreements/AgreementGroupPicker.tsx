import { ChevronDown, Layers, Lock } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/sumatec";
import { cn } from "@/lib/utils";

export type GroupMode = "none" | "existing" | "new";

export type AgreementGroupValue = {
  group_mode: GroupMode;
  group_id: string;
  group_name: string;
  group_observations: string;
};

export type AssignableGroup = {
  id: string;
  group_name: string;
  client_id: string | null;
  client_display_name: string | null;
  agreement_count: number;
};

function Req() {
  return <span className="text-primary"> *</span>;
}

/**
 * Acordeón reutilizable "Agrupar acuerdo".
 * Mismo componente usado en el formulario de creación y en el detalle del
 * acuerdo (para agrupar un acuerdo existente que aún no pertenece a ningún
 * agrupador).
 */
export function AgreementGroupPicker({
  value,
  onChange,
  open,
  onOpenChange,
  canCreateGroups = false,
  groups,
  groupsLoading,
  errors,
}: {
  value: AgreementGroupValue;
  onChange: (next: AgreementGroupValue) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canCreateGroups?: boolean;
  groups?: AssignableGroup[];
  groupsLoading?: boolean;
  errors?: { group_id?: string; group_name?: string };
}) {
  const hasGroups = (groups?.length ?? 0) > 0;
  const selectedGroup = groups?.find((g) => g.id === value.group_id);

  const chooseGroupMode = (mode: Exclude<GroupMode, "none">) => {
    if (value.group_mode === mode) {
      onChange({
        ...value,
        group_mode: "none",
        group_id: "",
        group_name: "",
        group_observations: "",
      });
      return;
    }
    onChange({
      ...value,
      group_mode: mode,
      group_id: mode === "existing" ? value.group_id : "",
      group_name: mode === "new" ? value.group_name : "",
      group_observations: mode === "new" ? value.group_observations : "",
    });
  };

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <section className="rounded-md border border-border bg-card">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Layers className="h-4 w-4" />
              <span className="font-medium text-foreground">Agrupar acuerdo</span>
              <span>· opcional</span>
              {value.group_mode !== "none" && (
                <Badge color="accent" variant="soft">
                  {value.group_mode === "existing" ? "Existente" : "Nuevo agrupador"}
                </Badge>
              )}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-4 border-t border-border px-4 py-4">
            <p className="text-sm text-muted-foreground">
              Un agrupador reúne y organiza varios acuerdos en un solo lugar.
            </p>

            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => chooseGroupMode("existing")}
                aria-pressed={value.group_mode === "existing"}
                className={cn(
                  "flex items-start gap-3 rounded-md border p-3 text-left transition",
                  value.group_mode === "existing"
                    ? "border-accent bg-accent/5"
                    : "border-border bg-background hover:bg-muted/40",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 grid h-4 w-4 shrink-0 place-content-center rounded-full border",
                    value.group_mode === "existing"
                      ? "border-accent"
                      : "border-muted-foreground/40",
                  )}
                >
                  {value.group_mode === "existing" && (
                    <span className="h-2 w-2 rounded-full bg-accent" />
                  )}
                </span>
                <span className="space-y-1">
                  <span className="block text-sm font-medium">
                    Elegir un agrupador existente
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Suma este acuerdo a un agrupador que ya administras.
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => (canCreateGroups ? chooseGroupMode("new") : undefined)}
                disabled={!canCreateGroups}
                aria-pressed={value.group_mode === "new"}
                className={cn(
                  "flex items-start gap-3 rounded-md border p-3 text-left transition",
                  value.group_mode === "new"
                    ? "border-accent bg-accent/5"
                    : "border-border bg-background",
                  canCreateGroups
                    ? "hover:bg-muted/40"
                    : "cursor-not-allowed opacity-60",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 grid h-4 w-4 shrink-0 place-content-center rounded-full border",
                    value.group_mode === "new"
                      ? "border-accent"
                      : "border-muted-foreground/40",
                  )}
                >
                  {value.group_mode === "new" && (
                    <span className="h-2 w-2 rounded-full bg-accent" />
                  )}
                </span>
                <span className="space-y-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    Crear un agrupador nuevo
                    {!canCreateGroups && (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Empieza un agrupador desde este acuerdo; podrás sumarle
                    otros después.
                  </span>
                  {!canCreateGroups && (
                    <span className="block text-xs text-muted-foreground">
                      Necesitas permiso para crear agrupadores. Solicítalo a un
                      administrador.
                    </span>
                  )}
                </span>
              </button>
            </div>

            {value.group_mode === "existing" && (
              <div className="space-y-2">
                <Label>
                  Agrupador
                  <Req />
                </Label>
                <Select
                  value={value.group_id}
                  onValueChange={(val) => onChange({ ...value, group_id: val })}
                  disabled={groupsLoading || !hasGroups}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        groupsLoading
                          ? "Cargando agrupadores…"
                          : hasGroups
                            ? "Selecciona un agrupador"
                            : "No hay agrupadores disponibles"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(groups ?? []).map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        <span className="flex items-center gap-2">
                          <span>{g.group_name}</span>
                          {g.client_display_name && (
                            <span className="text-xs text-muted-foreground">
                              · {g.client_display_name}
                            </span>
                          )}
                          {!g.client_id && (
                            <Badge color="neutral" variant="soft">
                              Libre
                            </Badge>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors?.group_id && (
                  <p className="text-sm text-destructive">{errors.group_id}</p>
                )}
                {selectedGroup && (
                  <p className="text-xs text-muted-foreground">
                    {selectedGroup.agreement_count} acuerdo(s) en este agrupador.
                  </p>
                )}
              </div>
            )}

            {value.group_mode === "new" && canCreateGroups && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="group_name">
                    Nombre del agrupador
                    <Req />
                  </Label>
                  <Input
                    id="group_name"
                    placeholder="Ej. Cadena Éxito — Regionales"
                    value={value.group_name}
                    onChange={(e) =>
                      onChange({ ...value, group_name: e.target.value })
                    }
                  />
                  {errors?.group_name && (
                    <p className="text-sm text-destructive">{errors.group_name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="group_observations">
                    Observaciones del agrupador
                  </Label>
                  <Textarea
                    id="group_observations"
                    rows={3}
                    placeholder="Condiciones generales del agrupador…"
                    value={value.group_observations}
                    onChange={(e) =>
                      onChange({ ...value, group_observations: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Estas observaciones son condiciones generales del agrupador:
                    se mostrarán en todos los acuerdos que agrupes aquí.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
