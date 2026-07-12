
# Refactor a AuthProvider único — diseño de implementación

## Archivos

- **Nuevos**: `src/integrations/supabase/auth-store.ts`, `src/components/AuthProvider.tsx`
- **Reescritos**: `__root.tsx`, `router.tsx`, `_authenticated/route.tsx`, `auth.tsx`, `index.tsx`, `AuthLoadingScreen.tsx`, `auth-routing.ts`, `start.ts`
- **Borrados**: `auth-ready.ts`, `auth-attacher-ready.ts`

---

## 1) `src/integrations/supabase/auth-store.ts` (NUEVO — reemplaza `auth-ready.ts`)

Store singleton que sirve al mismo tiempo a React (via `useSyncExternalStore`) y a `beforeLoad` (via `await ready`). Sin timeout, sin flag inmortal.

```ts
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./client";

export type AuthState =
  | { status: "loading"; session: null }
  | { status: "signed-in"; session: Session }
  | { status: "signed-out"; session: null };

let state: AuthState = { status: "loading", session: null };
const listeners = new Set<() => void>();

let resolveReady!: () => void;
const readyPromise = new Promise<void>((r) => { resolveReady = r; });
let resolved = false;

function set(next: AuthState) {
  state = next;
  if (!resolved) { resolved = true; resolveReady(); }
  for (const l of listeners) l();
}

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event, session) => {
    // INITIAL_SESSION (con o sin sesión), SIGNED_IN, SIGNED_OUT,
    // TOKEN_REFRESHED, USER_UPDATED — todos son verdad definitiva.
    if (session) set({ status: "signed-in", session });
    else if (event === "SIGNED_OUT" || event === "INITIAL_SESSION")
      set({ status: "signed-out", session: null });
    else if (state.status === "signed-in" && !session)
      set({ status: "signed-out", session: null });
  });
}

export const authStore = {
  getState: () => state,
  getServerState: () => ({ status: "loading", session: null } as AuthState),
  subscribe: (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
  ready: readyPromise,
};
```

---

## 2) `src/components/AuthProvider.tsx` (NUEVO)

```tsx
import { useSyncExternalStore } from "react";
import { authStore, type AuthState } from "@/integrations/supabase/auth-store";
import { AuthLoadingScreen } from "./AuthLoadingScreen";

export function useAuth(): AuthState {
  return useSyncExternalStore(authStore.subscribe, authStore.getState, authStore.getServerState);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  if (auth.status === "loading") return <AuthLoadingScreen />;
  return <>{children}</>;
}
```

**Efecto clave**: mientras `loading`, no hay `<Outlet />` montado en ningún nivel. Ninguna ruta se renderiza hasta que sepamos. Cero flash por construcción.

---

## 3) `src/routes/__root.tsx` — cambios

```tsx
// borrar: import { resetAuthReady } from "..."
// borrar: import { AuthLoadingScreen } from "..."   (ya no se usa aquí)
// añadir: import { AuthProvider } from "@/components/AuthProvider";
// añadir: import { authStore } from "@/integrations/supabase/auth-store";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  authStore: typeof authStore;   // ← inyectado
}>()({
  // borrar: pendingComponent: AuthLoadingScreen,
  ...
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      if (event === "SIGNED_OUT") {
        await queryClient.cancelQueries();
        queryClient.clear();
        router.invalidate();
        return;
      }
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
      </AuthProvider>
      <Toaster />
    </QueryClientProvider>
  );
}
```

En `src/router.tsx` inyectar `authStore` en context:
```tsx
import { authStore } from "./integrations/supabase/auth-store";
// borrar defaultPendingComponent / defaultPendingMs / defaultPendingMinMs
createRouter({
  routeTree,
  context: { queryClient, authStore },
  scrollRestoration: true,
  defaultPreloadStaleTime: 30_000,
});
```

---

## 4) `src/routes/_authenticated/route.tsx` — nuevo beforeLoad

```tsx
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    await context.authStore.ready;                          // primera vez: espera evento real
    const s = context.authStore.getState();
    if (s.status !== "signed-in") throw redirect({ to: "/auth" });
    return { user: s.session.user };
  },
  component: () => <Outlet />,
});
```

Sin `waitForAuthReady`, sin timeout, sin race. En navegación interna `ready` ya está resuelta → `beforeLoad` retorna sincrónicamente sin re-mostrar nada.

---

## 5) `src/routes/index.tsx` y `src/routes/auth.tsx`

`auth-routing.ts` deja de importar `waitForAuthReady`:

```ts
// auth-routing.ts
import { authStore } from "./auth-store";
export async function resolveAuthLanding() {
  await authStore.ready;
  const s = authStore.getState();
  if (s.status !== "signed-in") return null;
  return getLandingForUserId(s.session.user.id);
}
```

