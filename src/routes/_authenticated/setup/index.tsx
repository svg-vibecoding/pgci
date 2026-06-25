import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2,
  Package,
  Users,
  ArrowRight,
  Check,
  Handshake,
  Clock,
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
      const [clients, productsActive, productsInactive, users, accesses] =
        await Promise.all([
          supabase.from("clients").select("*", { count: "exact", head: true }),
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
        productsActive: productsActive.count ?? 0,
        productsInactive: productsInactive.count ?? 0,
        users: users.count ?? 0,
        accesses: accesses.count ?? 0,
      };
    },
  });
}

type StepState = "done" | "next" | "pending" | "upcoming";

function SetupHome() {
  const { data } = useSetupCounts();

  const clients = data?.clients ?? 0;
  const productsActive = data?.productsActive ?? 0;
  const productsInactive = data?.productsInactive ?? 0;
  const productsTotal = productsActive + productsInactive;
  const users = data?.users ?? 0;
  const accesses = data?.accesses ?? 0;

  const clientsDone = clients > 0;
  const productsDone = productsActive > 0;
  const accessesDone = accesses > 0;

  const prerequisites = [clientsDone, productsDone, accessesDone];
  const prerequisitesDone = prerequisites.filter(Boolean).length;
  const prerequisitesTotal = prerequisites.length;

  const steps: Array<{ label: string; hint: string; state: StepState }> = [
    {
      label: "Clientes",
      hint: "Base comercial lista",
      state: clientsDone ? "done" : "next",
    },
    {
      label: "Productos/PIM",
      hint: "Catálogo Jaivaná cargado",
      state: productsDone ? "done" : clientsDone ? "next" : "pending",
    },
    {
      label: "Usuarios y accesos",
      hint: "Pendiente de revisión",
      state: accessesDone
        ? "done"
        : clientsDone && productsDone
          ? "next"
          : "pending",
    },
    {
      label: "Siguiente: Acuerdos",
      hint: "Próximo módulo operativo",
      state: "upcoming",
    },
  ];

  const cards: Array<{
    label: string;
    value: string;
    subvalue?: string;
    microcopy: string;
    icon: LucideIcon;
    cta: string;
    to?: string;
    disabled?: boolean;
    badge?: string;
  }> = [
    {
      label: "Clientes",
      value: `${clients} registrados`,
      microcopy:
        "Base comercial disponible para acuerdos y asignación de visibilidad.",
      icon: Building2,
      cta: "Ir a Clientes",
      to: "/setup/clients",
    },
    {
      label: "Productos/PIM",
      value: `${productsTotal.toLocaleString("es-CO")} productos`,
      subvalue: `${productsActive.toLocaleString("es-CO")} activos · ${productsInactive} inactivos`,
      microcopy: "Catálogo Jaivaná listo para estructurar productos de acuerdo.",
      icon: Package,
      cta: "Ir a Productos",
      to: "/setup/products",
    },
    {
      label: "Usuarios y accesos",
      value: `${users} ${users === 1 ? "usuario activo" : "usuarios activos"}`,
      subvalue: `${accesses} ${accesses === 1 ? "acceso configurado" : "accesos configurados"}`,
      microcopy: "Define quién puede ver clientes y operar acuerdos.",
      icon: Users,
      cta: "Ir a Usuarios",
      disabled: true,
      badge: "Próximamente",
    },
    {
      label: "Preparación para Acuerdos",
      value: `${prerequisitesDone} de ${prerequisitesTotal} prerequisitos listos`,
      microcopy:
        "Clientes y PIM están listos. Falta revisar usuarios y accesos antes de avanzar.",
      icon: Handshake,
      cta: "En preparación",
      disabled: true,
    },
  ];

  const checklist: Array<{ label: string; status: "done" | "pending" | "next" }> = [
    {
      label: "Clientes configurados",
      status: clientsDone ? "done" : "pending",
    },
    {
      label: "Productos/PIM cargado",
      status: productsDone ? "done" : "pending",
    },
    {
      label: "Usuarios y accesos revisados",
      status: accessesDone ? "done" : "pending",
    },
    { label: "Acuerdos comerciales", status: "next" },
  ];

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="space-y-3">
        <p className="suma-overline">GESTIÓN COMERCIAL INTELIGENTE</p>
        <h1 className="suma-h1 max-w-3xl text-[var(--text-primary)]">
          Prepara la base operativa para Acuerdos
        </h1>
        <p className="max-w-3xl text-[15px] leading-relaxed text-[var(--text-secondary)]">
          Valida clientes, productos y accesos antes de crear acuerdos comerciales.
          Esta vista muestra qué está listo, qué falta y dónde continuar.
        </p>
      </header>

      {/* Stepper */}
      <section
        aria-label="Progreso de configuración"
        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6"
      >
        <div className="mb-5 flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            Progreso de configuración
          </p>
          <p className="text-xs text-[var(--text-tertiary)]">
            {prerequisitesDone} de {prerequisitesTotal} prerequisitos listos
          </p>
        </div>
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => {
            const { state } = step;
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
                      state === "upcoming" &&
                        "bg-[var(--gray-100)] text-[var(--text-secondary)]",
                    )}
                  >
                    {state === "done" ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : state === "upcoming" ? (
                      <Clock className="h-3 w-3" />
                    ) : (
                      i + 1
                    )}
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
                      {step.hint}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Cards de readiness */}
      <section className="space-y-4">
        <div>
          <p className="suma-overline">ESTADO ACTUAL</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
            Readiness por área
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => {
            const Icon = c.icon;
            const inner = (
              <div
                className={cn(
                  "group flex h-full flex-col rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-xs)] transition-all duration-200",
                  c.to &&
                    !c.disabled &&
                    "hover:-translate-y-0.5 hover:border-[var(--border-default)] hover:shadow-[var(--shadow-md)]",
                  c.disabled && "opacity-90",
                )}
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--red-50)] text-[var(--color-primary)]">
                    <Icon className="h-4 w-4" />
                  </span>
                  {c.badge && (
                    <span className="rounded-full bg-[var(--gray-100)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                      {c.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                  {c.label}
                </p>
                <p className="mt-1 font-display text-[22px] font-bold leading-tight tracking-tight text-[var(--text-primary)]">
                  {c.value}
                </p>
                {c.subvalue && (
                  <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                    {c.subvalue}
                  </p>
                )}
                <p className="mt-2 flex-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  {c.microcopy}
                </p>
                <p
                  className={cn(
                    "mt-4 inline-flex items-center gap-1 text-sm font-semibold",
                    c.disabled
                      ? "text-[var(--text-tertiary)]"
                      : "text-[var(--color-primary)] group-hover:gap-1.5",
                  )}
                >
                  {c.cta}
                  {!c.disabled && <ArrowRight className="h-3.5 w-3.5" />}
                </p>
              </div>
            );
            return c.to && !c.disabled ? (
              <Link key={c.label} to={c.to} className="block">
                {inner}
              </Link>
            ) : (
              <div key={c.label}>{inner}</div>
            );
          })}
        </div>
      </section>

      {/* Checklist */}
      <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          Pendientes antes de Acuerdos
        </p>
        <ul className="mt-4 divide-y divide-[var(--border-subtle)]">
          {checklist.map((item) => (
            <li
              key={item.label}
              className="flex items-center justify-between py-3 text-sm"
            >
              <span className="text-[var(--text-primary)]">{item.label}</span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  item.status === "done" &&
                    "bg-[var(--success-soft)] text-[var(--success-strong)]",
                  item.status === "pending" &&
                    "bg-[var(--gray-100)] text-[var(--text-secondary)]",
                  item.status === "next" &&
                    "bg-[var(--red-50)] text-[var(--color-primary)]",
                )}
              >
                {item.status === "done" && <Check className="h-3 w-3" />}
                {item.status === "done"
                  ? "Listo"
                  : item.status === "pending"
                    ? "Pendiente"
                    : "Siguiente módulo"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
