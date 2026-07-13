## Objetivo

Que todo lo visible en el modal "Excluir posición del acuerdo" use tokens del Sumatec Digital Design System (Montserrat/Roboto por token, no clases ad-hoc), para que se lea igual que el resto de formularios PGCI.

Archivo único: `src/routes/_authenticated/pgci/agreements.$agreementId.lines.tsx` (bloque `AlertDialog` de exclusión, ~líneas 1253–1341).

## Auditoría actual → cambio

| Elemento | Hoy (ad-hoc) | DDS correcto |
|---|---|---|
| Título "Excluir posición del acuerdo" | `AlertDialogTitle` default | `suma-h4` + `text-text-primary` (mismo tratamiento que otros títulos de diálogo del sistema) |
| Descripción bajo el título | `AlertDialogDescription` default | `suma-body` + `text-text-secondary` |
| Rótulo "SUMATEC" (bloque producto) | `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground` (fake overline) | `suma-overline` (Montserrat semibold, uppercase, tracking, secondary) — es el uso legítimo del token |
| Línea SKU + descripción | `text-sm` + `font-mono` inline | Reemplazar el bloque completo por **`<IdentityCell code={sku} description={description} />`** (celda de identidad canónica del sistema) |
| Rótulo por cliente (nombre del cliente en el listado de códigos) | mismo fake overline | `suma-overline` |
| Código de cliente + descripción | `text-sm` + `font-mono` inline | `<IdentityCell code={client_code} description={description} />` |
| Label "MOTIVO DE EXCLUSIÓN" | `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground` sobre `<Label>` | `<Label className="suma-label">Motivo de exclusión</Label>` (Montserrat medium 14px, caja normal, primary — mismo tratamiento que "Correo"/"Contraseña" en `/auth` y que el resto de formularios PGCI) |
| Textarea | default shadcn (ya usa tokens) | sin cambio |
| Ayuda "Quedará registrado en la posición excluida." | `text-xs text-muted-foreground` ad-hoc | `suma-caption` (Roboto regular, caption size, secondary — el token oficial de ayuda de formulario) |
| Botones "Cancelar" / "Excluir posición" | `AlertDialogCancel` / `AlertDialogAction` | sin cambio (ya heredan variantes Sumatec: outline y primary rojo) |
| Separador `<hr>` entre bloques | `border-border` | sin cambio |

## Racional de unicidad

- **Un solo label de formulario** en toda la app: `suma-label` (caja normal). Elimina la incoherencia de tener labels en MAYÚSCULAS solo en este modal.
- **Un solo overline** para rótulos de sección/grupo dentro de tarjetas: `suma-overline`. Los rótulos "SUMATEC" y el nombre del cliente sí son rótulos de sección (no labels de campo editable), así que se quedan uppercase pero vía token.
- **Un solo patrón "código + descripción"**: `IdentityCell` ya define la regla (código mono 12.5px semibold primary, descripción sans 13px regular secondary). Usarlo aquí elimina el `font-mono` suelto y el `text-muted-foreground` a mano.
- **Un solo texto de ayuda bajo campo**: `suma-caption`.

## Alcance

- Solo tipografía y tokens en el modal de exclusión. No se toca lógica, estado, layout de la tarjeta gris, ni copy (excepto "MOTIVO DE EXCLUSIÓN" → "Motivo de exclusión" por la regla de `suma-label`).
- No se tocan otros diálogos (publicar, editar). Si más adelante quieres, aplico el mismo barrido a `LineEditDialog.tsx:588` que tiene el mismo fake overline.
