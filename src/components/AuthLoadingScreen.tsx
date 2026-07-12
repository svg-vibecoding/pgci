import { SumatecLogo } from "@/components/SumatecLogo";

/**
 * Pantalla de carga única. La monta `AuthProvider` mientras la sesión no
 * se ha resuelto por primera vez, y los layouts de módulo mientras
 * cargan el perfil.
 */
export function AuthLoadingScreen() {
  return (
    <main
      role="status"
      aria-live="polite"
      aria-label="Cargando"
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--surface-page)] px-6"
    >
      <SumatecLogo className="h-12 w-auto" />
      <div
        aria-hidden="true"
        className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border-subtle)] border-t-[var(--color-primary)]"
      />
    </main>
  );
}

export default AuthLoadingScreen;
