import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusBadge, Badge } from "@/components/sumatec";
import { useIsSuperAdmin } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Pencil,
  Power,
  Building2,
  AlertTriangle,
  Info,
  Lock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/setup/users/$userId/")({
  head: () => ({ meta: [{ title: "Usuario · Setup · PGCI" }] }),
  component: UserDetail,
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-sm text-foreground">{children}</div>
    </div>
  );
}

function IndicatorCard({
  label,
  value,
  hint,
  dotColor = "muted",
  tone = "default",
  tag,
  icon,
  children,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  dotColor?: "primary" | "accent" | "muted";
  tone?: "default" | "warning" | "muted";
  tag?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const dotClass = {
    primary: "bg-primary",
    accent: "bg-accent",
    muted: "bg-muted-foreground",
  }[dotColor];

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon ? (
            <span className="text-primary">{icon}</span>
          ) : (
            <span className={cn("h-2 w-2 shrink-0 rounded-full", dotClass)} />
          )}
          <p className="suma-overline text-[10px]">{label}</p>
        </div>
        {tag}
      </div>
      <div className="mt-3">
        <p
          className={cn(
            "font-body text-xl font-semibold leading-tight text-foreground",
            tone === "muted" && "text-muted-foreground"
          )}
        >
          {value}
        </p>
        {hint && (
          <p
            className={cn(
              "mt-1 text-xs text-muted-foreground",
              tone === "warning" && "font-medium text-warning-strong"
            )}
          >
            {hint}
          </p>
        )}
      </div>
      {children && (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          {children}
        </div>
      )}
    </div>
  );
}

const roleLabel = (r: string) =>
  r === "super_admin" ? "Super admin" : "Usuario plataforma";

const ADMIN_ROLES = new Set(["agreement_admin", "super_admin"]);

