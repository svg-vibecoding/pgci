import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useMyProfile } from "@/hooks/use-profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { InfoField, InfoSection } from "@/components/setup/InfoSection";
import { StatusBadge, Badge, Chip } from "@/components/sumatec";
import { Switch } from "@/components/ui/switch";
import {
  Building2,
  FileText,
  Info,
  KeyRound,
  Layers,
  ShieldCheck,
  Shuffle,
  UserRound,
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

export function CommercialProfileView() {
  const { data: profile, isLoading: loadingProfile } = useMyProfile();
  const userId = profile?.user_id ?? null;
  const isSuper = profile?.role === "super_admin";

  const fullProfileQ = useQuery({
    queryKey: ["profile", "full", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, erp_user_code, role, status, created_at")
        .eq("user_id", userId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const fullProfile = fullProfileQ.data;

  const accessQ = useQuery({
    queryKey: ["profile", "client-access", userId],
    enabled: !!userId && !isSuper,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_client_access")
        .select(
          "id, client_id, can_create_agreements, can_manage_client_catalog, can_manage_matching, created_at, clients ( id, commercial_name, legal_name, type, status )",
        )
        .eq("user_id", userId!)
        .is("valid_until", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const membersQ = useQuery({
    queryKey: ["profile", "agreement-members", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreement_members")
        .select(
          "id, agreement_id, role, can_view_costs, agreements ( id, name, status, scope, start_date, end_date )",
        )
        .eq("user_id", userId!)
        .is("valid_until", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const agreementIds = useMemo(
    () => (membersQ.data ?? []).map((m) => m.agreement_id),
    [membersQ.data],
  );

  const agrClientsQ = useQuery({
    queryKey: ["profile", "agr-companies", agreementIds.sort().join(",")],
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

  if (loadingProfile) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!profile) {
    return <p className="suma-body text-text-secondary">No se pudo cargar tu perfil.</p>;
  }

  const assignedCount = accessQ.data?.length ?? 0;

  const memberAgreementIdsInMap = new Set(
    Array.from(agreementsByClient.values()).flatMap((arr) => (arr ?? []).map((m) => m.agreement_id)),
  );
  const unlinkedAgreements = (membersQ.data ?? []).filter(
    (m) => !memberAgreementIdsInMap.has(m.agreement_id),
  );

  return (
    <div className="space-y-6">
      {/* Información personal */}
      <Card>
        <CardHeader>
          <CardTitle className="suma-h3">Información personal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <UserRound className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="suma-subtitle text-text-primary">
                  {profile.full_name || "—"}
                </span>

                {fullProfile?.erp_user_code && (
                  <Badge color="accent" variant="soft">
                    {fullProfile.erp_user_code}
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 suma-body text-text-secondary">
                {fullProfile?.email || "—"}
              </p>
            </div>
          </div>
          <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
            <p className="suma-caption text-text-tertiary">
              Si necesitas actualizar tu información personal, contacta a un administrador.
            </p>
          </div>
        </CardContent>
      </Card>



      {/* Clientes y accesos */}
      <Card>
        <CardHeader>
          <CardTitle className="suma-h3">Clientes y accesos</CardTitle>
          <p className="suma-body text-text-secondary">
            Tu cartera de clientes y los acuerdos en los que participas, con los permisos vigentes en cada nivel.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {isSuper ? (
            <Alert variant="info">
              <Info className="h-4 w-4" />
              <AlertTitle>Acceso total</AlertTitle>
              <AlertDescription>
                Como super admin tienes acceso a todos los clientes y acuerdos de la plataforma.
              </AlertDescription>
            </Alert>
          ) : accessQ.isLoading || agrClientsQ.isLoading || membersQ.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : assignedCount === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-[var(--border-subtle)] bg-[var(--surface-card)] py-10 text-center">
              <Building2 className="mb-2 h-6 w-6 text-text-tertiary" />
              <p className="suma-body text-text-primary">Aún no tienes clientes asignados.</p>
              <p className="suma-caption text-text-tertiary">
                Un super admin debe habilitar tu acceso a clientes para operar en la PGCI.
              </p>
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {(accessQ.data ?? [])
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
                            <span className="truncate suma-body font-bold! text-text-primary">
                              {name}
                            </span>
                            {client?.type === "holding" && (
                              <Badge color="accent" variant="soft">Holding</Badge>
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
                            Acuerdos donde participas
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
                              No participas en acuerdos de este cliente todavía.
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
                Otros acuerdos donde participas
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

      {/* Seguridad (expandible, cerrada por defecto) */}
      <Card>
        <Accordion type="single" collapsible>
          <AccordionItem value="security" className="border-0">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <div className="flex flex-1 items-start gap-3 pr-3 text-left">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
                <div className="min-w-0">
                  <p className="suma-h3">Seguridad</p>
                  <p className="suma-body text-text-secondary">
                    Actualiza tu contraseña de acceso. Si accediste con una contraseña temporal entregada por el super admin, cámbiala aquí.
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <PasswordChangeForm />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>
    </div>
  );
}

function PasswordChangeForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const canSubmit =
    current.length > 0 && next.length >= 8 && next === confirm && !saving;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (!email) throw new Error("No fue posible identificar tu sesión.");
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (signInError) {
        toast.error("La contraseña actual no es correcta.");
        setSaving(false);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      toast.success("Contraseña actualizada.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err: any) {
      toast.error(err?.message ?? "No fue posible actualizar la contraseña.");
    } finally {
      setSaving(false);
    }
  }

  const mismatch = confirm.length > 0 && next !== confirm;
  const tooShort = next.length > 0 && next.length < 8;

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:max-w-md">

      <div className="space-y-1.5">
        <Label htmlFor="current-password">Contraseña actual</Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-password">Nueva contraseña</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
        {tooShort && (
          <p className="suma-caption text-destructive">
            La contraseña debe tener al menos 8 caracteres.
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-password">Confirmar nueva contraseña</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        {mismatch && (
          <p className="suma-caption text-destructive">
            Las contraseñas no coinciden.
          </p>
        )}
      </div>
      <div>
        <Button type="submit" disabled={!canSubmit}>
          {saving ? "Actualizando…" : "Actualizar contraseña"}
        </Button>
      </div>
    </form>
  );
}
