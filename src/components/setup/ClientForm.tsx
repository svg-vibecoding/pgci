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

export type ClientFormValues = {
  commercial_name: string;
  legal_name: string;
  erp_name: string;
  type: "holding" | "direct" | "";
  status: "active" | "inactive";
  notes: string;
};

export const emptyClient: ClientFormValues = {
  commercial_name: "",
  legal_name: "",
  erp_name: "",
  type: "",
  status: "active",
  notes: "",
};

export function ClientForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial: ClientFormValues;
  submitting: boolean;
  onSubmit: (v: ClientFormValues) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<ClientFormValues>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof ClientFormValues, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!v.commercial_name.trim())
      next.commercial_name = "El nombre comercial del cliente es obligatorio.";
    if (!v.type) next.type = "Selecciona si el cliente es holding o directo.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    try {
      setServerError(null);
      await onSubmit(v);
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("duplicate") || msg.includes("unique"))
        setServerError("Ya existe un cliente con este nombre.");
      else setServerError("No fue posible guardar el cliente. Intenta nuevamente.");
    }
  }

  return (
    <form onSubmit={handle} className="space-y-5 max-w-2xl">
      <div className="space-y-2">
        <Label htmlFor="commercial_name">Nombre comercial *</Label>
        <Input
          id="commercial_name"
          value={v.commercial_name}
          onChange={(e) => setV({ ...v, commercial_name: e.target.value })}
        />
        {errors.commercial_name && (
          <p className="text-sm text-destructive">{errors.commercial_name}</p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="legal_name">Razón social / Nombre legal</Label>
          <Input
            id="legal_name"
            value={v.legal_name}
            onChange={(e) => setV({ ...v, legal_name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="erp_name">Nombre ERP</Label>
          <Input
            id="erp_name"
            value={v.erp_name}
            onChange={(e) => setV({ ...v, erp_name: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Tipo *</Label>
          <Select value={v.type} onValueChange={(val) => setV({ ...v, type: val as any })}>
            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="holding">Holding</SelectItem>
              <SelectItem value="direct">Directo</SelectItem>
            </SelectContent>
          </Select>
          {errors.type && <p className="text-sm text-destructive">{errors.type}</p>}
        </div>
        <div className="space-y-2">
          <Label>Estado</Label>
          <Select value={v.status} onValueChange={(val) => setV({ ...v, status: val as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Activo</SelectItem>
              <SelectItem value="inactive">Inactivo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notas internas</Label>
        <Textarea
          id="notes"
          rows={3}
          value={v.notes}
          onChange={(e) => setV({ ...v, notes: e.target.value })}
        />
      </div>
      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Guardando…" : "Guardar"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
