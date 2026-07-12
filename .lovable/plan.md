## Nuevo token: `suma-label`

Agregar en `src/styles.css`, junto a los demás `@utility suma-*` (después de `suma-overline`, antes de `suma-metric`):

```css
/* Label de formulario. Montserrat semibold, 14px, sin uppercase. */
@utility suma-label {
  font: var(--fw-semibold) var(--subtitle-2) / var(--subtitle-2-lh) var(--font-ui);
}
```

Características:
- Fuente: `var(--font-ui)` → Montserrat.
- Peso: `var(--fw-semibold)` → 600.
- Tamaño: `var(--subtitle-2)` → 14px / 20px de line-height (encaja entre `suma-overline` 11px y `suma-subtitle` 16px, y coincide con el actual `text-sm`).
- Sin `text-transform` ni `letter-spacing` extra → minúscula normal.
- Sin `color` → lo hereda del contenedor (o lo fija quien lo use). Esto replica el look del texto "Super administrador" del `UserForm`, que es `suma-body ... font-semibold` y hereda color.

## Cambio en `src/components/ui/label.tsx`

Reemplazar únicamente las clases tipográficas base del `cva`:

- Antes: `"text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"`
- Después: `"suma-label peer-disabled:cursor-not-allowed peer-disabled:opacity-70"`

Se retiran `text-sm`, `font-medium` y `leading-none` (el line-height ya viene en `suma-label`). Se conservan intactas las clases de estado `peer-disabled:*`.

## Propagación
Al ser el componente compartido shadcn `Label`, todos los formularios que lo usan reciben el cambio sin editar nada más:
- `ClientForm.tsx` — Razón social, NIT, Tipo, Cliente padre, switch holding.
- `UserForm.tsx` — Nombre completo, Email, Código ERP, Estado, Nueva contraseña.
- Cualquier otro `<Label>` del proyecto.

El `<Label className="sr-only">` de `PermissionRow` no se ve afectado visualmente (sigue oculto por `sr-only`).

## Qué NO se toca
- Inputs, Selects, Switches.
- Mensajes de error (`suma-caption text-destructive`) y helpers (`suma-caption text-text-tertiary`).
- Marcador de obligatorio `*` en `text-primary` (heredará el nuevo tamaño/peso, consistente).
- Diálogo de credenciales en `users.new.tsx` (usa `suma-overline` explícito → sin regresión).
- El resto de tokens `suma-*`.

## Verificación
1. Abrir `/setup/users/new`, `/setup/users/:id/edit`, `/setup/clients/new`, `/setup/clients/:id/edit`.
2. Los labels ("Nombre completo", "Email", "Código de usuario ERP", "Estado", "Razón social", "NIT", "Tipo", etc.) deben verse en **Montserrat semibold 14px minúscula**, con el mismo look que "Super administrador" del `UserForm`.
3. El `*` rojo aparece cuando corresponde.

## Archivos a modificar
- `src/styles.css` — añadir `@utility suma-label`.
- `src/components/ui/label.tsx` — cambiar clases base del `cva`.