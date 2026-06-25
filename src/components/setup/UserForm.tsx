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
  role: "super_admin" | "platform_user" | "";
  can_create_agreements: boolean;
  erp_user_code: string;
  status: "active" | "inactive";
};

export const emptyUser: UserFormValues = {
  full_name: "",
  email: "",
  role: "",
  can_create_agreements: false,
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
    if (!v.role) e.role = "Requerido";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

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
          <Label htmlFor="role">
            Rol<Req />
          </Label>
          <Select
            value={v.role || undefined}
            onValueChange={(val) => set("role", val as UserFormValues["role"])}
          >
            <SelectTrigger id="role">
              <SelectValue placeholder="Selecciona un rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="platform_user">Usuario plataforma</SelectItem>
              <SelectItem value="super_admin">Super admin</SelectItem>
            </SelectContent>
          </Select>
          {errors.role && <p className="mt-1 text-xs text-destructive">{errors.role}</p>}
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

        <div className="md:col-span-2">
          <Label htmlFor="erp_user_code">Código de usuario ERP</Label>
          <Input
            id="erp_user_code"
            value={v.erp_user_code}
            onChange={(e) => set("erp_user_code", e.target.value)}
            maxLength={40}
            placeholder="Opcional"
          />
        </div>

        {v.role === "platform_user" && (
          <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <div>
              <p className="text-sm font-medium">Puede crear acuerdos</p>
              <p className="text-xs text-muted-foreground">
                Permite a este usuario crear acuerdos para los clientes a los que tiene acceso.
              </p>
            </div>
            <Switch
              checked={v.can_create_agreements}
              onCheckedChange={(checked) => set("can_create_agreements", checked)}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
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
