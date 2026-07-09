## Diagnóstico

`profiles_select` es `is_super_admin() OR user_id = auth.uid()`. Cualquier consulta que un no-admin hace a `profiles` con la sesión propia (client anon o server publishable con JWT del usuario) solo devuelve su propia fila. Todo lugar del código que hoy hace `context.supabase.from("profiles").select(...).in("user_id", ids)` o `.eq("user_id", otroUsuario)` está roto para platform_user.

## Alcance real del bug (mismo patrón, no solo la sección "Miembros")

Todos leen `profiles` con la sesión del usuario:

1. **`listAgreementMembers`** (`src/lib/agreements.functions.ts`) — bug reportado: nombres de compañeros "—".
2. **`listAgreementGroupMembers`** — idéntico dentro de un agrupador.
3. **`listAgreementCompanies`** — no rompe el nombre de la empresa (viene de `clients`), pero sí las columnas de auditoría (`linked_by_name`, `started_by_name`, `ended_by_name`) → aparecerán "—" para no-admins.
4. **`getAgreement`** → `created_by_name` null para el no-admin.
5. **`getAgreementGroup`** → `created_by_name` null para el no-admin.
6. **Picker "Agregar miembro" en `agreements.$agreementId.index.tsx`** (query `profiles active-search`) y **picker equivalente en `AgreementGroupMembersSection`** — hoy solo el admin puede abrirlos, así que no es un bug visible, pero también viola el anexo 03.00.02 (deberían listar únicamente usuarios asignables al cliente del acuerdo, no todo `profiles`).

Rutas `setup/users.*`, `auth.tsx`, `users.functions.ts` y `setup/index.tsx` también leen `profiles`, pero son áreas admin-only ya cubiertas por `is_super_admin()` — quedan fuera de este cambio.

## Enfoque propuesto

Mantener `profiles_select` cerrada (no relajarla). Exponer los perfiles vecinos únicamente a través de RPCs `SECURITY DEFINER` que validan la autorización del solicitante antes de devolver datos, tal como pide el anexo 03.00.02.

### RPCs nuevas (una migración)

1. `get_agreement_participants(p_agreement_id uuid)` returns table de `(user_id, full_name, email, status, erp_user_code)`.
   - Guard: `if not public.can_access_agreement(p_agreement_id) then raise 42501`.
   - Devuelve profiles de todos los `user_id` que aparecen en `agreement_members` de ese acuerdo (miembros vigentes o históricos, sin filtrar por `valid_until`) más los `assigned_by/started_by/ended_by`. Un solo query sirve para poblar `profile`, `assigned_by_name`, `started_by_name`, `ended_by_name` y también los nombres de auditoría de `listAgreementCompanies` (linked_by / started_by / ended_by) y el `created_by_name` de `getAgreement` — mismo acuerdo, misma frontera de acceso.

2. `get_agreement_group_participants(p_group_id uuid)` returns table equivalente.
   - Guard: `is_super_admin() OR is_agreement_group_member(p_group_id, auth.uid())`.
   - Devuelve profiles de miembros del agrupador + auditoría del propio agrupador. Cubre `listAgreementGroupMembers` y `created_by_name` de `getAgreementGroup`.

3. `list_assignable_users_for_agreement(p_agreement_id uuid)` returns table de profiles activos.
   - Guard: `can_admin_agreement(p_agreement_id)`.
   - Devuelve solo `platform_user` activos que tienen `user_client_access` vigente a alguno de los `client_id` en `agreement_companies` del acuerdo (los "asignables al cliente del acuerdo" que exige el anexo).
   - Reemplaza el picker actual en `agreements.$agreementId.index.tsx`.

4. `list_assignable_users_for_agreement_group(p_group_id uuid)` análogo, guard `is_agreement_group_admin(...) OR is_super_admin()`, asignables al `client_id` del agrupador. Reemplaza el picker de `AgreementGroupMembersSection`.

Todas `SECURITY DEFINER`, `SET search_path = public`, `GRANT EXECUTE ... TO authenticated`, `REVOKE ... FROM anon, public`.

### Cambios en código (mismo PR, después de aplicar la migración)

- `src/lib/agreements.functions.ts`
  - `listAgreementMembers`: reemplazar el `from("profiles").in("user_id", ...)` por `rpc("get_agreement_participants", { p_agreement_id })` y armar el `Map` desde el resultado.
  - `listAgreementGroupMembers`: idem con `get_agreement_group_participants`.
  - `listAgreementCompanies`: usar el mismo `get_agreement_participants` para resolver los nombres de auditoría (ya está bajo `assertCanAccess`, no requiere segundo guard).
  - `getAgreement` y `getAgreementGroup`: mismo RPC para resolver `created_by_name` (una sola llamada extra, sin `.from("profiles")`).
- `src/routes/_authenticated/pgci/agreements.$agreementId.index.tsx`: sustituir el `useQuery` de `profiles active-search` por `useServerFn(listAssignableUsersForAgreement)` con filtrado por término en cliente (o pasando `search` como parámetro al RPC si preferimos), y quitar la dependencia directa de `supabase.from("profiles")`.
- `src/components/agreements/AgreementGroupMembersSection.tsx`: análogo con `listAssignableUsersForAgreementGroup`.

Ningún cambio en `profiles_select`. Ningún cambio en tablas. Solo RPCs nuevas y las funciones/servidor que las consumen.

## Verificación

- Con un `platform_user` miembro no-admin del acuerdo `5bdeea37-…`: la sección "Miembros del acuerdo" muestra los nombres de sus compañeros, la sección "Empresas" muestra auditoría con nombres, y el detalle general muestra "Creado por" con nombre.
- El mismo usuario **no** puede llamar el RPC de un acuerdo del que no es miembro (respuesta `42501` desde `psql`/`supabase.rpc` directo).
- Los pickers de "Agregar miembro" solo aparecen para admins (comportamiento actual) y solo listan usuarios con `user_client_access` vigente al cliente del acuerdo/agrupador — verificado sembrando un `platform_user` sin acceso al cliente y confirmando que no aparece.
- `bunx tsgo --noEmit` en 0.
