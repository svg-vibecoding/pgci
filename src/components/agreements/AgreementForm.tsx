import { useState } from "react";
import { Button } from "@/components/ui/button";
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

export type AgreementFormValues = {
  client_id: string;
  name: string;
  scope: "global" | "unit";
  unit_name: string;
  start_date: string;
  end_date: string;
  observations: string;
};

export const emptyAgreement: AgreementFormValues = {
  client_id: "",
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

function Req() {
  return <span className="text-primary"> *</span>;
}

export function AgreementForm({
  initial,
  clients,
  clientsLoading,
  submitting,
  submitLabel = "Crear acuerdo",
  lockClient = false,
  onSubmit,
  onCancel,
}: {
  initial: AgreementFormValues;
  clients: AssignableClient[];
  clientsLoading?: boolean;
  submitting: boolean;
  submitLabel?: string;
  lockClient?: boolean;
  onSubmit: (v: AgreementFormValues) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<AgreementFormValues>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof AgreementFormValues, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!v.client_id) next.client_id = "Selecciona un cliente.";
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
        unit_name: v.scope === "unit" ? v.unit_name.trim() : "",
        observations: v.observations.trim(),
      });
    } catch (err: any) {
      setServerError(
        err?.message?.includes("permission")
          ? "No tienes permisos para crear acuerdos sobre este cliente."
          : "No fue posible crear el acuerdo. Intenta nuevamente.",
      );
    }
  }

  const hasClients = (clients?.length ?? 0) > 0;
  const selectedClient = clients.find((c) => c.id === v.client_id);

  return (
    <form onSubmit={handle} className="space-y-5">
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
          <Input
            id="start_date"
            type="date"
            value={v.start_date}
            onChange={(e) => setV({ ...v, start_date: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">Fecha final</Label>
          <Input
            id="end_date"
            type="date"
            value={v.end_date}
            onChange={(e) => setV({ ...v, end_date: e.target.value })}
          />
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

      <p className="text-xs text-muted-foreground">
        Después de crear el acuerdo podrás agregar líneas de productos, cargar precios desde Excel y asignar miembros.
      </p>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting || !hasClients}>
          {submitting ? "Creando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
