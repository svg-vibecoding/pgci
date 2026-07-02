import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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

export type AgreementFormMode = "new_for_client" | "existing" | "free";

export type AgreementFormValues = {
  mode: AgreementFormMode;
  client_id: string;
  group_id: string;
  group_name: string;
  company_ids: string[];
  name: string;
  scope: "global" | "unit";
  unit_name: string;
  start_date: string;
  end_date: string;
  observations: string;
};

export const emptyAgreement: AgreementFormValues = {
  mode: "new_for_client",
  client_id: "",
  group_id: "",
  group_name: "",
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
  clients,
  clientsLoading,
  groups,
  groupsLoading,
  isSuperAdmin = false,
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
  isSuperAdmin?: boolean;
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

  // Clientes disponibles para el modo "free" (multi-select de empresas iniciales).
  const activeClientsQ = useQuery({
    queryKey: ["clients", "picker-active-agreement-free"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, commercial_name, legal_name, tax_id, tax_id_type, type")
        .eq("status", "active")
        .order("legal_name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: v.mode === "free" && isSuperAdmin,
  });

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (v.mode === "new_for_client" && !v.client_id)
      next.client_id = "Selecciona un cliente.";
    if (v.mode === "existing" && !v.group_id)
      next.group_id = "Selecciona un agrupador.";
    if (v.mode === "free" && !v.group_name.trim())
      next.group_name = "Indica el nombre del agrupador.";
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

  const hasClients = (clients?.length ?? 0) > 0;
  const hasGroups = (groups?.length ?? 0) > 0;
  const selectedClient = clients.find((c) => c.id === v.client_id);
  const selectedGroup = groups?.find((g) => g.id === v.group_id);

  const filteredCompanies = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    const list = activeClientsQ.data ?? [];
    if (!q) return list;
    return list.filter((c) => {
      const name = (c.commercial_name || c.legal_name || "").toLowerCase();
      const legal = (c.legal_name || "").toLowerCase();
      const tax = (c.tax_id || "").toLowerCase();
      return name.includes(q) || legal.includes(q) || tax.includes(q);
    });
  }, [activeClientsQ.data, companySearch]);

  const toggleCompany = (id: string) => {
    setV((prev) => {
      const set = new Set(prev.company_ids);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, company_ids: Array.from(set) };
    });
  };

  const modeOptions: { value: AgreementFormMode; label: string; hint: string; disabled?: boolean }[] =
    [
      {
        value: "new_for_client",
        label: "Nuevo agrupador para un cliente",
        hint: "Crea un agrupador dedicado a un cliente y vincula esa empresa automáticamente.",
      },
      {
        value: "existing",
        label: "Agrupador existente",
        hint: "Suma este acuerdo a un agrupador ya creado.",
        disabled: !hasGroups && !groupsLoading,
      },
      ...(isSuperAdmin
        ? [
            {
              value: "free" as const,
              label: "Agrupador libre (super admin)",
              hint: "Crea un agrupador sin cliente principal y vincula varias empresas.",
            },
          ]
        : []),
    ];

  return (
    <form onSubmit={handle} className="space-y-5">
      {/* Selector de modo de agrupador */}
      {!lockClient && (
        <div className="space-y-2">
          <Label>Agrupador<Req /></Label>
          <div className="grid gap-2 md:grid-cols-2">
            {modeOptions.map((opt) => {
              const selected = v.mode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => setV({ ...v, mode: opt.value })}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/40",
                    opt.disabled && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-block h-3 w-3 rounded-full border",
                        selected ? "border-primary bg-primary" : "border-muted-foreground/40",
                      )}
                    />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </div>
                  <p className="mt-1 pl-5 text-xs text-muted-foreground">{opt.hint}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Campos por modo */}
      {v.mode === "new_for_client" && (
        <div className="space-y-2">
          <Label>Cliente<Req /></Label>
          {lockClient && selectedClient ? (
            <Input
              value={selectedClient.commercial_name?.trim() || selectedClient.legal_name}
              disabled
              readOnly
            />
          ) : (
            <Select
              value={v.client_id}
              onValueChange={(val) => setV({ ...v, client_id: val })}
              disabled={clientsLoading || !hasClients}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    clientsLoading
                      ? "Cargando clientes…"
                      : hasClients
                        ? "Selecciona un cliente"
                        : "No tienes clientes habilitados"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.commercial_name?.trim() || c.legal_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {errors.client_id && (
            <p className="text-sm text-destructive">{errors.client_id}</p>
          )}
          {!clientsLoading && !hasClients && !lockClient && (
            <p className="text-xs text-muted-foreground">
              Solo verás clientes para los que tienes permiso de creación de acuerdos.
            </p>
          )}
        </div>
      )}

      {v.mode === "existing" && (
        <div className="space-y-2">
          <Label>Agrupador existente<Req /></Label>
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

      {v.mode === "free" && isSuperAdmin && (
        <>
          <div className="space-y-2">
            <Label htmlFor="group_name">Nombre del agrupador<Req /></Label>
            <Input
              id="group_name"
              placeholder="Ej. Cadena Éxito — Regionales"
              value={v.group_name}
              onChange={(e) => setV({ ...v, group_name: e.target.value })}
            />
            {errors.group_name && (
              <p className="text-sm text-destructive">{errors.group_name}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Empresas iniciales (opcional)</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                placeholder="Buscar por nombre o NIT…"
                className="pl-9"
              />
            </div>
            <div className="max-h-64 overflow-y-auto rounded-md border border-border">
              {activeClientsQ.isLoading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>
              ) : filteredCompanies.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {companySearch.trim() ? "Sin resultados." : "No hay clientes disponibles."}
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
                              <span className="truncate text-sm font-medium">{name}</span>
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
            {v.company_ids.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {v.company_ids.length} empresa(s) seleccionada(s).
              </p>
            )}
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Nombre del acuerdo<Req /></Label>
        <Input
          id="name"
          placeholder="Ej. Acuerdo 2026 — Lista Bogotá"
          value={v.name}
          onChange={(e) => setV({ ...v, name: e.target.value })}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="start_date">Fecha inicial</Label>
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
        <div className="space-y-2">
          <Label htmlFor="end_date">Fecha final</Label>
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
          placeholder="Contexto del acuerdo, vigencia, condiciones especiales…"
          value={v.observations}
          onChange={(e) => setV({ ...v, observations: e.target.value })}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Al crear el acuerdo, en los siguientes pasos podrás cargar su información comercial (productos y precios), asignar usuarios para su gestión y/o consulta y, si aplica, vincular otras empresas cubiertas por este acuerdo.
      </p>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
