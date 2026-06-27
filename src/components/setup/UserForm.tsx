import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  new_password?: string;
};

export const emptyUser: UserFormValues = {
  full_name: "",
  email: "",
  role: "platform_user",
  erp_user_code: "",
  status: "active",
  new_password: "",
};

function Req() {
  return <span className="text-primary"> *</span>;
}

export function UserForm({
  initial,
  submitting,
  submitLabel = "Crear usuario",
  showPasswordSection = false,
  onSubmit,
  onCancel,
}: {
  initial: UserFormValues;
  submitting: boolean;
  submitLabel?: string;
  showPasswordSection?: boolean;
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
    if (v.new_password && v.new_password.length > 0 && v.new_password.length < 8) {
      e.new_password = "Mínimo 8 caracteres";
    }
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
            onChange={(e) => set("email", e.target.value)}
            maxLength={255}
          />
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
          <h3 className="text-sm font-semibold">Permisos de administración</h3>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Super administrador</p>
                <p className="text-xs text-muted-foreground">
                  Los super admins tienen acceso total a la plataforma.
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
        </div>

        {showPasswordSection && (
          <div className="md:col-span-2 space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold">Contraseña</h3>
            <p className="text-xs text-muted-foreground">
              Asigna una nueva contraseña temporal a este usuario. Deberás compartirla manualmente.
            </p>
            <div>
              <Label htmlFor="new_password">Nueva contraseña temporal</Label>
              <Input
                id="new_password"
                type="text"
                value={v.new_password ?? ""}
                onChange={(e) => set("new_password", e.target.value)}
                maxLength={72}
                placeholder="Opcional"
                autoComplete="off"
              />
              {errors.new_password && (
                <p className="mt-1 text-xs text-destructive">{errors.new_password}</p>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Al crear el usuario se generará automáticamente una contraseña temporal que deberás compartirle. En el siguiente paso podrás configurar su cartera de clientes y sus permisos de gestión comercial.
      </p>

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