function UserDetail() {
  const { userId } = Route.useParams();
  const qc = useQueryClient();
  const { isSuperAdmin } = useIsSuperAdmin();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ["users", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: access } = useQuery({
    queryKey: ["users", userId, "access"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_client_access")
        .select("id, client_id, created_at, clients ( id, commercial_name, legal_name, type, status )")
        .eq("user_id", userId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: memberships } = useQuery({
    queryKey: ["users", userId, "agreement_members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreement_members")
        .select("id, agreement_id, role")
        .eq("user_id", userId);
      if (error) return [];
      return data ?? [];
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async (next: "active" | "inactive") => {
      const { error } = await supabase
        .from("profiles")
        .update({ status: next })
        .eq("user_id", userId);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success(next === "active" ? "Usuario activado." : "Usuario inactivado.");
      setConfirmOpen(false);
    },
    onError: () => toast.error("No fue posible cambiar el estado."),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!user) return <p className="text-sm text-muted-foreground">No encontrado.</p>;

  const isActive = user.status === "active";
  const isSuper = user.role === "super_admin";
  const assignedCount = access?.length ?? 0;
  const totalAgreements = memberships?.length ?? 0;
  const adminCount = (memberships ?? []).filter((m) => ADMIN_ROLES.has(m.role)).length;
  const participantCount = totalAgreements - adminCount;

  const clientsValue = isSuper
    ? "Acceso total"
    : `${assignedCount} ${assignedCount === 1 ? "cliente" : "clientes"}`;
  const clientsHint = isSuper
    ? "Todos los clientes"
    : assignedCount === 0
      ? "Requiere asignación"
      : "Cartera asignada";

  const agreementsValue = isSuper
    ? "Acceso total"
    : `${totalAgreements} ${totalAgreements === 1 ? "acuerdo" : "acuerdos"}`;
  const agreementsHint = isSuper
    ? "Todos los acuerdos"
    : totalAgreements === 0
      ? "Sin acuerdos asignados"
      : "En gestión";

  // Alerts
  const alerts: string[] = [];
  if (!isSuper && assignedCount === 0) {
    alerts.push("Usuario sin clientes asignados.");
  }
  if (!isSuper && user.can_create_agreements && assignedCount === 0) {
    alerts.push("Puede crear acuerdos, pero no tiene clientes asignados.");
  }
  if (!isActive && assignedCount > 0) {
    alerts.push("Usuario inactivo con accesos existentes.");
  }

  return (
    <div className="-mt-6 space-y-5">
      <Link
        to="/setup/users"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Volver a usuarios
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{user.full_name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge color={isSuper ? "accent" : "neutral"} variant="soft">
              {roleLabel(user.role)}
            </Badge>
            <StatusBadge
              status={isActive ? "active" : "neutral"}
              label={isActive ? "Activo" : "Inactivo"}
            />
          </div>
        </div>

        {isSuperAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/setup/users/$userId/edit" params={{ userId }}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={toggleStatus.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              <Power className="mr-2 h-4 w-4" />
              {isActive ? "Inactivar" : "Activar"}
            </Button>
          </div>
        )}
      </header>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isActive ? "¿Inactivar usuario?" : "¿Activar usuario?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isActive
                ? "El usuario perderá acceso a la plataforma hasta que se reactive."
                : "El usuario podrá volver a iniciar sesión en la plataforma."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggleStatus.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={toggleStatus.isPending}
              onClick={() => toggleStatus.mutate(isActive ? "inactive" : "active")}
            >
              {toggleStatus.isPending ? "Procesando…" : isActive ? "Inactivar" : "Activar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Indicadores principales */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <IndicatorCard
          label="Cartera de clientes"
          value={clientsValue}
          hint={clientsHint}
          tone={!isSuper && assignedCount === 0 ? "warning" : "default"}
        />
        <IndicatorCard
          label="Acuerdos en gestión"
          value={agreementsValue}
          hint={agreementsHint}
        />
        <IndicatorCard
          label="Capacidad comercial"
          value={
            <span className="text-sm font-medium">
              {isSuper
                ? "Admin total"
                : user.can_create_agreements
                  ? "Con creación habilitada"
                  : "Sin creación"}
            </span>
          }
        >
          {isSuper ? (
            <p>Crea, administra y consulta</p>
          ) : (
            <>
              <p>Crear acuerdos: {user.can_create_agreements ? "Sí" : "No"}</p>
              <p>Administra: {adminCount > 0 ? adminCount : "Sin acuerdos"}</p>
              <p>Participa: {participantCount > 0 ? participantCount : "Sin acuerdos"}</p>
            </>
          )}
        </IndicatorCard>
        <IndicatorCard
          label="Datos sensibles"
          value={<span className="text-sm font-medium">Próximamente</span>}
          hint="Costos y márgenes"
          tone="muted"
          tag={
            <Badge color="neutral" variant="soft">
              Próximamente
            </Badge>
          }
        />
      </div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Alertas de configuración</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {alerts.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Información del usuario */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información del usuario</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nombre completo">{user.full_name}</Field>
          <Field label="Email">{user.email}</Field>
          <Field label="Código ERP">{user.erp_user_code || "—"}</Field>
          <Field label="Tipo de usuario">{roleLabel(user.role)}</Field>
          <Field label="Estado">
            <StatusBadge
              status={isActive ? "active" : "neutral"}
              label={isActive ? "Activo" : "Inactivo"}
            />
          </Field>
          <Field label="Creación de acuerdos">
            {isSuper ? "No aplica" : user.can_create_agreements ? "Sí" : "No"}
          </Field>
          <Field label="Clientes asignados">
            {isSuper ? "Acceso total" : assignedCount}
          </Field>
          <Field label="Acuerdos en gestión">
            {isSuper ? "Acceso total" : totalAgreements}
          </Field>
          <Field label="Fecha de creación">
            {new Date(user.created_at).toLocaleDateString()}
          </Field>
          {user.updated_at && (
            <Field label="Última actualización">
              {new Date(user.updated_at).toLocaleDateString()}
            </Field>
          )}
        </CardContent>
      </Card>

      {/* Cartera de clientes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cartera de clientes</CardTitle>
        </CardHeader>
        <CardContent>
          {isSuper ? (
            <Alert variant="info">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Los super admins tienen acceso total a todos los clientes y no requieren asignación manual.
              </AlertDescription>
            </Alert>
          ) : assignedCount === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-8 text-center">
              <Building2 className="mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">Este usuario aún no tiene clientes asignados.</p>
              {isSuperAdmin && (
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link to="/setup/users/$userId/edit" params={{ userId }}>
                    <Pencil className="mr-2 h-4 w-4" /> Editar configuración
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {(access ?? []).map((a) => {
                const c = a.clients;
                const name = c?.commercial_name?.trim() || c?.legal_name || "—";
                return (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex items-center gap-2">
                      {c ? (
                        <Link
                          to="/setup/clients/$clientId"
                          params={{ clientId: c.id }}
                          className="truncate font-medium hover:underline"
                        >
                          {name}
                        </Link>
                      ) : (
                        <span className="truncate font-medium">{name}</span>
                      )}
                      {c?.type === "holding" && (
                        <Badge color="accent" variant="soft">Holding</Badge>
                      )}
                      {c?.status === "inactive" && (
                        <Badge color="neutral" variant="soft">Inactivo</Badge>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Acuerdos en gestión */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acuerdos en gestión</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="info">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Los acuerdos en gestión se mostrarán cuando el módulo de Acuerdos esté activo.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
