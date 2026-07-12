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
  can_create_agreement_groups: boolean;
  new_password?: string;
};

export const emptyUser: UserFormValues = {
  full_name: "",
  email: "",
  role: "platform_user",
  erp_user_code: "",
  status: "active",
  can_create_agreement_groups: false,
  new_password: "",
};

function Req() {
  return <span className="text-primary"> *</span>;
}

function PermissionRow({
  id,
  label,
  helpText,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  helpText: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <p className="suma-body text-text-primary font-semibold">{label}</p>
        <p className="suma-caption text-text-tertiary">{helpText}</p>
      </div>
      <div className="flex items-center gap-2 pt-0.5">
        <Label htmlFor={id} className="sr-only">
          {label}
        </Label>
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  );
}

export function UserForm({
  initial,
  submitting,
  submitLabel = "Crear usuario",
  showPasswordSection = false,
  isEditing = false,
  onSubmit,
  onCancel,
}: {
  initial: UserFormValues;
  submitting: boolean;
  submitLabel?: string;
  showPasswordSection?: boolean;
  isEditing?: boolean;
  onSubmit: (v: UserFormValues) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<UserFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [passwordOpen, setPasswordOpen] = useState(false);

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
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!validate()) return;
        // Super admins never persist granular admin permissions.
        const payload: UserFormValues = isSuper
          ? { ...v, can_create_agreement_groups: false }
          : v;
        void Promise.resolve(onSubmit(payload)).catch(() => {
          // The route-level mutation handlers show the error toast.
        });
      }}
    >
      {/* 1. Rol global */}
      <section className="space-y-2">
        <h3 className="suma-h4 text-text-primary">Rol del usuario</h3>
        <div className="rounded-lg border border-border bg-card p-4">
          <PermissionRow
            id="super_admin"
            label="Super administrador"
            helpText="Los super administradores tienen acceso total a la plataforma. "
            checked={isSuper}
            onCheckedChange={(checked) =>
              set("role", checked ? "super_admin" : "platform_user")
            }
          />
        </div>
      </section>

      {/* 2. Identidad del usuario */}
      <section className="space-y-2">
        
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
            {errors.full_name && (
              <p className="mt-1 suma-caption text-destructive">{errors.full_name}</p>
            )}
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
            {errors.email && <p className="mt-1 suma-caption text-destructive">{errors.email}</p>}
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
        </div>
      </section>

      {/* 3. Permisos de administración — solo para platform_user */}
      {!isSuper && (
        <section className="space-y-2">
          <h3 className="suma-h4 text-text-primary">Permisos de administración</h3>
          <div className="rounded-lg border border-border bg-card p-4">
            <PermissionRow
              id="can_create_agreement_groups"
              label="Puede crear agrupadores de acuerdos"
              helpText="Podrá crear agrupadores para reunir y organizar varios acuerdos en un solo lugar."
              checked={v.can_create_agreement_groups}
              onCheckedChange={(checked) => set("can_create_agreement_groups", checked)}
            />
          </div>
        </section>
      )}

      {/* 4. Password (solo edición) */}
      {showPasswordSection && (
        <section>
          {!passwordOpen ? (
            <button
              type="button"
              onClick={() => setPasswordOpen(true)}
              className="suma-body font-medium text-primary hover:text-primary/80 hover:underline"
            >
              Asignar nueva contraseña
            </button>
          ) : (
            <div className="space-y-2 border-t border-border pt-4">
              <h3 className="suma-h4 text-text-primary">Contraseña</h3>
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
                  <p className="mt-1 suma-caption text-destructive">{errors.new_password}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPasswordOpen(false);
                  set("new_password", "");
                }}
                className="suma-caption text-text-tertiary hover:text-text-primary hover:underline"
              >
                Cancelar
              </button>
            </div>
          )}
        </section>
      )}

      {/* 5. Bloque informativo */}
      {!isEditing && (
        <Alert variant="info">
          <Info className="h-4 w-4" />
          <AlertDescription>
            {isSuper
              ? "Al crear el usuario se generará automáticamente una contraseña temporal que deberás compartirle directamente. Los super admins tienen acceso total a la plataforma y no requieren configuración de cartera de clientes."
              : "Al crear el usuario se generará automáticamente una contraseña temporal que deberás compartirle directamente. En el paso siguiente podrás configurar su cartera de clientes y sus permisos de gestión comercial."}
          </AlertDescription>
        </Alert>
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
