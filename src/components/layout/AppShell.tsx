import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Gauge, Building2, Package, Users, LogOut, FileText, Search, Download, LayoutDashboard, type LucideIcon } from "lucide-react";
import { SumatecLogo } from "@/components/SumatecLogo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  disabled?: boolean;
  disabledHint?: string;
};

const SETUP_NAV: NavItem[] = [
  { to: "/setup", label: "Plataforma", icon: Gauge, exact: true },
  { to: "/setup/users", label: "Usuarios", icon: Users },
  { to: "/setup/clients", label: "Clientes", icon: Building2 },
  { to: "/setup/products", label: "Productos", icon: Package },
];

const PGCI_NAV: NavItem[] = [
  { to: "/pgci", label: "Perfil comercial", icon: LayoutDashboard, exact: true },
  { to: "/pgci/agreements", label: "Acuerdos", icon: FileText },
  { to: "/pgci/search", label: "Consulta", icon: Search, disabled: true, disabledHint: "En construcción" },
  { to: "/pgci/export", label: "Exportación", icon: Download, disabled: true, disabledHint: "En construcción" },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-3 mb-2 mt-2 flex items-center gap-3">
      <p className="suma-overline text-text-tertiary">
        {children}
      </p>
      <div className="h-px flex-1 bg-[var(--border-subtle)]" />
    </div>
  );
}

function NavList({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
        const Icon = item.icon;

        if (item.disabled) {
          return (
            <li key={item.to}>
              <div
                className="group relative flex cursor-not-allowed items-center gap-2.5 rounded-sm px-3 py-2 suma-body text-[var(--text-disabled)] hover:bg-[var(--gray-50)]"
                title={item.disabledHint ?? "Disponible próximamente"}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                <span className="suma-caption rounded-full bg-[var(--gray-200)] px-2 py-0.5 text-[var(--text-tertiary)]">
                  Próx...
                </span>
              </div>
            </li>
          );
        }

        return (
          <li key={item.to}>
            <Link
              to={item.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-sm px-3 py-2 suma-body transition-colors duration-150",
                active
                  ? "bg-[var(--color-primary)] font-semibold text-[var(--text-on-brand)] hover:bg-[var(--color-primary-hover)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--gray-50)] hover:text-[var(--text-primary)]",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 transition-colors",
                  active
                    ? "text-[var(--text-on-brand)] group-hover:text-[var(--text-on-brand)]"
                    : "text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]",
                )}
              />
              <span>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AppShell({
  showSetup,
  showPgci,
  homeHref,
}: {
  showSetup: boolean;
  showPgci: boolean;
  homeHref: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-[var(--surface-page)]">
      <aside className="flex h-full w-[264px] flex-shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-sidebar)]">
        <div className="px-6 pt-5 pb-2">
          <Link to={homeHref} className="inline-flex items-start" aria-label="Sumatec · Inicio">
            <SumatecLogo className="h-14 w-auto -ml-3" />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-3">
          {showSetup && (
            <>
              <SectionLabel>Setup Operativo</SectionLabel>
              <NavList items={SETUP_NAV} pathname={pathname} />
            </>
          )}
          {showPgci && (
            <>
              <SectionLabel>PGCI</SectionLabel>
              <NavList items={PGCI_NAV} pathname={pathname} />
            </>
          )}
        </nav>

        <div className="border-t border-[var(--border-subtle)] p-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-[var(--text-secondary)] hover:bg-[var(--gray-50)] hover:text-[var(--text-primary)]"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/auth";
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      <main className="h-full min-w-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-6xl px-10 py-14">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
