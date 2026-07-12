// Store singleton de estado de sesión. Fuente única de verdad consumida por:
//  - React (via useSyncExternalStore en AuthProvider / useAuth)
//  - beforeLoad de rutas (via `await authStore.ready`)
//
// Sin timeout, sin flag inmortal. Cualquier evento real de supabase
// (INITIAL_SESSION con o sin sesión, SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED,
// USER_UPDATED) actualiza el estado y resuelve `ready`.

import type { Session } from "@supabase/supabase-js";
import { supabase } from "./client";

export type AuthState =
  | { status: "loading"; session: null }
  | { status: "signed-in"; session: Session }
  | { status: "signed-out"; session: null };

let state: AuthState = { status: "loading", session: null };
const listeners = new Set<() => void>();

let resolveReady!: () => void;
const readyPromise = new Promise<void>((r) => {
  resolveReady = r;
});
let resolved = false;

function set(next: AuthState) {
  state = next;
  if (!resolved) {
    resolved = true;
    resolveReady();
  }
  for (const l of listeners) {
    try {
      l();
    } catch {
      // no propagar errores de suscriptores
    }
  }
}

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      set({ status: "signed-in", session });
    } else if (event === "SIGNED_OUT" || event === "INITIAL_SESSION") {
      set({ status: "signed-out", session: null });
    } else if (state.status === "signed-in" && !session) {
      set({ status: "signed-out", session: null });
    }
  });
}

export const authStore = {
  getState: (): AuthState => state,
  getServerState: (): AuthState => ({ status: "loading", session: null }),
  subscribe: (cb: () => void): (() => void) => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  ready: readyPromise,
};
