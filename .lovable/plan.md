## Cambios en la tabla de miembros — `agreements.$agreementId.index.tsx`

### 1. Rename "Admin del acuerdo" → "Administrador"
Solo etiqueta UI. Reemplazar en:
- `<SelectItem value="agreement_admin">` del modal Agregar y del nuevo modal Editar.
- Texto que renderiza el rol en la fila (`m.role === "agreement_admin" ? "Administrador" : "Miembro"`).
El valor técnico `agreement_admin` no cambia.

### 2. Toggle "Ve costos" deshabilitado con tooltip
En cada fila y en el modal Agregar/Editar:
- `<Switch>` siempre con `disabled` (independiente de `canAdmin`).
- Envolver en `<Tooltip>` con contenido "Disponible próximamente."
- Como `disabled` bloquea eventos de puntero, envolver el Switch en un `<span tabIndex={0}>` para que el TooltipTrigger reciba el hover/focus.

### 3. Badge con `erp_user_code`
- Ampliar `listAgreementMembers` en `src/lib/agreements.functions.ts` para incluir `erp_user_code` en el `select` de `profiles` y en el objeto `profile` devuelto.
- En la celda "Usuario", renderizar junto al `full_name` un `<Badge color="neutral" variant="soft">` compacto con el código cuando exista.

### 4. Rol como texto + botón Editar por fila
- Reemplazar el `<Select>` inline por texto plano ("Administrador" / "Miembro").
- Añadir botón `<Button size="icon" variant="ghost">` con ícono `Pencil` en la columna Acciones, visible solo si `canAdmin`.
- Nuevo componente local `EditMemberDialog` (mismo archivo) con:
  - Nombre del usuario en solo lectura (texto, no input).
  - `<Select>` de rol: Administrador / Miembro.
  - `<Switch>` "Ve costos" deshabilitado con el mismo tooltip.
  - Botones Cancelar / Guardar → llama a `updateMember` (mutation ya existente) con `{ member_id, role }`.
- Botón eliminar (`Trash2`) se mantiene, también solo si `canAdmin`. La columna "Acciones" pasa a contener ambos íconos (editar + eliminar).

### 5. Caption debajo de la tabla
Añadir dentro del `<CardContent>`, después del bloque actual con el ícono `Info`, un párrafo `text-xs text-muted-foreground` con:
> Administrador: gestiona el acuerdo, carga y edita posiciones, administra miembros y empresas vinculadas. Miembro: consulta el acuerdo y sus posiciones.

### Archivos tocados
- `src/lib/agreements.functions.ts` — agregar `erp_user_code` al select y al objeto `profile` de `listAgreementMembers`.
- `src/routes/_authenticated/pgci/agreements.$agreementId.index.tsx` — rename, tooltip en Switch, badge ERP, nuevo modal Editar, caption.

Sin cambios de esquema ni de RLS. Sin cambios en `addAgreementMember`/`updateAgreementMember` (el toggle deshabilitado no envía `can_view_costs`).
