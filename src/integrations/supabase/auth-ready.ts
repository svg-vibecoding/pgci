// Espera a que supabase-js termine de restaurar la sesión desde localStorage
// antes de decidir "no hay sesión". Evita falsos negativos en:
//  - el gate de rutas protegidas (_authenticated) en F5,
//  - el middleware que adjunta el bearer a server functions.
//
// Uso: `const session = await waitForAuthReady();`

import type { Session } from "@supabase/supabase-js";
import { supabase } from "./client";

const DEFAULT_TIMEOUT_MS = 1500;

let readyPromise: Promise<Session | null> | null = null;

function hasStoredAuthToken(): boolean {
  if (typeof window === "undefined") return false;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("sb-") && key.includes("auth-token")) {
        return true;
      }
    }
  } catch {
    // localStorage puede lanzar en modos exóticos; asumir que no hay sesión.
    return false;
  }
  return false;
}

async function resolveOnce(timeoutMs: number): Promise<Session | null> {
  if (typeof window === "undefined") return null;

  // 1) Primer intento inmediato: si supabase-js ya rehidrató, esto ya trae session.
  const initial = await supabase.auth.getSession().catch(() => ({
    data: { session: null },
  }));
  if (initial.data.session) return initial.data.session;

  // Si no hay token guardado, no vale la pena esperar.
  if (!hasStoredAuthToken()) return null;

  // 2) Esperar INITIAL_SESSION o el primer SIGNED_IN, con tope de timeout.
  const viaEvent = new Promise<Session | null>((resolve) => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED"
      ) {
        data.subscription.unsubscribe();
        resolve(session ?? null);
      }
    });
    // Cleanup por si el timeout gana la carrera.
    setTimeout(() => {
      data.subscription.unsubscribe();
    }, timeoutMs + 50);
  });

  const viaTimeout = new Promise<Session | null>((resolve) =>
    setTimeout(() => resolve(null), timeoutMs),
  );

  const raced = await Promise.race([viaEvent, viaTimeout]);
  if (raced) return raced;

  // 3) Reintento final: puede que el evento ya haya llegado y la sesión esté lista.
  const retry = await supabase.auth.getSession().catch(() => ({
    data: { session: null },
  }));
  return retry.data.session ?? null;
}

export function waitForAuthReady(
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Session | null> {
  if (!readyPromise) {
    readyPromise = resolveOnce(timeoutMs).then((s) => {
      authResolvedOnce = true;
      return s;
    });
  }
  return readyPromise;
}

// Flag: ¿ya se resolvió la sesión al menos una vez en esta carga del bundle?
// El splash de arranque en frío se muestra solo mientras esto es false.
// La navegación interna con sesión ya resuelta NO lo re-dispara.
export let authResolvedOnce = false;

// Se llama tras signIn/signOut para que la próxima lectura vuelva a resolver
// desde el estado actual del cliente. NO resetea `authResolvedOnce`: el
// splash de arranque en frío es una sola vez por carga del bundle.
export function resetAuthReady(): void {
  readyPromise = null;
}

