import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Package,
  Users,
  KeyRound,
  AlertTriangle,
  ArrowRight,
  Check,
  Briefcase,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/setup/")({
  head: () => ({ meta: [{ title: "Setup · PGCI" }] }),
  component: SetupHome,
});

function useSetupCounts() {
  return useQuery({
    queryKey: ["setup", "counts"],
    queryFn: async () => {
      const [clients, companies, productsActive, productsInactive, users, accesses] =
        await Promise.all([
          supabase.from("clients").select("*", { count: "exact", head: true }),
          supabase.from("client_companies").select("*", { count: "exact", head: true }),
          supabase
            .from("products")
            .select("*", { count: "exact", head: true })
            .eq("status", "active"),
          supabase
            .from("products")
            .select("*", { count: "exact", head: true })
            .eq("status", "inactive"),
          supabase
            .from("profiles")
            .select("*", { count: "exact", head: true })
            .eq("status", "active"),
          supabase.from("user_client_access").select("*", { count: "exact", head: true }),
        ]);
      return {
        clients: clients.count ?? 0,
        companies: companies.count ?? 0,
        productsActive: productsActive.count ?? 0,
        productsInactive: productsInactive.count ?? 0,
        users: users.count ?? 0,
        accesses: accesses.count ?? 0,
      };
    },
  });
}

type StepState = "done" | "next" | "pending";

