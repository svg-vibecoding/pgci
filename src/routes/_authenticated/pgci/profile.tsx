import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
import { IndicatorCard } from "@/components/setup/IndicatorCard";
import { InfoField, InfoSection } from "@/components/setup/InfoSection";
import { StatusBadge, Badge, Chip } from "@/components/sumatec";
import {
  Building2,
  FileText,
  Info,
  KeyRound,
  ShieldCheck,
  Users as UsersIcon,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/pgci/profile")({
  head: () => ({ meta: [{ title: "Perfil comercial · PGCI" }] }),
  component: ProfileView,
});

const roleLabel = (r?: string | null) =>
  r === "super_admin" ? "Super admin" : r === "platform_user" ? "Usuario de plataforma" : r ?? "—";

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

function ProfileView() {
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

  // Agreement -> clients (agreement_companies)
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

  const isActive = profile?.status === "active";

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
  const agreementsCount = membersQ.data?.length ?? 0;

  // Group agreements by client via agreement_companies
  const agreementsByClient = useMemo(() => {
    const map = new Map<string, typeof membersQ.data>();
    const memberByAgr = new Map((membersQ.data ?? []).map((m) => [m.agreement_id, m]));
    for (const row of agrClientsQ.data ?? []) {
      const m = memberByAgr.get(row.agreement_id);
      if (!m) continue;
      const arr = (map.get(row.client_id) ?? []) as NonNullable<typeof membersQ.data>;
      arr.push(m);
      map.set(row.client_id, arr as typeof membersQ.data);
    }
    return map;
  }, [agrClientsQ.data, membersQ.data]);

  // Agreements without a linked client visible (edge case)
  const memberAgreementIdsInMap = new Set(
    Array.from(agreementsByClient.values()).flatMap((arr) => (arr ?? []).map((m) => m.agreement_id)),
  );
  const unlinkedAgreements = (membersQ.data ?? []).filter(
    (m) => !memberAgreementIdsInMap.has(m.agreement_id),
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="suma-h1">Perfil comercial</h1>
          <p className="suma-body text-text-secondary">
            Consulta tu información, gestiona tu contraseña y revisa tus accesos en la PGCI.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSuper && (
            <Badge color="accent" variant="soft">
              {roleLabel(profile.role)}
            </Badge>
          )}
          <StatusBadge
            status={isActive ? "active" : "neutral"}
            label={isActive ? "Activo" : "Inactivo"}
          />
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <IndicatorCard
          label="Clientes"
          value={isSuper ? "Acceso total" : assignedCount}
        />
        <IndicatorCard
          label="Acuerdos"
          value={agreementsCount}
        />
        <IndicatorCard
          label="Rol en la plataforma"
          value={<span className="suma-h3">{roleLabel(profile.role)}</span>}
        />
      </div>

      {/* Información personal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información personal</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoSection>
            <InfoField label="Nombre completo">{profile.full_name || "—"}</InfoField>
            <InfoField label="Correo">{fullProfile?.email || "—"}</InfoField>
            <InfoField label="Código ERP">{fullProfile?.erp_user_code || "—"}</InfoField>
          </InfoSection>
          <p className="mt-4 suma-caption text-text-tertiary">
            Si necesitas actualizar tu información personal, contacta a un super admin.
          </p>
        </CardContent>
      </Card>

      {/* Seguridad */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-text-tertiary" />
            Seguridad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordChangeForm />
        </CardContent>
      </Card>

      {/* Accesos */}
      <section className="space-y-3">
        <div>
          <h2 className="suma-h3">Mis accesos</h2>
          <p className="suma-body text-text-secondary">
            Tu cartera de clientes y los acuerdos en los que participas, con los permisos vigentes en cada nivel.
          </p>
        </div>

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
                const permChips: string[] = [];
                if (a.can_create_agreements) permChips.push("Crea acuerdos");
                if (a.can_manage_client_catalog) permChips.push("Catálogo del cliente");
                if (a.can_manage_matching) permChips.push("Matching");
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
                          <span className="truncate suma-body font-medium text-text-primary">
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
                      {/* Permisos sobre el cliente */}
                      <div className="mb-4">
                        <p className="suma-overline text-text-tertiary mb-2">
                          Permisos sobre el cliente
                        </p>
                        {permChips.length === 0 ? (
                          <p className="suma-caption text-text-tertiary">
                            Solo consulta.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {permChips.map((p) => (
                              <Chip key={p} variant="soft">
                                {p}
                              </Chip>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Acuerdos donde participo */}
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UsersIcon className="h-4 w-4 text-text-tertiary" />
                Otros acuerdos donde participas
              </CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        )}
      </section>
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
      // Reautenticar con la contraseña actual
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
      <p className="suma-caption text-text-tertiary">
        Si accediste con una contraseña temporal entregada por el super admin, cámbiala aquí.
      </p>
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
