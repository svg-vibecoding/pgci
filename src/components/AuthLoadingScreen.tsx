import { useEffect, useState } from "react";
import { SumatecLogo } from "@/components/SumatecLogo";
import {
  isAuthDefinitivelyResolved,
  subscribeAuthResolved,
} from "@/integrations/supabase/auth-ready";

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
 * Hook reactivo: devuelve true cuando la sesión se resolvió DEFINITIVAMENTE
 * (evento real de supabase o ausencia confirmada de token). Se re-renderiza
 * automáticamente cuando el flag cambia de false → true.
 */
export function useAuthResolved(): boolean {
  const [resolved, setResolved] = useState<boolean>(() =>
    isAuthDefinitivelyResolved(),
  );
  useEffect(() => {
    if (isAuthDefinitivelyResolved()) {
      setResolved(true);
      return;
    }
    const unsub = subscribeAuthResolved(() => setResolved(true));
    // Por si cambió entre el primer render y el subscribe.
    if (isAuthDefinitivelyResolved()) setResolved(true);
    return unsub;
  }, []);
  return resolved;
}

/**
 * Fallback usado por el router para beforeLoad pending. Solo pinta el splash
 * mientras la sesión NO se ha resuelto de forma definitiva. Cubre toda la
 * cadena de redirects de arranque en frío / F5 sin huecos.
 */
export function InitialAuthPendingFallback() {
  const resolved = useAuthResolved();
  if (resolved) return null;
  return <AuthLoadingScreen />;
}

export default AuthLoadingScreen;
