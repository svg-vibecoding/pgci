import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2,
  Package,
  Users,
  ArrowRight,
  Handshake,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { IndicatorCard } from "@/components/setup/IndicatorCard";

export const Route = createFileRoute("/_authenticated/setup/")({
  head: () => ({ meta: [{ title: "Plataforma · PGCI" }] }),
  component: SetupHome,
});

function useSetupCounts() {
  return useQuery({
    queryKey: ["setup", "counts"],
    queryFn: async () => {
      const [users, clients, products, agreements] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("clients").select("*", { count: "exact", head: true }),
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("agreements").select("*", { count: "exact", head: true }),
      ]);
      return {
        users: users.count ?? 0,
        clients: clients.count ?? 0,
        products: products.count ?? 0,
        agreements: agreements.count ?? 0,
      };
    },
  });
}

function SetupHome() {
  const { data } = useSetupCounts();

  const users = data?.users ?? 0;
  const clients = data?.clients ?? 0;
  const products = data?.products ?? 0;
  const agreements = data?.agreements ?? 0;

  const kpis: Array<{ label: string; value: string }> = [
    { label: "Usuarios", value: users.toLocaleString("es-CO") },
    { label: "Clientes", value: clients.toLocaleString("es-CO") },
    { label: "Productos", value: products.toLocaleString("es-CO") },
    { label: "Acuerdos", value: agreements.toLocaleString("es-CO") },
  ];


  const modules: Array<{
    label: string;
    microcopy: string;
    icon: LucideIcon;
    to: string;
  }> = [
    {
      label: "Clientes",
      microcopy:
        "Base comercial disponible para acuerdos y asignación de visibilidad.",
      icon: Building2,
      to: "/setup/clients",
    },
    {
      label: "Productos / PIM",
      microcopy:
        "Catálogo Jaivaná para estructurar productos de acuerdo y equivalencias.",
      icon: Package,
      to: "/setup/products",
    },
    {
      label: "Usuarios y accesos",
      microcopy:
        "Perfiles, roles y visibilidad de clientes por usuario.",
      icon: Users,
      to: "/setup/users",
    },
    {
      label: "Acuerdos",
      microcopy:
        "Agrupadores, miembros, posiciones e importación de acuerdos comerciales.",
      icon: Handshake,
      to: "/pgci/agreements",
    },
  ];

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <h1 className="suma-h1 text-[var(--text-primary)]">
            Centro de operación comercial
          </h1>
          <p className="suma-body max-w-3xl text-[var(--text-secondary)]">
            Todos los módulos de la PGCI están operativos. Administra clientes,
            catálogo, usuarios y acuerdos comerciales desde un solo lugar.
          </p>
        </div>
        <span className="suma-caption inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-1 text-text-secondary">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" />
          Plataforma PGCI
        </span>
      </header>

      {/* KPIs */}
      <section aria-label="Indicadores de la plataforma">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-xs)]"
            >
              <p className="suma-overline">{kpi.label}</p>
              <p className="suma-metric mt-2">{kpi.value}</p>
              <p className="suma-caption mt-1">{kpi.hint}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Módulos */}
      <section className="space-y-4">
        <div>
          
          <h2 className="suma-h2 mt-1 text-[var(--text-primary)]">
            Administración de la plataforma
          </h2>
          <p className="suma-body mt-1 text-[var(--text-secondary)]">
            Entra a cada módulo para gestionar su información.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.label}
                to={m.to}
                className={cn(
                  "group flex h-full flex-col rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-xs)]",
                  "transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border-default)] hover:shadow-[var(--shadow-md)]",
                )}
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--red-50)] text-[var(--color-primary)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="suma-h3 text-[var(--text-primary)]">
                    {m.label}
                  </h3>
                </div>
                <p className="suma-body flex-1 text-[var(--text-secondary)]">
                  {m.microcopy}
                </p>
                <p className="suma-subtitle mt-4 inline-flex items-center gap-1 text-[var(--color-primary)] group-hover:gap-1.5">
                  Abrir módulo
                  <ArrowRight className="h-4 w-4" />
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
