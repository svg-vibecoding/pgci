import { useEffect, useMemo, useState } from "react";
import { Info, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type UserFormValues = {
  full_name: string;
  email: string;
  role: "super_admin" | "platform_user";
  can_create_agreements: boolean;
  erp_user_code: string;
  status: "active" | "inactive";
  client_ids: string[];
};

export const emptyUser: UserFormValues = {
  full_name: "",
  email: "",
  role: "platform_user",
  can_create_agreements: false,
  erp_user_code: "",
  status: "active",
  client_ids: [],
};

export type ClientOption = {
  id: string;
  commercial_name: string | null;
  legal_name: string;
  type: string;
  parent_client_id?: string | null;
  parent?: { commercial_name: string | null; legal_name: string } | null;
};

function Req() {
  return <span className="text-primary"> *</span>;
}

export function UserForm({
  initial,
  submitting,
  submitLabel = "Crear usuario",
  emailLocked = false,
  clients,
  onSubmit,
  onCancel,
}: {
  initial: UserFormValues;
  submitting: boolean;
  submitLabel?: string;
  emailLocked?: boolean;
  /** When provided, renders the "Clientes asignados" section. */
  clients?: ClientOption[];
  onSubmit: (v: UserFormValues) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<UserFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [clientSearch, setClientSearch] = useState("");
  const [showAllChips, setShowAllChips] = useState(false);

  const set = <K extends keyof UserFormValues>(k: K, val: UserFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const toggleClient = (id: string, checked: boolean) => {
    setV((prev) => ({
      ...prev,
      client_ids: checked
        ? Array.from(new Set([...prev.client_ids, id]))
        : prev.client_ids.filter((c) => c !== id),
    }));
  };

  const clientById = useMemo(() => {
    const map = new Map<string, ClientOption>();
    (clients ?? []).forEach((c) => map.set(c.id, c));
    return map;
  }, [clients]);

  const selectedClients = useMemo(
    () =>
      v.client_ids
        .map((id) => clientById.get(id))
        .filter((c): c is ClientOption => !!c),
    [v.client_ids, clientById],
  );

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    const list = [...(clients ?? [])].sort((a, b) => {
      const an = (a.commercial_name?.trim() || a.legal_name).toLocaleLowerCase("es");
      const bn = (b.commercial_name?.trim() || b.legal_name).toLocaleLowerCase("es");
      return an.localeCompare(bn, "es", { sensitivity: "base" });
    });
    if (!q) return list;
    return list.filter((c) => {
      const name = (c.commercial_name?.trim() || c.legal_name).toLowerCase();
      return name.includes(q) || c.legal_name.toLowerCase().includes(q);
    });
  }, [clients, clientSearch]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!v.full_name.trim()) e.full_name = "Requerido";
    if (!v.email.trim()) e.email = "Requerido";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = "Email inválido";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const showClientsSection = !!clients;
  const isSuper = v.role === "super_admin";

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!validate()) return;
        onSubmit(v);
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="full_name">
            Nombre completo<Req />
          </Label>
          <Input
            id="full_name"
            value={v.full_name}
            onChange={(e) => set("full_name", e.target.value)}
            maxLength={120}
          />
          {errors.full_name && <p className="mt-1 text-xs text-destructive">{errors.full_name}</p>}
        </div>

        <div>
          <Label htmlFor="email">
            Email<Req />
          </Label>
          <Input
            id="email"
            type="email"
            value={v.email}
            disabled={emailLocked}
            onChange={(e) => set("email", e.target.value)}
            maxLength={255}
          />
          {emailLocked && (
            <p className="mt-1 text-xs text-muted-foreground">
              El email no se puede modificar.
            </p>
          )}
          {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
        </div>

        <div>
          <Label htmlFor="erp_user_code">Código de usuario ERP</Label>
          <Input
            id="erp_user_code"
            value={v.erp_user_code}
            onChange={(e) => set("erp_user_code", e.target.value)}
            maxLength={40}
            placeholder="Opcional"
          />
        </div>

        <div>
          <Label htmlFor="status">Estado</Label>
          <Select
            value={v.status}
            onValueChange={(val) => set("status", val as UserFormValues["status"])}
          >
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Activo</SelectItem>
              <SelectItem value="inactive">Inactivo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-2 space-y-2">
          <h3 className="text-sm font-semibold">Tipo de usuario</h3>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Usuario plataforma</p>
                <p className="text-xs text-muted-foreground">
                  Acceso según clientes asignados.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="super_admin" className="text-sm font-medium">
                  Super admin
                </Label>
                <Switch
                  id="super_admin"
                  checked={isSuper}
                  onCheckedChange={(checked) =>
                    set("role", checked ? "super_admin" : "platform_user")
                  }
                />
              </div>
            </div>
          </div>

          {isSuper && (
            <Alert variant="info">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Los super admins tienen acceso total a la plataforma y no requieren asignación
                manual de clientes.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      {showClientsSection && !isSuper && (
        <section className="rounded-lg border border-border bg-card">
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Clientes asignados</h2>
              <p className="text-xs text-muted-foreground">
                Selecciona los clientes a los que tendrá acceso este usuario.
              </p>
            </div>
            <span
              className={
                "rounded-md px-2 py-1 text-xs font-medium " +
                (v.client_ids.length === 0
                  ? "bg-muted text-muted-foreground"
                  : "bg-emerald-100 text-emerald-700")
              }
            >
              {v.client_ids.length === 1
                ? "1 seleccionado"
                : `${v.client_ids.length} seleccionados`}
            </span>
          </header>

          <div className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Buscar cliente…"
                  className="pl-9"
                />
              </div>
              {(() => {
                const visibleIds = filteredClients.map((c) => c.id);
                const allSelected =
                  visibleIds.length > 0 && visibleIds.every((id) => v.client_ids.includes(id));
                return (
                  <label className="flex shrink-0 items-center gap-2 text-sm">
                    <span className="text-muted-foreground">
                      {clientSearch.trim() ? "Seleccionar visibles" : "Todos"}
                    </span>
                    <Switch
                      checked={allSelected}
                      disabled={visibleIds.length === 0}
                      onCheckedChange={(checked) =>
                        setV((prev) => ({
                          ...prev,
                          client_ids: checked
                            ? Array.from(new Set([...prev.client_ids, ...visibleIds]))
                            : prev.client_ids.filter((id) => !visibleIds.includes(id)),
                        }))
                      }
                    />
                  </label>
                );
              })()}
            </div>

            {selectedClients.length > 0 && (
              <div className="rounded-md border border-border bg-muted/30 p-2">
                <div
                  className={
                    "flex flex-wrap gap-1.5 overflow-hidden " +
                    (showAllChips ? "" : "max-h-[68px]")
                  }
                >
                  {selectedClients.map((c) => {
                    const name = c.commercial_name?.trim() || c.legal_name;
                    return (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs"
                      >
                        <span className="max-w-[180px] truncate">{name}</span>
                        <button
                          type="button"
                          aria-label={`Quitar ${name}`}
                          onClick={() => toggleClient(c.id, false)}
                          className="rounded-sm text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
                {selectedClients.length > 8 && (
                  <button
                    type="button"
                    onClick={() => setShowAllChips((s) => !s)}
                    className="mt-2 text-xs font-medium text-primary hover:underline"
                  >
                    {showAllChips ? "Ocultar" : `Ver todos (${selectedClients.length})`}
                  </button>
                )}
              </div>
            )}

            <div className="max-h-72 divide-y divide-border overflow-y-auto rounded-md border border-border">
              {filteredClients.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {(clients?.length ?? 0) === 0
                    ? "No hay clientes activos disponibles."
                    : "Sin resultados."}
                </p>
              ) : (
                filteredClients.map((c) => {
                  const name = c.commercial_name?.trim() || c.legal_name;
                  const checked = v.client_ids.includes(c.id);
                  const isHolding = c.type === "holding";
                  const parentName = c.parent?.commercial_name?.trim() || c.parent?.legal_name || null;
                  return (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{name}</p>
                          {isHolding && (
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                              Holding
                            </span>
                          )}
                        </div>
                        {!isHolding && parentName && (
                          <p className="truncate text-xs text-muted-foreground">{parentName}</p>
                        )}
                      </div>
                      <Switch
                        checked={checked}
                        onCheckedChange={(val) => toggleClient(c.id, val)}
                      />
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </section>
      )}

      {!isSuper && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
          <div>
            <p className="text-sm font-medium">Puede crear acuerdos en clientes asignados</p>
            <p className="text-xs text-muted-foreground">
              Permite a este usuario crear acuerdos para todos los clientes que tenga asignados.
            </p>
          </div>
          <Switch
            checked={v.can_create_agreements}
            onCheckedChange={(checked) => set("can_create_agreements", checked)}
          />
        </div>
      )}

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
