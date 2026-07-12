import { useSyncExternalStore, type ReactNode } from "react";
import {
  authStore,
  type AuthState,
} from "@/integrations/supabase/auth-store";
import { AuthLoadingScreen } from "./AuthLoadingScreen";

export function useAuth(): AuthState {
  return useSyncExternalStore(
    authStore.subscribe,
    authStore.getState,
    authStore.getServerState,
  );
}

/**
 * Gate visual global: mientras la sesión no se ha resuelto por primera vez,
 * pinta el splash y NO monta hijos. Cero rutas renderizadas durante la
 * resolución inicial → cero flash por construcción.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (auth.status === "loading") return <AuthLoadingScreen />;
  return <>{children}</>;
}
