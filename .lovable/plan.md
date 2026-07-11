## Diagnóstico

El error se lanza en `src/lib/users.functions.ts:59` — es decir, dentro del bloque que maneja el resultado de `supabaseAdmin.auth.admin.createUser(...)` (líneas 47–60). No es el insert a `profiles` (ese está en 76–78 y lanza un mensaje prefijado con "No se pudo crear el perfil:"), ni la RPC `is_super_admin` (líneas 38–41).

Por qué el mensaje llega vacío al cliente:

1. `auth.admin.createUser` devolvió `{ error }` con un `error` cuyo `.message` es `""` o `undefined`. La línea 55 hace `const msg = createErr?.message ?? "No se pudo crear el usuario";` — pero `??` NO cae al fallback cuando `message` es string vacío, solo cuando es `null`/`undefined`. Si el SDK devuelve `AuthApiError` con `message: ""` (posible en errores 500/422 de GoTrue), `msg` queda `""` y se lanza `new Error("")`.
2. En el cliente, TanStack Start serializa Errors con `ShallowErrorPlugin`, que solo preserva `message`. Un `Error("")` cruza el RPC como `{}` — exactamente lo que ves en el runtime error.
3. Además, se pierden campos útiles del error real: `status`, `code`, `name` (p. ej. `email_address_invalid`, `weak_password`, `email_provider_disabled`, `unexpected_failure`).

Hipótesis del fallo real (a confirmar cuando se exponga el mensaje):
- Dominio `pgci.com` rechazado por Supabase Auth (validación de dominios / SMTP no configurado, aunque `email_confirm: true` normalmente lo evita).
- Password policy custom en el proyecto que rechaza la temp password generada.
- Bloqueo por rate limit / configuración del proveedor de email.

## Fix (solo diagnóstico, mínimo y quirúrgico)

Único archivo: `src/lib/users.functions.ts`, bloque 47–60 del `createUser` handler.

1. Reemplazar el `?? ` por un fallback que también cubra string vacío:
   ```ts
   const rawMsg = createErr?.message?.trim();
   const msg = rawMsg && rawMsg.length > 0 ? rawMsg : "No se pudo crear el usuario (sin mensaje del proveedor de auth)";
   ```
2. `console.error("[createUser] auth.admin.createUser failed", { message: createErr?.message, status: (createErr as any)?.status, code: (createErr as any)?.code, name: createErr?.name });` para que el error real quede en los logs del server function aunque el cliente ya no vea `{}`.
3. Incluir `status`/`code` en el `Error` lanzado al cliente cuando existan, para que el toast muestre algo útil:
   ```ts
   const status = (createErr as any)?.status;
   const code = (createErr as any)?.code;
   throw new Error(`${msg}${code ? ` [${code}]` : ""}${status ? ` (HTTP ${status})` : ""}`);
   ```
4. Espejar el mismo tratamiento en el catch del `profiles` insert (línea 78) por consistencia: incluir `profileErr.code`/`details`/`hint` si existen.

No se toca la lógica de creación, ni el rollback (`deleteUser`), ni el schema, ni la UI. Solo se instrumenta el error para que la próxima ejecución del mismo caso ("Usuario Pruebas 1" / pruebas@pgci.com / QA1) muestre la causa raíz — con eso decidimos el fix definitivo (probablemente ajuste de password/temp password, o de configuración de Auth).

## Siguiente paso tras aplicar

Reproducir la creación con los mismos datos. El toast en la UI y los logs del server function (`stack_modern--server-function-logs`) ya expondrán el `message`/`code`/`status` real. Con ese dato aplicamos el fix definitivo (una única ronda más).