function SetupHome() {
  const { data } = useSetupCounts();

  const clients = data?.clients ?? 0;
  const companies = data?.companies ?? 0;
  const productsActive = data?.productsActive ?? 0;
  const productsInactive = data?.productsInactive ?? 0;
  const users = data?.users ?? 0;
  const accesses = data?.accesses ?? 0;

  const isEmpty = clients === 0 && productsActive === 0;

  // Progreso visual de setup — derivado de counts existentes, sin nuevas queries
  const stepStates: StepState[] = (() => {
    const done = [clients > 0, companies > 0, productsActive > 0, accesses > 0];
    const firstPending = done.indexOf(false);
    return done.map((d, i) => (d ? "done" : i === firstPending ? "next" : "pending"));
  })();

  const steps: Array<{ label: string; hint: string; to?: string }> = [
    { label: "Clientes", hint: "Base inicial", to: "/setup/clients" },
    { label: "Empresas", hint: "Razones sociales", to: "/setup/clients" },
    { label: "PIM", hint: "Catálogo activo", to: "/setup/products" },
    { label: "Accesos", hint: "Usuarios ↔ clientes" },
  ];

  const cards: Array<{
    label: string;
    value: string | number;
    microcopy: string;
    icon: LucideIcon;
    to?: string;
  }> = [
    {
      label: "CLIENTES",
      value: `${clients} / 4`,
      microcopy: "Base inicial de clientes que activa cobertura y acuerdos.",
      icon: Building2,
      to: "/setup/clients",
    },
    {
      label: "Empresas registradas",
      value: companies,
      microcopy: "Razones sociales por cliente para facturación y matching.",
      icon: Briefcase,
      to: "/setup/clients",
    },
    {
      label: "PRODUCTOS",
      value: `${productsActive} activos · ${productsInactive} inactivos`,
      microcopy: "Catálogo Jaivaná listo para acuerdos y matching automatizado.",
      icon: Package,
      to: "/setup/products",
    },
    {
      label: "Usuarios activos",
      value: users,
      microcopy: "Personas con sesión activa en la plataforma.",
      icon: Users,
    },
    {
      label: "Accesos configurados",
      value: accesses,
      microcopy: "Vínculo entre usuarios y clientes habilitados.",
      icon: KeyRound,
    },
  ];

  const alerts: string[] = [];
  if (clients === 0)
    alerts.push("Aún no hay clientes creados. Crea los clientes piloto para continuar.");
  if (productsActive === 0)
    alerts.push("Aún no hay productos activos en el PIM. Impórtalos desde archivo.");

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="space-y-3">
        <p className="suma-overline">GESTIÓN COMERCIAL INTELIGENTE</p>
        <h1 className="suma-h1 max-w-3xl text-[var(--text-primary)]">
          Configura la base operativa de la PGCI
        </h1>
        <p className="max-w-3xl text-[15px] leading-relaxed text-[var(--text-secondary)]">
          Define clientes, empresas, productos y accesos desde una sola fuente de verdad.
          Esta configuración alimenta acuerdos, matching y todo el flujo comercial.
        </p>
      </header>

      {/* Progreso de setup */}
      {!isEmpty && (
        <section
          aria-label="Progreso de configuración"
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6"
        >
          <div className="mb-5 flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Progreso de configuración
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">
              {stepStates.filter((s) => s === "done").length} de {steps.length} completados
            </p>
          </div>
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => {
              const state = stepStates[i];
              return (
                <li key={step.label} className="relative">
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                        state === "done" &&
                          "bg-[var(--success-soft)] text-[var(--success-strong)]",
                        state === "next" &&
                          "bg-[var(--red-50)] text-[var(--color-primary)] ring-2 ring-[var(--color-primary)]",
                        state === "pending" &&
                          "bg-[var(--gray-100)] text-[var(--text-tertiary)]",
                      )}
                    >
                      {state === "done" ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          state === "pending"
                            ? "text-[var(--text-tertiary)]"
                            : "text-[var(--text-primary)]",
                        )}
                      >
                        {step.label}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                        {state === "next" ? "Siguiente paso" : step.hint}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Empty state */}
      {isEmpty && (
        <section className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-sm)]">
          <div className="grid gap-8 p-8 md:grid-cols-[auto_1fr] md:items-start md:p-10">
            <div
              aria-hidden
              className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--red-50)] ring-8 ring-[color:var(--red-50)]/40"
            >
              <Sparkles className="h-7 w-7 text-[var(--color-primary)]" />
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <h2 className="suma-h3 text-[var(--text-primary)]">
                  Empieza por crear tus clientes
                </h2>
                <p className="max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">
                  Los clientes son la base operativa de la PGCI. Una vez creados podrás
                  registrar sus empresas, importar el catálogo y habilitar accesos.
                </p>
              </div>

              <ol className="grid gap-3 sm:grid-cols-3">
                {[
                  { n: 1, t: "Crea clientes", d: "Define la cartera de clientes." },
                  { n: 2, t: "Registra empresas", d: "Razones sociales por cliente." },
                  { n: 3, t: "Importa Productos", d: "Catálogo activo para acuerdos." },
                ].map((s) => (
                  <li
                    key={s.n}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--gray-25)] p-4"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-primary)] text-[10px] font-bold text-white">
                        {s.n}
                      </span>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        {s.t}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">{s.d}</p>
                  </li>
                ))}
              </ol>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <Button asChild>
                  <Link to="/setup/clients/new">Crear primer cliente</Link>
                </Button>
                <Link
                  to="/setup/products"
                  className="text-sm font-medium text-[var(--text-secondary)] underline-offset-4 hover:text-[var(--color-primary)] hover:underline"
                >
                  {"\n"}
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Cards de estado */}
      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="suma-overline">ESTADO ACTUAL</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
              Indicadores operativos
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => {
            const Icon = c.icon;
            const content = (
              <div className="group flex h-full flex-col rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-xs)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border-default)] hover:shadow-[var(--shadow-md)]">
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--red-50)] text-[var(--color-primary)]">
                    <Icon className="h-4 w-4" />
                  </span>
                  {c.to && (
                    <ArrowRight className="h-4 w-4 text-[var(--text-tertiary)] opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:text-[var(--color-primary)]" />
                  )}
                </div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                  {c.label}
                </p>
                <p className="mt-1 font-display text-[26px] font-bold leading-tight tracking-tight text-[var(--text-primary)]">
                  {c.value}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  {c.microcopy}
                </p>
              </div>
            );
            return c.to ? (
              <Link key={c.label} to={c.to} className="block">
                {content}
              </Link>
            ) : (
              <div key={c.label}>{content}</div>
            );
          })}
        </div>
      </section>

      {/* Alertas */}
      {alerts.length > 0 && (
        <section
          className="flex gap-4 rounded-lg border border-[color:var(--warning)]/30 bg-[var(--warning-soft)] p-5"
          role="status"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--warning-strong)]" />
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Pendientes de setup
            </p>
            <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
              {alerts.map((a) => (
                <li key={a}>• {a}</li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
