import { createFileRoute } from "@tanstack/react-router";
import { useIsSuperAdmin } from "@/hooks/use-profile";
import { AppShell } from "@/components/layout/AppShell";
import { AuthLoadingScreen } from "@/components/AuthLoadingScreen";

export const Route = createFileRoute("/_authenticated/setup")({
  component: SetupLayout,
});

function SetupLayout() {
  const { isSuperAdmin, isLoading } = useIsSuperAdmin();

  if (isLoading) {
    return <AuthLoadingScreen />;
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

  return <AppShell showSetup showPgci homeHref="/setup" />;
}

