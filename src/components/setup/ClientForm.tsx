import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type TaxIdType = "NIT";

export type ClientFormValues = {
  commercial_name: string;
  legal_name: string;
  erp_name: string;
  type: "holding" | "direct" | "";
  status: "active" | "inactive";
  tax_id: string;
  tax_id_type: TaxIdType;
  notes: string;
  parent_client_id: string | null;
  belongs_to_holding: boolean;
};

export const emptyClient: ClientFormValues = {
  commercial_name: "",
  legal_name: "",
  erp_name: "",
  type: "",
  status: "active",
  tax_id: "",
  tax_id_type: "NIT",
  notes: "",
  parent_client_id: null,
  belongs_to_holding: false,
};

function Req() {
  return <span className="text-primary"> *</span>;
}

export function ClientForm({
  initial,
  submitting,
  submitLabel = "Guardar",
  onSubmit,
  onCancel,
  excludeHoldingId,
}: {
  initial: ClientFormValues;
  submitting: boolean;
  submitLabel?: string;
  onSubmit: (v: ClientFormValues) => Promise<void> | void;
  onCancel: () => void;
  excludeHoldingId?: string;
}) {
  const [v, setV] = useState<ClientFormValues>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof ClientFormValues, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: holdings } = useQuery({
    queryKey: ["clients", "holdings-active", excludeHoldingId ?? null],
    queryFn: async () => {
      let q = supabase
        .from("clients")
        .select("id, commercial_name, legal_name")
        .eq("type", "holding")
        .eq("status", "active")
        .order("commercial_name");
      if (excludeHoldingId) q = q.neq("id", excludeHoldingId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: v.type === "direct" && v.belongs_to_holding,
  });

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!v.legal_name.trim()) next.legal_name = "La razón social es obligatoria.";
    if (!v.type) next.type = "Selecciona si el cliente es holding o directo.";
    const taxIdDigits = v.tax_id.trim().replace(/\D/g, "");
    if (!taxIdDigits) next.tax_id = "El NIT / identificación tributaria es obligatorio.";
    else if (taxIdDigits.length < 9 || taxIdDigits.length > 10) next.tax_id = "El NIT debe tener entre 9 y 10 dígitos numéricos.";
    if (v.type === "direct" && v.belongs_to_holding && !v.parent_client_id) {
      next.parent_client_id = "Selecciona el holding asociado.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const parent_client_id =
      v.type === "direct" && v.belongs_to_holding ? v.parent_client_id : null;

    const payload: ClientFormValues = {
      ...v,
      tax_id: taxIdDigits,
      tax_id_type: "NIT",
      parent_client_id,
    };

    try {
      setServerError(null);
      await onSubmit(payload);
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      const code = String(err?.code ?? "");
      if (code === "23505" || msg.includes("duplicate") || msg.includes("unique")) {
        if (msg.includes("tax_id")) {
          setErrors((p) => ({ ...p, tax_id: "Ya existe un cliente con esta identificación tributaria." }));
        } else {
          setServerError("Ya existe un cliente con esta identificación tributaria.");
        }
      } else {
        setServerError("No fue posible guardar el cliente. Intenta nuevamente.");
      }
    }
  }

  return (
    <form onSubmit={handle} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="legal_name">Razón social<Req /></Label>
        <Input
          id="legal_name"
          value={v.legal_name}
          onChange={(e) => setV({ ...v, legal_name: e.target.value })}
        />
        {errors.legal_name && (
          <p className="text-sm text-destructive">{errors.legal_name}</p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="commercial_name">Nombre comercial</Label>
          <Input
            id="commercial_name"
            value={v.commercial_name}
            onChange={(e) => setV({ ...v, commercial_name: e.target.value })}
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
          <Label htmlFor="tax_id_type">Tipo ID</Label>
          <Input id="tax_id_type" value="NIT" disabled readOnly />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tax_id">NIT<Req /></Label>
          <Input
            id="tax_id"
            inputMode="numeric"
            maxLength={10}
            value={v.tax_id}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
              setV({ ...v, tax_id: digits });
            }}
          />
          {errors.tax_id && (
            <p className="text-sm text-destructive">{errors.tax_id}</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Tipo de cliente<Req /></Label>
          <Select
            value={v.type}
            onValueChange={(val) =>
              setV({
                ...v,
                type: val as "holding" | "direct",
                belongs_to_holding: val === "holding" ? false : v.belongs_to_holding,
                parent_client_id: val === "holding" ? null : v.parent_client_id,
              })
            }
          >
            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="holding">Holding</SelectItem>
              <SelectItem value="direct">Directo</SelectItem>
            </SelectContent>
          </Select>
          {errors.type && <p className="text-sm text-destructive">{errors.type}</p>}
        </div>
        <div className="space-y-2">
          <Label>Estado<Req /></Label>
          <Select value={v.status} onValueChange={(val) => setV({ ...v, status: val as "active" | "inactive" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Activo</SelectItem>
              <SelectItem value="inactive">Inactivo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {v.type === "direct" && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="belongs_to_holding" className="text-sm font-medium">
                ¿Pertenece a un holding?
              </Label>
              <p className="text-xs text-muted-foreground">
                Relaciona este cliente con un holding registrado.
              </p>
            </div>
            <Switch
              id="belongs_to_holding"
              checked={v.belongs_to_holding}
              onCheckedChange={(checked) =>
                setV({
                  ...v,
                  belongs_to_holding: checked,
                  parent_client_id: checked ? v.parent_client_id : null,
                })
              }
            />
          </div>
          {v.belongs_to_holding && (
            <div className="space-y-2">
              <Label>Holding asociado<Req /></Label>
              <Select
                value={v.parent_client_id ?? ""}
                onValueChange={(val) => setV({ ...v, parent_client_id: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un holding" />
                </SelectTrigger>
                <SelectContent>
                  {(holdings ?? []).map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.commercial_name?.trim() || h.legal_name}
                    </SelectItem>
                  ))}
                  {holdings && holdings.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No hay holdings activos disponibles.
                    </div>
                  )}
                </SelectContent>
              </Select>
              {errors.parent_client_id && (
                <p className="text-sm text-destructive">{errors.parent_client_id}</p>
              )}
            </div>
          )}
        </div>
      )}

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
      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
