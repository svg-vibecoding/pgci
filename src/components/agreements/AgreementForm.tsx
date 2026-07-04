import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, ChevronDown, Layers, Lock, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/sumatec";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const dateInputClass = cn(
  "pr-10",
  "[&::-webkit-calendar-picker-indicator]:opacity-0",
  "[&::-webkit-calendar-picker-indicator]:absolute",
  "[&::-webkit-calendar-picker-indicator]:inset-y-0",
  "[&::-webkit-calendar-picker-indicator]:right-0",
  "[&::-webkit-calendar-picker-indicator]:w-10",
  "[&::-webkit-calendar-picker-indicator]:cursor-pointer",
);

export type GroupMode = "none" | "existing" | "new";
export type CompanyMode = "none" | "single" | "multi";

export type AgreementFormValues = {
  group_mode: GroupMode;
  group_id: string;
  group_name: string;
  company_mode: CompanyMode;
  client_id: string;
  company_ids: string[];
  name: string;
  scope: "global" | "unit";
  unit_name: string;
  start_date: string;
  end_date: string;
  observations: string;
};

export const emptyAgreement: AgreementFormValues = {
  group_mode: "none",
  group_id: "",
  group_name: "",
  company_mode: "multi",
  client_id: "",
  company_ids: [],
  name: "",
  scope: "global",
  unit_name: "",
  start_date: "",
  end_date: "",
  observations: "",
};

