import { SumatecLogo } from "@/components/SumatecLogo";
import { authResolvedOnce } from "@/integrations/supabase/auth-ready";

/**
 * Pantalla de carga única usada mientras la sesión se resuelve
 * (waitForAuthReady) y los layouts protegidos cargan su perfil.
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

/**
 * Fallback usado por el router para beforeLoad pending. Solo pinta el splash
 * durante el arranque en frío / F5 (sesión aún no resuelta por primera vez).
 * En navegación interna con sesión ya lista devuelve null — sin flash.
 */
export function InitialAuthPendingFallback() {
  if (authResolvedOnce) return null;
  return <AuthLoadingScreen />;
}

export default AuthLoadingScreen;

