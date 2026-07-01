# Plan: estabilizar el flujo inicial `/` → `/auth`

## Diagnóstico

Revisé `src/routes/index.tsx`, `src/routes/auth.tsx` y `src/routes/__root.tsx`. Encontré tres causas concretas que explican los síntomas que describes.

### 1. El botón "Iniciar sesión" requiere varios clics
En `/` (landing) el CTA es un `<button onClick={() => navigate({ to: "/auth" })}>`. La ruta `/` se sirve con SSR: el HTML llega al navegador antes de que React hidrate. Cualquier clic anterior a la hidratación **no ejecuta** el handler de React — el botón parece "muerto" hasta que termina de cargar el bundle. Por eso solo funciona después de varios intentos.

Un `<Link>` de TanStack Router se renderiza como `<a href="/auth">` real: funciona desde el primer paint, sin depender de la hidratación, y además habilita preload.

### 2. `/auth` "se recarga varias veces" mientras se escriben las credenciales
Dos factores concurrentes:

- `/auth` también corre con SSR (`ssr` no está desactivado). El servidor renderiza el formulario y el cliente hidrata; en ese proceso los `<Input>` controlados pueden perder foco/valor si algo re-renderiza el árbol arriba (por ejemplo, cambios de `HeadContent`). En rutas puramente cliente-only esto no ocurre.
- No hay ningún `supabase.auth.onAuthStateChange` global. Cuando el navegador rellena credenciales o Supabase dispara `INITIAL_SESSION` / `TOKEN_REFRESHED` al montar el cliente, no está claro qué ruta debe reaccionar. Además, si ya existe una sesión válida en `localStorage`, `/auth` sigue montándose y el usuario ve el formulario "parpadear" antes del redirect manual.

### 3. Redirect post-login manual y frágil
`onSubmit` hace `signInWithPassword` → consulta `profiles` → `navigate`. Si la consulta a `profiles` falla o tarda, el usuario queda en `/auth` con la sesión ya creada y, si vuelve a escribir, dispara otro submit. No hay un guard que redirija automáticamente cuando ya hay sesión.

---

## Cambios propuestos

### A. `src/routes/index.tsx` — reemplazar botón por Link
Cambiar el `<button onClick={navigate}>` por:
```tsx
<Link to="/auth" preload="intent" className="inline-flex h-12 items-center gap-2 rounded-md bg-[var(--color-primary)] ...">
  Iniciar sesión
  <ArrowRight size={16} aria-hidden="true" />
</Link>
```
Elimina `useNavigate` de este archivo. El link funciona antes de hidratar y precarga `/auth` al hover.

### B. `src/routes/auth.tsx` — desactivar SSR y auto-redirect si hay sesión
- Añadir `ssr: false` a la ruta (Supabase persiste en `localStorage`; SSR no aporta nada aquí y evita el ciclo hidratación/re-render).
- Añadir `beforeLoad` que llame `supabase.auth.getUser()` y, si hay sesión, redirija directamente a `/setup` o `/pgci` según el `role` del perfil. Así entrar a `/auth` ya autenticado no muestra el formulario.
- Envolver `onSubmit` con guardia contra doble submit (además del `loading`, ignorar si ya hay sesión).

### C. `src/routes/__root.tsx` — listener global de sesión
Añadir dentro de `RootComponent` un `useEffect` con el patrón canónico documentado en `tanstack-supabase-integration`:
```tsx
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
    router.invalidate();
    if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
  });
  return () => subscription.unsubscribe();
}, [router, queryClient]);
```
Un único listener filtrado evita que `TOKEN_REFRESHED` / `INITIAL_SESSION` disparen invalidaciones espurias, y garantiza que después del login el `_authenticated` guard vea la sesión sin necesidad de `navigate` manual.

### D. (Opcional, si acepta) simplificar el submit
Con B + C en su lugar, `onSubmit` solo necesita hacer `signInWithPassword`; el `beforeLoad` de `/auth` redirige automáticamente en la siguiente invalidación. El lookup de `profiles` puede seguir para decidir `/setup` vs `/pgci`, pero deja de ser el punto único de falla.

---

## Alcance / no incluye
- No toco `_authenticated/route.tsx` (es integration-managed).
- No cambio el esquema ni políticas de `profiles`.
- No modifico estilos ni copy de `/` ni de `/auth`.

## Verificación
Después de implementar:
1. Cargar `/` y verificar que el CTA responde al primer clic (incluso durante hidratación).
2. En `/auth`, escribir credenciales sin ver el input perder foco ni la vista "parpadear".
3. Iniciar sesión y confirmar redirect directo a `/setup` (super_admin) o `/pgci`.
4. Volver a `/auth` con sesión activa y confirmar redirect automático sin mostrar el formulario.
