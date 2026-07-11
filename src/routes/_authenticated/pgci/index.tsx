import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Search, Download, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile } from "@/hooks/use-profile";
import { IndicatorCard } from "@/components/setup/IndicatorCard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/pgci/")({
  head: () => ({ meta: [{ title: "Inicio · PGCI" }] }),
  component: PgciHome,
});


type ModuleStatus = "available" | "soon" | "wip";

type ModuleDef = {
  key: string;
  title: string;
  description: string;
  icon: typeof FileText;
  status: ModuleStatus;
  to?: string;
};

const MODULES: ModuleDef[] = [
  {
    key: "agreements",
    title: "Acuerdos",
    description:
      "Gestiona agrupadores, miembros, posiciones e importación de acuerdos comerciales.",
    icon: FileText,
    status: "available",
    to: "/pgci/agreements",
  },
  {
    key: "search",
    title: "Consulta",
    description:
      "Encuentra condiciones vigentes por cliente, producto o vigencia.",
    icon: Search,
    status: "wip",
  },
  {
    key: "export",
    title: "Exportación",
    description:
      "Exporta condiciones y vigencias para uso operativo.",
    icon: Download,
    status: "wip",
  },
];

function statusChip(status: ModuleStatus) {
  if (status === "available")
    return (
      <span className="suma-overline inline-flex items-center rounded-full bg-[var(--status-success-soft)] px-2.5 py-0.5 text-[var(--status-success-strong)]">
        Disponible
      </span>
    );
  if (status === "soon")
    return (
      <span className="suma-overline inline-flex items-center rounded-full bg-[var(--status-info-soft)] px-2.5 py-0.5 text-[var(--status-info-strong)]">
        Disponible pronto
      </span>
    );
  return (
    <span className="suma-overline inline-flex items-center rounded-full bg-[var(--gray-100)] px-2.5 py-0.5 text-text-tertiary">
      En construcción
    </span>
  );
}


function PgciHome() {
  const { data: profile } = useMyProfile();
  const userId = profile?.user_id;

  const clientsQuery = useQuery({
    queryKey: ["pgci-home", "clients-count", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("user_client_access")
        .select("client_id", { count: "exact", head: true })
        .eq("user_id", userId!)
        .is("valid_until", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const agreementsQuery = useQuery({
    queryKey: ["pgci-home", "agreements-count", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("agreement_members")
        .select("agreement_id", { count: "exact", head: true })
        .eq("user_id", userId!)
        .is("valid_until", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const clientsCount = clientsQuery.data ?? 0;
  const noClients = !clientsQuery.isLoading && clientsCount === 0;

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="suma-h1">
            Hola, {profile?.full_name ?? "bienvenido"}
          </h1>
          <p className="mt-1 suma-caption">
            ¡Hoy será un gran día!
          </p>
        </div>
        <span className="suma-overline inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-1 text-text-secondary">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" />
          Operación comercial
        </span>
      </header>

      {/* Indicadores */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {clientsQuery.isLoading ? (
          <Skeleton className="h-[88px]" />
        ) : (
          <IndicatorCard
            label="Clientes asignados"
            value={clientsCount}
            hint="en tu cartera"
          />
        )}
        {agreementsQuery.isLoading ? (
          <Skeleton className="h-[88px]" />
        ) : (
          <IndicatorCard
            label="Acuerdos activos"
            value={agreementsQuery.data ?? 0}
            hint="donde participas"
          />
        )}
      </section>

      {/* Guía contextual cuando no hay cartera */}
      {noClients && (
        <Alert variant="info">
          <Info className="h-4 w-4" />
          <AlertTitle>Aún no tienes clientes asignados</AlertTitle>
          <AlertDescription>
            Un administrador te asignará la cartera antes de que puedas operar
            acuerdos. Mientras tanto, puedes familiarizarte con los módulos
            disponibles abajo.
          </AlertDescription>
        </Alert>
      )}

      {/* Módulos */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            Tus módulos
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Estas son las capacidades que tendrás disponibles en la PGCI.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {MODULES.map((m) => {
            const Icon = m.icon;
            return (
              <Card key={m.key} className="flex flex-col">
                <CardContent className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    {statusChip(m.status)}
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-[var(--text-primary)]">
                    {m.title}
                  </h3>
                  <p className="mt-1 flex-1 text-sm text-[var(--text-secondary)]">
                    {m.description}
                  </p>
                  <div className="mt-4">
                    {m.status === "available" && m.to ? (
                      <Button asChild variant="outline" size="sm" className="w-full">
                        <Link to={m.to}>Abrir</Link>
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled className="w-full">
                        Abrir
                      </Button>
                    )}
                  </div>

                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