`index.tsx`: añadir `ssr: false` (su beforeLoad depende de sesión de cliente).
`auth.tsx`: eliminar `import { AuthLoadingScreen, useAuthResolved }`, eliminar `const authResolved = useAuthResolved();` y el `if (!authResolved) return <AuthLoadingScreen />;`. El `beforeLoad` queda intacto. Como el AuthProvider ya no monta hijos en `loading`, cuando `AuthPage` se monte la sesión ya está resuelta.

---

## 6) `src/components/AuthLoadingScreen.tsx` — recortar

Queda solo el componente visual. Se borran: `useAuthResolved`, `InitialAuthPendingFallback`, imports de `auth-ready`.

```tsx
import { SumatecLogo } from "@/components/SumatecLogo";
export function AuthLoadingScreen() {
  return (
    <main role="status" aria-live="polite" aria-label="Cargando"
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--surface-page)] px-6">
      <SumatecLogo className="h-12 w-auto" />
      <div aria-hidden="true"
        className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border-subtle)] border-t-[var(--color-primary)]" />
    </main>
  );
}
export default AuthLoadingScreen;
```

---

## 7) Layouts `pgci/route.tsx` y `setup/route.tsx`

Se mantienen `useMyProfile` / `useIsSuperAdmin`. El `if (isLoading) return <AuthLoadingScreen />` se puede **dejar tal cual** — ya no es "auth splash", es "cargando perfil del módulo", y visualmente es el mismo componente. No hay duplicación conceptual: cuando estos layouts se montan, la auth ya resolvió; el splash aquí solo cubre el fetch de perfil. Decisión: dejarlos sin cambios (una línea menos de refactor, cero regresión visual).

---

## 8) `src/start.ts` — volver al attacher estándar

```ts
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
// borrar: import attachSupabaseAuthReady
export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
```

`attachSupabaseAuth` llama a `supabase.auth.getSession()`. Con el AuthProvider bloqueando el árbol en `loading`, ningún serverFn se dispara antes de que supabase-js haya rehidratado → sin race.

---

## 9) Borrar archivos

- `rm src/integrations/supabase/auth-ready.ts`
- `rm src/integrations/supabase/auth-attacher-ready.ts`

---

## 5) Verificación de referencias colgantes

Grep final tras aplicar (debe devolver 0 hits en `src/`):

```
waitForAuthReady|isAuthDefinitivelyResolved|subscribeAuthResolved|
useAuthResolved|InitialAuthPendingFallback|authResolvedOnce|
resetAuthReady|auth-ready|auth-attacher-ready
```

Consumidores actuales y qué pasa con cada uno:

| Referencia actual | Acción |
|---|---|
| `start.ts` → `attachSupabaseAuthReady` | Reemplazado por `attachSupabaseAuth` |
| `AuthLoadingScreen.tsx` → `isAuthDefinitivelyResolved`, `subscribeAuthResolved` | Borrados |
| `auth.tsx` → `useAuthResolved`, `AuthLoadingScreen` guard | Borrados |
| `auth-routing.ts` → `waitForAuthReady` | Reemplazado por `authStore.ready` |
| `auth-attacher-ready.ts` → `waitForAuthReady` | Archivo borrado |
| `auth-ready.ts` → self | Archivo borrado |
| `router.tsx` → `InitialAuthPendingFallback` | Borrado |
| `_authenticated/route.tsx` → `waitForAuthReady` | Reemplazado por `context.authStore` |
| `__root.tsx` → `resetAuthReady`, `AuthLoadingScreen` (pendingComponent) | Borrados; el store no necesita reset (los eventos siempre lo actualizan) |

**Nota sobre `resetAuthReady`**: hoy se llama en el `onAuthStateChange` del root para "invalidar cache". Con el nuevo store no aplica: cualquier evento (SIGNED_IN/OUT/…) ya actualiza `state` directamente. `router.invalidate()` sigue disparándose para que TanStack re-corra beforeLoads con el nuevo estado.

---

## Efectos esperados

- **Cold start / F5**: server SSR pinta splash (state=loading) → client hidrata splash (match, sin hydration mismatch) → supabase emite INITIAL_SESSION → provider transiciona → Outlet monta → beforeLoad del gate lee store sincrónicamente → destino final. **Un solo splash, transición directa.**
- **Navegación interna**: `ready` ya resuelta, `getState()` sincrónico, sin splash.
- **Sign out**: root listener limpia cache + invalidate; store transiciona a `signed-out`; gate redirige a `/auth`; AuthProvider ya no bloquea porque no está `loading`.
- **Token viejo/inválido**: supabase emite INITIAL_SESSION con `session=null` → store va a `signed-out` → gate redirige. Sin quedarse en splash.

¿Aplico así, o ajustas algo antes?
