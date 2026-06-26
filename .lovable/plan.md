Implementación de dos capacidades en la edición de usuario. Tres archivos modificados.

## Archivo 1 — `src/components/setup/UserForm.tsx`

**Cambios:**

1. Extender `UserFormValues` con campo opcional:
   ```ts
   new_password?: string;
   ```
   Agregar `new_password: ""` a `emptyUser`.

2. Eliminar prop `emailLocked` y toda su lógica (incluyendo el `disabled` y el mensaje "El email no se puede modificar").

3. Agregar prop opcional `showPasswordSection?: boolean` (default `false`).

4. Extender validación en `validate()`:
   - Si `v.new_password` tiene valor y longitud < 8 → `errors.new_password = "Mínimo 8 caracteres"`.

5. Renderizar nueva sección al final del grid (antes del bloque de botones), solo si `showPasswordSection`:
   - Contenedor `md:col-span-2 space-y-2` con borde superior tipo separador suave.
   - Título `h3` "Contraseña" (`text-sm font-semibold`).
   - Descripción: "Asigna una nueva contraseña temporal a este usuario. Deberás compartirla manualmente." (`text-xs text-muted-foreground`).
   - Label "Nueva contraseña temporal" + `Input type="text"` (visible), `value={v.new_password ?? ""}`, `onChange` actualiza `new_password`, `placeholder="Opcional"`.
   - Error inline si aplica.

## Archivo 2 — `src/routes/_authenticated/setup/users.$userId.edit.tsx`

**Cambios:**

1. Eliminar prop `emailLocked` del `<UserForm />`.
2. Agregar `showPasswordSection={true}`.
3. Actualizar `description` del `CreateViewShell` a:
   > "Actualiza los datos del usuario. Si cambias el email, el usuario deberá iniciar sesión con el nuevo correo."
4. Extender `initial` con `new_password: ""`.
5. En la `mutationFn`, incluir en el payload:
   - `email: v.email.trim()`
   - `new_password: v.new_password?.trim() || undefined`

## Archivo 3 — `src/lib/users.functions.ts`

**Cambios a `updateUserSchema`:**

```ts
email: z.string().trim().toLowerCase().email().max(255).optional(),
new_password: z.string().min(8).optional(),
```

**Cambios al handler `updateUser`:**

Orden de operaciones tras la verificación `is_super_admin`:

1. **Email**: si `data.email` viene en el payload:
   - Leer email actual: `supabaseAdmin.from("profiles").select("email").eq("user_id", data.user_id).single()`.
   - Si difiere del actual:
     - Verificar no-duplicado: `supabaseAdmin.from("profiles").select("user_id").eq("email", data.email).neq("user_id", data.user_id).maybeSingle()`. Si existe → `throw new Error("Ya existe un usuario con ese email.")`.
     - `supabaseAdmin.auth.admin.updateUserById(data.user_id, { email: data.email })`. Si error → `throw new Error("No se pudo actualizar el email: ${err.message}")`.

2. **Update profile** (existente): incluir `email: data.email` en el `.update({...})` cuando viene en payload.

3. **Password**: si `data.new_password`:
   - `supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.new_password })`. Si error → `throw new Error("No se pudo actualizar la contraseña: ${err.message}")`.

## No se toca

- Lógica activar/inactivar usuario.
- Flujo de creación y modal de credenciales.
- Vista de detalle.
- Vista de acceso a clientes.
- Toast de éxito existente ("Usuario actualizado.").
- Ningún otro archivo.
