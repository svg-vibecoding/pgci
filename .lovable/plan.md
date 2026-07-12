## Diagnóstico: por qué te saca de sesión a mitad de uso

Revisé el flujo de auth y encontré **tres puntos que, combinados, explican los cierres de sesión inesperados**:

### 1. `beforeLoad` en `_authenticated` llama a `supabase.auth.getUser()` en cada navegación
`src/routes/_authenticated/route.tsx` hace una llamada de red a `/auth/v1/user` **cada vez que navegas a cualquier ruta protegida** (y también en cada preload por hover de un `<Link>`, porque `defaultPreloadStaleTime: 0` en `src/router.tsx`).

- Si esa llamada falla por cualquier razón transitoria (red, 5xx momentáneo, timeout, token justo expirando antes de que el auto-refresh corra), el `beforeLoad` lanza `redirect({ to: "/auth" })` y quedas fuera.
- En los logs de auth se ven ráfagas de `/user` seguidas — eso es este `beforeLoad` disparándose múltiples veces por interacción.

### 2. El listener global reacciona a `SIGNED_OUT` invalidando router
En `src/routes/__root.tsx` (línea 123), `onAuthStateChange` invalida el router en `SIGNED_OUT`. Si Supabase falla al refrescar el token (por ejemplo, un refresh token rotado en otra pestaña, o una respuesta 400 del endpoint `/token?grant_type=refresh_token`), dispara `SIGNED_OUT` automáticamente → el `beforeLoad` corre de nuevo sin usuario → redirect a `/auth`. Síntoma exacto: "estaba trabajando y de golpe volví al login".

### 3. `attachSupabaseAuth` lee `getSession()` en cada server function
Cada llamada RPC (guardar cliente, toggles de asignación, etc.) pasa por `getSession()` client-side. En momentos donde el refresh está en curso, puede devolver una sesión vacía y el server responde `Unauthorized`. Eso no cierra sesión por sí solo, pero contribuye a la sensación de "algo se cae".

---

## Plan de acción (sin tocar lógica de negocio)

**A. Bajar la presión sobre `/auth/v1/user`** — `src/routes/_authenticated/route.tsx`
- Reemplazar `getUser()` por `getSession()` en `beforeLoad`. `getSession()` es local (lee de `localStorage`), no hace red, y es lo que Supabase recomienda para gates de UI. La validación real del token la hace igual el server en `requireSupabaseAuth`.
- Solo redirigir a `/auth` cuando **no hay sesión** en absoluto, no cuando hay error de red.

**B. Endurecer el `onAuthStateChange`** — `src/routes/__root.tsx`
- Mantener la invalidación en `SIGNED_IN` / `USER_UPDATED`.
- En `SIGNED_OUT`: solo invalidar router (para que el gate haga su trabajo) y **cancelar queries en vuelo** antes, para evitar la tormenta de 401 que también dispara el listener.
- Ignorar explícitamente `TOKEN_REFRESHED` e `INITIAL_SESSION` (ya se ignoran, mantener).

**C. Reducir preloads agresivos** — `src/router.tsx`
- Subir `defaultPreloadStaleTime` a algo como `30_000` (30s) para que el hover sobre un `<Link>` no re-dispare `beforeLoad` una y otra vez. Esto reduce llamadas de auth y de datos sin cambiar comportamiento visible.

**D. Verificación**
- Después de aplicar, probar: navegar entre Setup → Usuarios → Cliente y permisos, guardar cambios, dejar la pestaña en segundo plano ~5 min y volver. No debería expulsar.
- Revisar logs de auth: la ráfaga de `/user` debe desaparecer.

---

### Fuera de alcance
- No toco `signOut` de `AppShell`, ni la lógica de guardado, ni permisos, ni el switch "Ver asignados" recién hecho.
- No cambio archivos auto-generados (`client.ts`, `auth-middleware.ts`, `auth-attacher.ts`).

¿Apruebas para implementar?