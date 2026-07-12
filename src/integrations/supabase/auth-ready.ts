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

// ============================================================
// Estado "resolución definitiva de sesión"
// ============================================================
// `authDefinitivelyResolved` es TRUE solo cuando sabemos con CERTEZA cuál es
// el estado real de sesión:
//   - getSession() inmediato devolvió una sesión, o
//   - no hay token guardado (definitivamente signed out), o
//   - supabase emitió INITIAL_SESSION / SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED
//     (con o sin sesión — un INITIAL_SESSION con session=null también es
//     definitivo: significa que el token guardado era inválido).
// El timeout puro NO cuenta como definitivo — es un falso negativo posible.
let definitivelyResolved = false;
const subscribers = new Set<() => void>();

function markDefinitivelyResolved(): void {
  if (definitivelyResolved) return;
  definitivelyResolved = true;
  for (const cb of subscribers) {
    try {
      cb();
    } catch {
      // no propagar errores de suscriptores
    }
  }
}

export function isAuthDefinitivelyResolved(): boolean {
  return definitivelyResolved;
}

export function subscribeAuthResolved(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

// Suscripción global permanente: cualquier evento real de auth marca
// definitivo, aunque llegue después del timeout o después de que
// `waitForAuthReady` ya haya resuelto.
if (typeof window !== "undefined") {
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (
      event === "INITIAL_SESSION" ||
      event === "SIGNED_IN" ||
      event === "SIGNED_OUT" ||
      event === "TOKEN_REFRESHED" ||
      event === "USER_UPDATED"
    ) {
      markDefinitivelyResolved();
    }
  });
  // Nunca desuscribimos: vive por toda la carga del bundle.
  void data;
}

async function resolveOnce(timeoutMs: number): Promise<Session | null> {
  if (typeof window === "undefined") return null;

  // 1) Primer intento inmediato: si supabase-js ya rehidrató, esto ya trae session.
  const initial = await supabase.auth.getSession().catch(() => ({
    data: { session: null },
  }));
  if (initial.data.session) {
    markDefinitivelyResolved();
    return initial.data.session;
  }

  // Si no hay token guardado, la ausencia de sesión ES definitiva.
  if (!hasStoredAuthToken()) {
    markDefinitivelyResolved();
    return null;
  }

  // 2) Esperar INITIAL_SESSION o el primer SIGNED_IN, con tope de timeout.
  const viaEvent = new Promise<Session | null>((resolve) => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED"
      ) {
        data.subscription.unsubscribe();
        // Cualquier evento real es definitivo, incluso con session=null
        // (token guardado inválido → INITIAL_SESSION con null).
        markDefinitivelyResolved();
        resolve(session ?? null);
      }
    });
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
  if (retry.data.session) {
    markDefinitivelyResolved();
    return retry.data.session;
  }
  // Nota: NO marcamos definitivo aquí — si llegamos por timeout puro sin
  // evento y sin sesión, la suscripción global permanente arriba lo marcará
  // cuando (si) llegue el evento real.
  return null;
}

export function waitForAuthReady(
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Session | null> {
  if (!readyPromise) {
    readyPromise = resolveOnce(timeoutMs);
  }
  return readyPromise;
}

// Se llama tras signIn/signOut para que la próxima lectura vuelva a resolver
// desde el estado actual del cliente. NO resetea `definitivelyResolved`: una
// vez que sabemos, sabemos.
export function resetAuthReady(): void {
  readyPromise = null;
}

// Compat: algunos módulos aún importan `authResolvedOnce`. Alias al flag
// definitivo para no romper imports antiguos.
export const authResolvedOnce = false;
