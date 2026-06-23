import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useIsSuperAdmin } from "@/hooks/use-profile";
import { SumatecLogo } from "@/components/SumatecLogo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Building2, Home, Package, Users, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/setup")({
  component: SetupLayout,
});

type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
  disabled?: boolean;
};

const NAV: NavItem[] = [
  { to: "/setup", label: "Inicio", icon: Home, exact: true },
  { to: "/setup/clients", label: "Clientes", icon: Building2 },
  { to: "/setup/products", label: "PIM · Productos", icon: Package },
  { to: "/setup/users", label: "Usuarios", icon: Users, disabled: true },
];

function SetupLayout() {
  const { isSuperAdmin, isLoading } = useIsSuperAdmin();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-page)]">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--surface-page)] px-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">No encontrado o sin acceso</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta sección está disponible solo para administradores.
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--surface-page)]">
      <aside
        className="flex w-[264px] flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-card)]"
      >
        {/* Marca */}
        <div className="px-6 pt-6 pb-5">
          <Link to="/setup" className="flex items-center gap-2.5">
            <SumatecLogo className="h-7 w-auto" />
          </Link>
          <p className="suma-overline mt-4">Plataforma</p>
          <p className="mt-1 text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
            Setup Operativo
          </p>
        </div>

        <div className="mx-6 h-px bg-[var(--border-subtle)]" />

        {/* Navegación */}
        <nav className="flex-1 px-3 pt-5">
          <p className="suma-overline px-3 pb-2">Gestión</p>
          <ul className="space-y-0.5">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.to
                : pathname.startsWith(item.to);
              const Icon = item.icon;

              if (item.disabled) {
                return (
                  <li key={item.to}>
                    <div
                      className="group relative flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2 text-sm text-[var(--text-disabled)]"
                      title="Disponible cuando se construya el módulo de Usuarios (S-08)"
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{item.label}</span>
                      <span className="rounded-full bg-[var(--gray-100)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                        Pronto
                      </span>
                    </div>
                  </li>
                );
              }

              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors duration-150",
                      active
                        ? "bg-[var(--red-50)] font-semibold text-[var(--text-primary)]"
                        : "font-medium text-[var(--text-secondary)] hover:bg-[var(--gray-100)] hover:text-[var(--text-primary)]",
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[var(--color-primary)]"
                      />
                    )}
                    <Icon
                      className={cn(
                        "h-4 w-4 transition-colors",
                        active
                          ? "text-[var(--color-primary)]"
                          : "text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]",
                      )}
                    />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-[var(--border-subtle)] p-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-[var(--text-secondary)] hover:bg-[var(--gray-100)] hover:text-[var(--text-primary)]"
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

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
