import { useState } from "react";
import { Info } from "lucide-react";
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
  erp_user_code: string;
  status: "active" | "inactive";
};

export const emptyUser: UserFormValues = {
  full_name: "",
  email: "",
  role: "platform_user",
  erp_user_code: "",
  status: "active",
};

function Req() {
  return <span className="text-primary"> *</span>;
}

export function UserForm({
  initial,
  submitting,
  submitLabel = "Crear usuario",
  emailLocked = false,
  onSubmit,
  onCancel,
}: {
  initial: UserFormValues;
  submitting: boolean;
  submitLabel?: string;
  emailLocked?: boolean;
  onSubmit: (v: UserFormValues) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<UserFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof UserFormValues>(k: K, val: UserFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!v.full_name.trim()) e.full_name = "Requerido";
    if (!v.email.trim()) e.email = "Requerido";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = "Email inválido";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

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
