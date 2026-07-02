
## Contexto

Los cambios en la base de datos introducen **membresías a nivel de agrupador** (`agreement_group_members` con roles `agreement_group_admin` / `agreement_group_member`), un campo `created_by` en `agreement_groups`, dos triggers nuevos (`add_creator_as_group_admin`, `prevent_last_group_admin_removal`) y RLS actualizada tanto para `agreement_groups` y `agreement_group_members` como para `agreements_insert`.

El código actual desconoce este nivel de membresía: `createAgreement` inserta en `agreement_groups` sin `created_by` (así que el trigger no crea admin), `listAssignableGroups` filtra solo por `user_client_access` (ignora grupos donde el usuario es miembro), y no existe ninguna UI ni server function para administrar miembros del agrupador.

Este plan actualiza el código para alinearse con el nuevo schema. Sin implementar todavía.

---

## Paso 1 — Server functions

Archivo: `src/lib/agreements.functions.ts` (+ schemas en `src/lib/agreements.schemas.ts`).

**1.1 `createAgreement` — set `created_by` en cada INSERT a `agreement_groups`**

En los modos `new_for_client` y `free`, incluir `created_by: context.userId` en el `.insert(...)` de `agreement_groups`. El trigger `add_creator_as_group_admin` inserta al creador como `agreement_group_admin` automáticamente. Sin este cambio, los grupos recién creados quedan huérfanos de admin y solo `super_admin` puede administrarlos.

**1.2 `listAssignableGroups` — incluir grupos donde el usuario es miembro**

Hoy filtra por `user_client_access.can_create_agreements`. Cambiar a la unión de:
- Grupos con `client_id` en el conjunto `can_create_agreements = true` (comportamiento actual), **más**
- Grupos donde el usuario tiene fila en `agreement_group_members` (cualquier rol).

Super admin sigue viendo todo. La RLS `ag_select` ya lo permite; solo hay que ampliar el filtro.

**1.3 Nuevas server functions para miembros del agrupador**

Agregar en `agreements.functions.ts`:

- `listAgreementGroupMembers({ group_id })` — devuelve miembros con nombre y email desde `profiles`.
- `addAgreementGroupMember({ group_id, user_id, role })` — valida rol permitido; RLS impone que solo `agreement_group_admin` o `super_admin` pueda insertar.
- `updateAgreementGroupMember({ member_id, role })` — cambio de rol; el trigger `prevent_last_group_admin_removal` bloquea si intenta degradar al último admin.
- `removeAgreementGroupMember({ member_id })` — el mismo trigger bloquea remover al último admin.

Esquemas correspondientes en `agreements.schemas.ts` (`groupMemberAddSchema`, `groupMemberUpdateSchema`, `groupMemberRemoveSchema`).

**1.4 (Opcional flag) `createAgreement` en modo `existing` sobre agrupador libre**

La política `agreements_insert` no autoriza a `agreement_group_admin` sobre grupos libres si no hay `agreement_companies` todavía. La guardia actual del código (`solo super_admin puede usar agrupadores libres`) sigue funcionando; se deja igual y se documenta en la propia función. Si más adelante se quiere abrir a group admins, requerirá una nueva política. **No cambia en este paso.**

---

## Paso 2 — UI

**2.1 Detalle del agrupador (nueva ruta)**

Crear `src/routes/_authenticated/pgci/groups.$groupId.tsx` con:
- Cabecera con `group_name`, cliente (o "Libre"), estado.
- Sección **Miembros del agrupador**: tabla con `full_name`, rol, acciones (cambiar rol / remover) para admins; botón "Agregar miembro" con picker de usuarios activos.
- Enlace inverso: en `agreements.$agreementId.index.tsx` mostrar el nombre del agrupador como link a esta nueva ruta.

Reutilizar patrones de `AgreementCompaniesSection` (dialog + alert-dialog + tabla shadcn) para consistencia. Componente extraído: `src/components/agreements/AgreementGroupMembersSection.tsx`.

**2.2 Listado de agrupadores en creación de acuerdo**

`AgreementForm.tsx` ya recibe `groups` desde `listAssignableGroups`. No cambia la UI, solo cambia el conjunto devuelto (ahora incluye grupos donde el usuario es miembro).

**2.3 Listado de acuerdos**

Sin cambios funcionales. Opcionalmente, agregar tooltip en la columna "Agrupador" mostrando cuántos miembros tiene, si es rápido. **Fuera de scope si no lo pides.**

---

## Paso 3 — Verificación

- Build: `bunx tsgo --noEmit`.
- Manual: crear un acuerdo nuevo → verificar que aparece una fila en `agreement_group_members` con el creador como `agreement_group_admin`.
- Manual: como usuario no-super_admin miembro de un grupo, verificar que `listAssignableGroups` lo devuelve.
- Manual: intentar remover al único admin del grupo → error del trigger.

---

## Orden de ejecución

1. Paso 1.1 y 1.2 (fixes en funciones existentes).
2. Paso 1.3 (nuevas server functions + schemas).
3. Paso 2.1 (nueva ruta + componente).
4. Paso 2.2 (verificar que sigue funcionando; no hay edición).
5. Verificación.

No se toca schema, RLS ni triggers — todo eso ya está en la DB.
