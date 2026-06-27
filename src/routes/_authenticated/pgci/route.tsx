import { createFileRoute } from "@tanstack/react-router";
import { useMyProfile, useIsSuperAdmin } from "@/hooks/use-profile";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/_authenticated/pgci")({
  component: PgciLayout,
});

function PgciLayout() {
  const { data: profile, isLoading } = useMyProfile();
  const { isSuperAdmin } = useIsSuperAdmin();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-page)]">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </div>
    );
  }

  if (!profile || profile.status !== "active") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--surface-page)] px-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">Sin acceso</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu cuenta no está activa. Contacta a un administrador.
          </p>
        </div>
      </main>
    );
  }

  return <AppShell showSetup={isSuperAdmin} showPgci homeHref="/pgci" />;
}