export type AssignableClient = {
  id: string;
  legal_name: string;
  commercial_name: string | null;
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

export function AgreementForm({
  initial,
  clients: _clients,
  clientsLoading: _clientsLoading,
  groups,
  groupsLoading,
  canCreateGroups = false,
  submitting,
  submitLabel = "Crear acuerdo",
  lockClient = false,
  onSubmit,
  onCancel,
}: {
  initial: AgreementFormValues;
  clients: AssignableClient[];
  clientsLoading?: boolean;
  groups?: AssignableGroup[];
  groupsLoading?: boolean;
  canCreateGroups?: boolean;
  submitting: boolean;
  submitLabel?: string;
  lockClient?: boolean;
  onSubmit: (v: AgreementFormValues) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<AgreementFormValues>(initial);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [groupOpen, setGroupOpen] = useState(initial.group_mode !== "none");

  const activeClientsQ = useQuery({
    queryKey: ["clients", "picker-active-agreement-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, commercial_name, legal_name, tax_id, tax_id_type, type")
        .eq("status", "active")
        .order("legal_name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !lockClient,
  });

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};

    if (!lockClient) {
      if (v.company_ids.length === 0)
        next.company_ids = "Selecciona al menos una empresa.";
      if (v.group_mode === "existing" && !v.group_id)
        next.group_id = "Selecciona un agrupador.";
      if (v.group_mode === "new" && !v.group_name.trim())
        next.group_name = "Indica el nombre del agrupador.";
    }

    if (!v.name.trim()) next.name = "El nombre del acuerdo es obligatorio.";
    if (v.scope === "unit" && !v.unit_name.trim())
      next.unit_name = "Indica el nombre de la unidad.";
    if (v.start_date && v.end_date && v.end_date < v.start_date)
      next.end_date = "La fecha final debe ser posterior a la inicial.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      setServerError(null);
      await onSubmit({
        ...v,
        company_mode: "multi",
        name: v.name.trim(),
        group_name: v.group_name.trim(),
        unit_name: v.scope === "unit" ? v.unit_name.trim() : "",
        observations: v.observations.trim(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      setServerError(
        message.toLowerCase().includes("permission") ||
          message.toLowerCase().includes("permis")
          ? "No tienes permisos para crear acuerdos con esta configuración."
          : message || "No fue posible crear el acuerdo. Intenta nuevamente.",
      );
    }
  }

  const hasGroups = (groups?.length ?? 0) > 0;
  const selectedGroup = groups?.find((g) => g.id === v.group_id);

  const allCompanies = activeClientsQ.data ?? [];
  const companyById = useMemo(() => {
    const m = new Map<string, (typeof allCompanies)[number]>();
    for (const c of allCompanies) m.set(c.id, c);
    return m;
  }, [allCompanies]);

  const filteredCompanies = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    if (!q) return allCompanies;
    return allCompanies.filter((c) => {
      const name = (c.commercial_name || c.legal_name || "").toLowerCase();
      const legal = (c.legal_name || "").toLowerCase();
      const tax = (c.tax_id || "").toLowerCase();
      return name.includes(q) || legal.includes(q) || tax.includes(q);
    });
  }, [allCompanies, companySearch]);

  const toggleCompany = (id: string) => {
    setV((prev) => {
      const set = new Set(prev.company_ids);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, company_ids: Array.from(set) };
    });
  };
  const removeCompany = (id: string) =>
    setV((prev) => ({
      ...prev,
      company_ids: prev.company_ids.filter((x) => x !== id),
    }));

  const selectedCount = v.company_ids.length;
  const countText =
    selectedCount === 0
      ? "Ninguna empresa seleccionada"
      : selectedCount === 1
        ? "1 empresa seleccionada"
        : `${selectedCount} empresas seleccionadas`;

  const submitDisabled =
    submitting || (!lockClient && (!v.name.trim() || selectedCount === 0));

  return (
    <form onSubmit={handle} className="space-y-8">
      {/* ============ Bloque 1 — Información del acuerdo ============ */}
      <section className="space-y-4">
        <header className="border-b border-border pb-2">
          <h2 className="text-base font-semibold">Información del acuerdo</h2>
        </header>

        <div className="space-y-2">
          <Label htmlFor="name">Nombre del acuerdo<Req /></Label>
          <Input
            id="name"
            placeholder="Acuerdo EPP 2026"
            value={v.name}
            onChange={(e) => setV({ ...v, name: e.target.value })}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label>Vigencia</Label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="start_date" className="text-xs text-muted-foreground">
                Desde
              </Label>
              <div className="relative">
                <Input
                  id="start_date"
                  className={dateInputClass}
                  type="date"
                  value={v.start_date}
                  onChange={(e) => setV({ ...v, start_date: e.target.value })}
                />
                <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="end_date" className="text-xs text-muted-foreground">
                Hasta
              </Label>
              <div className="relative">
                <Input
                  id="end_date"
                  className={dateInputClass}
                  type="date"
                  value={v.end_date}
                  onChange={(e) => setV({ ...v, end_date: e.target.value })}
                />
                <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
              {errors.end_date && (
                <p className="text-sm text-destructive">{errors.end_date}</p>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Si se indican, las fechas aplicarán por defecto a cada posición del
            acuerdo que no tenga vigencia propia.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Alcance<Req /></Label>
            <Select
              value={v.scope}
              onValueChange={(val) =>
                setV({
                  ...v,
                  scope: val as "global" | "unit",
                  unit_name: val === "global" ? "" : v.unit_name,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global (cobertura nacional)</SelectItem>
                <SelectItem value="unit">Unidad (cobertura por regional)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {v.scope === "unit" && (
            <div className="space-y-2">
              <Label htmlFor="unit_name">Nombre de la unidad<Req /></Label>
              <Input
                id="unit_name"
                placeholder="Ej. Bogotá DC"
                value={v.unit_name}
                onChange={(e) => setV({ ...v, unit_name: e.target.value })}
              />
              {errors.unit_name && (
                <p className="text-sm text-destructive">{errors.unit_name}</p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="observations">Observaciones</Label>
          <Textarea
            id="observations"
            rows={3}
            placeholder="Contexto del acuerdo, condiciones especiales…"
            value={v.observations}
            onChange={(e) => setV({ ...v, observations: e.target.value })}
          />
        </div>
      </section>

      {/* ============ Bloque 2 — Empresas cubiertas ============ */}
      {!lockClient && (
        <section className="space-y-3">
          <header className="border-b border-border pb-2">
            <h2 className="text-base font-semibold">
              Empresas cubiertas<Req />
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Selecciona una o varias empresas que cubre este acuerdo.
            </p>
          </header>

          {selectedCount > 0 && (
            <div className="flex flex-wrap gap-2">
              {v.company_ids.map((id) => {
                const c = companyById.get(id);
                const name = c?.commercial_name?.trim() || c?.legal_name || "—";
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 py-1 pl-3 pr-1 text-xs font-medium"
                  >
                    <span className="truncate max-w-[16rem]">{name}</span>
                    <button
                      type="button"
                      onClick={() => removeCompany(id)}
                      className="grid h-5 w-5 place-content-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
                      aria-label={`Quitar ${name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              placeholder="Buscar por nombre o NIT"
              className="pl-9"
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-md border border-border">
            {activeClientsQ.isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Cargando…
              </p>
            ) : filteredCompanies.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {companySearch.trim()
                  ? "Sin resultados."
                  : "No hay empresas disponibles."}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {filteredCompanies.map((c) => {
                  const name = c.commercial_name?.trim() || c.legal_name || "—";
                  const checked = v.company_ids.includes(c.id);
                  return (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/40">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleCompany(c.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">
                              {name}
                            </span>
                            {c.type === "holding" && (
                              <Badge color="accent" variant="soft">
                                Holding
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                            {c.tax_id_type ?? "NIT"} · {c.tax_id}
                          </p>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p
            className={cn(
              "text-xs",
              selectedCount === 0 ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {countText}
          </p>
          {errors.company_ids && (
            <p className="text-sm text-destructive">{errors.company_ids}</p>
          )}
        </section>
      )}

      {/* ============ Bloque 3 — Agrupar (opcional, plegable) ============ */}
      {!lockClient && (
        <Collapsible open={groupOpen} onOpenChange={setGroupOpen}>
          <section className="rounded-md border border-border bg-muted/20">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Layers className="h-4 w-4" />
                  <span className="font-medium text-foreground">
                    Agrupar acuerdo
                  </span>
                  <span>· opcional</span>
                  {v.group_mode !== "none" && (
                    <Badge color="accent" variant="soft">
                      {v.group_mode === "existing" ? "Existente" : "Nuevo"}
                    </Badge>
                  )}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    groupOpen && "rotate-180",
                  )}
                />
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="space-y-4 border-t border-border px-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Un agrupador reúne y organiza varios acuerdos en un solo lugar.
                  También puedes agruparlo más adelante.
                </p>

                <RadioGroup
                  value={v.group_mode === "none" ? "" : v.group_mode}
                  onValueChange={(val) =>
                    setV({
                      ...v,
                      group_mode: val as GroupMode,
                      group_id: val === "existing" ? v.group_id : "",
                      group_name: val === "new" ? v.group_name : "",
                    })
                  }
                  className="gap-3"
                >
                  {/* Existente */}
                  <label className="flex cursor-pointer gap-3 rounded-md border border-border bg-background p-3 hover:bg-muted/40">
                    <RadioGroupItem value="existing" className="mt-0.5" />
                    <div className="space-y-1">
                      <div className="text-sm font-medium">
                        Elegir un agrupador existente
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Suma este acuerdo a un agrupador que ya administras.
                      </p>
                    </div>
                  </label>

                  {/* Nuevo (deshabilitado si !canCreateGroups) */}
                  <label
                    className={cn(
                      "flex gap-3 rounded-md border border-border bg-background p-3",
                      canCreateGroups
                        ? "cursor-pointer hover:bg-muted/40"
                        : "cursor-not-allowed opacity-60",
                    )}
                  >
                    <RadioGroupItem
                      value="new"
                      disabled={!canCreateGroups}
                      className="mt-0.5"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        Crear un agrupador nuevo
                        {!canCreateGroups && (
                          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Empieza un agrupador desde este acuerdo; podrás sumarle
                        otros después.
                      </p>
                      {!canCreateGroups && (
                        <p className="text-xs text-muted-foreground">
                          Necesitas permiso para crear agrupadores. Solicítalo a
                          un administrador.
                        </p>
                      )}
                    </div>
                  </label>
                </RadioGroup>

                {v.group_mode === "existing" && (
                  <div className="space-y-2">
                    <Label>Agrupador<Req /></Label>
                    <Select
                      value={v.group_id}
                      onValueChange={(val) => setV({ ...v, group_id: val })}
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
                    {errors.group_id && (
                      <p className="text-sm text-destructive">{errors.group_id}</p>
                    )}
                    {selectedGroup && (
                      <p className="text-xs text-muted-foreground">
                        {selectedGroup.agreement_count} acuerdo(s) en este agrupador.
                      </p>
                    )}
                  </div>
                )}

                {v.group_mode === "new" && canCreateGroups && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="group_name">
                        Nombre del agrupador<Req />
                      </Label>
                      <Input
                        id="group_name"
                        placeholder="Ej. Cadena Éxito — Regionales"
                        value={v.group_name}
                        onChange={(e) =>
                          setV({ ...v, group_name: e.target.value })
                        }
                      />
                      {errors.group_name && (
                        <p className="text-sm text-destructive">
                          {errors.group_name}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </section>
        </Collapsible>
      )}

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitDisabled}>
          {submitting ? "Creando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
