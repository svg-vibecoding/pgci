import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { StatusBadge, Badge, Chip } from "@/components/sumatec";
import { IndicatorCard } from "@/components/setup/IndicatorCard";
import { InfoField, InfoSection } from "@/components/setup/InfoSection";
import { useIsSuperAdmin } from "@/hooks/use-profile";
import {
  ArrowLeft,
  Pencil,
  Power,
  Building2,
  AlertTriangle,
  Info,
  ShieldCheck,
  FileText,
  Layers,
  Shuffle,
  Users as UsersIcon,
} from "lucide-react";

const memberRoleLabel = (r?: string | null) => {
  switch (r) {
    case "agreement_admin":
      return "Admin del acuerdo";
    case "agreement_editor":
      return "Editor";
    case "agreement_viewer":
      return "Consulta";
    case "agreement_member":
      return "Miembro";
    default:
      return r ?? "Miembro";
  }
};

export const Route = createFileRoute("/_authenticated/setup/users/$userId/")({
  head: () => ({ meta: [{ title: "Usuario · Setup · PGCI" }] }),
  component: UserDetail,
});


const roleLabel = (r: string) =>
  r === "super_admin" ? "Super admin" : null;

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

  const accessQ = useQuery({
    queryKey: ["users", userId, "access"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_client_access")
        .select(
          "id, client_id, can_create_agreements, can_manage_client_catalog, can_manage_matching, created_at, clients ( id, commercial_name, legal_name, type, status )",
        )
        .eq("user_id", userId)
        .is("valid_until", null);
      if (error) throw error;
      return data ?? [];
    },
  });
  const access = accessQ.data;

  const membersQ = useQuery({
    queryKey: ["users", userId, "agreement_members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreement_members")
        .select(
          "id, agreement_id, role, can_view_costs, agreements ( id, name, status, scope, start_date, end_date )",
        )
        .eq("user_id", userId)
        .is("valid_until", null);
      if (error) return [];
      return data ?? [];
    },
  });
  const memberships = membersQ.data;

  const agreementIds = useMemo(
    () => (membersQ.data ?? []).map((m) => m.agreement_id),
    [membersQ.data],
  );

  const agrClientsQ = useQuery({
    queryKey: ["users", userId, "agr-companies", agreementIds.slice().sort().join(",")],
    enabled: agreementIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreement_companies")
        .select("agreement_id, client_id, clients ( id, commercial_name, legal_name )")
        .in("agreement_id", agreementIds)
        .is("valid_until", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const agreementsByClient = useMemo(() => {
    const map = new Map<string, NonNullable<typeof membersQ.data>>();
    const memberByAgr = new Map((membersQ.data ?? []).map((m) => [m.agreement_id, m]));
    for (const row of agrClientsQ.data ?? []) {
      const m = memberByAgr.get(row.agreement_id);
      if (!m) continue;
      const arr = map.get(row.client_id) ?? [];
      arr.push(m);
      map.set(row.client_id, arr);
    }
    return map;
  }, [agrClientsQ.data, membersQ.data]);

  const memberAgreementIdsInMap = new Set(
    Array.from(agreementsByClient.values()).flatMap((arr) => (arr ?? []).map((m) => m.agreement_id)),
  );
  const unlinkedAgreements = (membersQ.data ?? []).filter(
    (m) => !memberAgreementIdsInMap.has(m.agreement_id),
  );

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

  if (isLoading) return <p className="suma-body text-text-secondary">Cargando…</p>;
  if (!user) return <p className="suma-body text-text-secondary">No encontrado.</p>;


  const isActive = user.status === "active";
  const isSuper = user.role === "super_admin";
  const assignedCount = access?.length ?? 0;
  const createCount = (access ?? []).filter((a) => a.can_create_agreements).length;
  const totalAgreements = memberships?.length ?? 0;


  // Alerts
  const alerts: string[] = [];
  if (!isSuper && assignedCount === 0) {
    alerts.push("Usuario sin clientes asignados.");
  }
  if (!isActive && assignedCount > 0) {
    alerts.push("Usuario inactivo con accesos existentes.");
  }

  return (
    <div className="-mt-6 space-y-5">
      <Link
        to="/setup/users"
        className="inline-flex items-center gap-1 suma-caption font-medium text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Volver a usuarios
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="suma-h1">{user.full_name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 suma-body text-text-secondary">
            {isSuper && (
              <Badge color="accent" variant="soft">
                {roleLabel(user.role)}
              </Badge>
            )}
            <StatusBadge
              status={isActive ? "active" : "neutral"}
              label={isActive ? "Activo" : "Inactivo"}
            />
          </div>
        </div>


        {isSuperAdmin && (
          <div className="flex flex-wrap gap-2">
            {!isSuper && (
              <Button asChild variant="outline" size="sm">
                <Link
                  to="/setup/users/$userId/client-access"
                  params={{ userId }}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" /> Clientes y permisos
                </Link>
              </Button>
            )}

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <IndicatorCard
          label="Acuerdos asociados"
          value={isSuper ? "Acceso total" : totalAgreements}
        />
        <IndicatorCard
          label="Clientes asociados"
          value={isSuper ? "Acceso total" : assignedCount}
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
          <CardTitle className="suma-h4">Información del usuario</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoSection>
            <InfoField label="Nombre completo">{user.full_name}</InfoField>
            <InfoField label="Email">{user.email}</InfoField>
            <InfoField label="Código ERP">{user.erp_user_code || "—"}</InfoField>
            <InfoField label="Acuerdos asignados">
              {isSuper ? "Acceso total" : totalAgreements}
            </InfoField>
            <InfoField label="Clientes asignados">
              {isSuper ? "Acceso total" : assignedCount}
            </InfoField>
            <InfoField label="Permisos de creación">
              {isSuper
                ? "No aplica"
                : createCount === 0
                  ? "Sin permisos de creación"
                  : `${createCount} de ${assignedCount} clientes`}
            </InfoField>
            <InfoField label="Fecha de creación">
              {new Date(user.created_at).toLocaleDateString()}
            </InfoField>
            {user.updated_at && (
              <InfoField label="Última actualización">
                {new Date(user.updated_at).toLocaleDateString()}
              </InfoField>
            )}
            <InfoField label="Estado">
              <StatusBadge
                status={isActive ? "active" : "neutral"}
                label={isActive ? "Activo" : "Inactivo"}
              />
            </InfoField>
          </InfoSection>
        </CardContent>
      </Card>


      {/* Cartera de clientes */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <div className="space-y-1">
            <CardTitle className="suma-h4">Cartera de clientes</CardTitle>
            <p className="suma-body text-text-secondary">
              Clientes asignados a este usuario y acuerdos en los que participa, con los permisos vigentes en cada nivel.
            </p>
          </div>
          {isSuperAdmin && !isSuper && assignedCount > 0 && (
            <Button asChild variant="outline" size="sm">
              <Link to="/setup/users/$userId/client-access" params={{ userId }}>
                <ShieldCheck className="mr-2 h-4 w-4" /> Clientes y permisos
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {isSuper ? (
            <Alert variant="info">
              <Info className="h-4 w-4" />
              <AlertTitle>Acceso total</AlertTitle>
              <AlertDescription>
                Este usuario es super admin y tiene acceso a todos los clientes y acuerdos de la plataforma.
              </AlertDescription>
            </Alert>
          ) : accessQ.isLoading || agrClientsQ.isLoading || membersQ.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : assignedCount === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-[var(--border-subtle)] bg-[var(--surface-card)] py-10 text-center">
              <Building2 className="mb-2 h-6 w-6 text-text-tertiary" />
              <p className="suma-body text-text-primary">Este usuario aún no tiene clientes asignados.</p>
              <p className="suma-caption text-text-tertiary">
                Un super admin debe habilitar sus accesos para que pueda operar en la PGCI.
              </p>
              {isSuperAdmin && (
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link to="/setup/users/$userId/client-access" params={{ userId }}>
                    <ShieldCheck className="mr-2 h-4 w-4" /> Clientes y permisos
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {(access ?? [])
                .slice()
                .sort((a, b) => {
                  const na = a.clients?.commercial_name?.trim() || a.clients?.legal_name || "";
                  const nb = b.clients?.commercial_name?.trim() || b.clients?.legal_name || "";
                  return na.localeCompare(nb, "es", { sensitivity: "base" });
                })
                .map((a) => {
                  const client = a.clients;
                  const name = client?.commercial_name?.trim() || client?.legal_name || "—";
                  const clientAgreements = client
                    ? (agreementsByClient.get(client.id) ?? [])
                    : [];
                  return (
                    <AccordionItem
                      key={a.id}
                      value={a.id}
                      className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4"
                    >
                      <AccordionTrigger className="py-3 hover:no-underline">
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <Building2 className="h-4 w-4 shrink-0 text-text-tertiary" />
                            {client ? (
                              <Link
                                to="/setup/clients/$clientId"
                                params={{ clientId: client.id }}
                                onClick={(e) => e.stopPropagation()}
                                className="truncate suma-body font-bold! text-text-primary hover:underline"
                              >
                                {name}
                              </Link>
                            ) : (
                              <span className="truncate suma-body font-bold! text-text-primary">
                                {name}
                              </span>
                            )}
                            {client?.type === "holding" && (
                              <Badge color="accent" variant="soft">Holding</Badge>
                            )}
                            {client?.status === "inactive" && (
                              <Badge color="neutral" variant="soft">Inactivo</Badge>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="suma-caption text-text-tertiary">
                              {clientAgreements?.length ?? 0}{" "}
                              {(clientAgreements?.length ?? 0) === 1 ? "acuerdo" : "acuerdos"}
                            </span>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4">
                        <div className="mb-5 ml-6 border-l border-[var(--border-subtle)] pl-4">
                          <p className="suma-overline text-text-tertiary mb-2">
                            Permisos avanzados
                          </p>
                          <div className="space-y-0.5">
                            {[
                              {
                                icon: FileText,
                                label: "Crear acuerdos",
                                checked: !!a.can_create_agreements,
                              },
                              {
                                icon: Layers,
                                label: "Gestionar catálogo del cliente",
                                checked: !!a.can_manage_client_catalog,
                              },
                              {
                                icon: Shuffle,
                                label: "Gestionar matching",
                                checked: !!a.can_manage_matching,
                              },
                            ].map((perm) => {
                              const Icon = perm.icon;
                              return (
                                <div
                                  key={perm.label}
                                  className="flex items-center justify-between gap-4 py-1.5"
                                >
                                  <div className="flex items-center gap-2">
                                    <Icon
                                      className={cn(
                                        "h-4 w-4",
                                        perm.checked ? "text-text-secondary" : "text-text-tertiary/60",
                                      )}
                                    />
                                    <span
                                      className={cn(
                                        "suma-body",
                                        perm.checked ? "text-text-primary" : "text-text-tertiary",
                                      )}
                                    >
                                      {perm.label}
                                    </span>
                                  </div>
                                  <Switch
                                    checked={perm.checked}
                                    disabled
                                    aria-label={perm.label}
                                    aria-readonly="true"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <p className="suma-overline text-text-tertiary mb-2">
                            Acuerdos donde participa
                          </p>
                          {clientAgreements && clientAgreements.length > 0 ? (
                            <ul className="divide-y divide-[var(--border-subtle)] rounded-md border border-[var(--border-subtle)]">
                              {clientAgreements.map((m) => {
                                const agr = m.agreements as any;
                                return (
                                  <li
                                    key={m.id}
                                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                                  >
                                    <div className="min-w-0 flex items-center gap-2">
                                      <FileText className="h-4 w-4 shrink-0 text-text-tertiary" />
                                      {agr ? (
                                        <Link
                                          to="/pgci/agreements/$agreementId"
                                          params={{ agreementId: agr.id }}
                                          className="truncate suma-body text-text-primary hover:underline"
                                        >
                                          {agr.name}
                                        </Link>
                                      ) : (
                                        <span className="truncate suma-body">Acuerdo</span>
                                      )}
                                      {agr?.status && (
                                        <StatusBadge
                                          status={agr.status === "active" ? "active" : "neutral"}
                                          label={agr.status === "active" ? "Activo" : agr.status}
                                        />
                                      )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <Chip variant="soft">
                                        <ShieldCheck className="h-3 w-3" />{" "}
                                        {memberRoleLabel(m.role)}
                                      </Chip>
                                      {m.can_view_costs && (
                                        <Chip variant="soft">Ve costos</Chip>
                                      )}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="suma-caption text-text-tertiary">
                              No participa en acuerdos de este cliente todavía.
                            </p>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
            </Accordion>
          )}

          {unlinkedAgreements.length > 0 && (
            <div className="pt-2">
              <p className="suma-overline text-text-tertiary mb-2 flex items-center gap-2">
                <UsersIcon className="h-3.5 w-3.5" />
                Otros acuerdos donde participa
              </p>
              <ul className="divide-y divide-[var(--border-subtle)] rounded-md border border-[var(--border-subtle)]">
                {unlinkedAgreements.map((m) => {
                  const agr = m.agreements as any;
                  return (
                    <li
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-text-tertiary" />
                        {agr ? (
                          <Link
                            to="/pgci/agreements/$agreementId"
                            params={{ agreementId: agr.id }}
                            className="truncate suma-body text-text-primary hover:underline"
                          >
                            {agr.name}
                          </Link>
                        ) : (
                          <span className="truncate suma-body">Acuerdo</span>
                        )}
                      </div>
                      <Chip variant="soft">
                        <ShieldCheck className="h-3 w-3" /> {memberRoleLabel(m.role)}
                      </Chip>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
