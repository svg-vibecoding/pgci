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

const NAV = [
  { to: "/setup", label: "Inicio", icon: Home, exact: true },
  { to: "/setup/clients", label: "Clientes", icon: Building2 },
  { to: "/setup/products", label: "PIM (Productos)", icon: Package },
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
      <aside className="flex w-60 flex-col border-r border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <Link to="/setup" className="flex items-center gap-2">
            <SumatecLogo className="h-7 w-auto" />
            <span className="text-xs font-semibold tracking-wide text-muted-foreground">
              SETUP
            </span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.to
              : pathname.startsWith(item.to);
            const Icon = item.icon;
            if (item.disabled) {
              return (
                <div
                  key={item.to}
                  className="flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground/60"
                  title="Disponible cuando se construya el módulo de Usuarios (S-08)"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </div>
              );
            }
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
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
        <div className="mx-auto max-w-6xl px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
