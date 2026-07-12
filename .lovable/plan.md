## Unificar la celda de identidad (columna 1) en Clientes y Usuarios

Hoy la primera columna se ve distinta entre ambas tablas por dos razones:

- **Clientes** → línea inferior `text-[13px] text-text-secondary`
- **Usuarios** → línea inferior `text-[12px] text-text-tertiary`

Unifico ambas al mismo patrón — el de la tabla de Clientes, que ya cumple la convención del sistema (misma escala 13px que el resto de columnas de texto, gris `text-secondary` para jerarquía legible).

## Cambios

**`src/routes/_authenticated/setup/users.index.tsx`** (columna "Usuario", L177–L192)
- L179 nombre: `font-ui text-[13px] font-semibold text-text-primary` → `text-[13px] font-semibold text-text-primary` (quitar `font-ui` redundante).
- L189 email: `text-[12px] leading-[1.35] text-text-tertiary` → `text-[13px] leading-[1.35] text-text-secondary`.

**`src/routes/_authenticated/setup/clients.index.tsx`** — no se toca; ya cumple.

## Fuera de alcance
- Datos, queries, orden, badges, iconos, resto de columnas — sin cambios.
- Otras tablas de la plataforma (productos, acuerdos, grupos) — no en este pase.

## Resultado
Las dos celdas quedan idénticas: nombre en 13px semibold `text-text-primary`, línea inferior (padre / email) en 13px `text-text-secondary` con el mismo `leading-[1.35]`.