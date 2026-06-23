# Cambio de fondo de página a gray-25

## Objetivo
Actualizar el color de fondo general de la interfaz (`--surface-page`) para que use el token más claro `--gray-25` (`#F9FAFB`) de la paleta Cool Gray del Sumatec Design System, en lugar del `--gray-50` actual (`#F4F6F8`).

## Cambio planificado

En `src/styles.css`:
- Modificar el alias semántico:
  ```css
  --surface-page: var(--gray-25); /* fondo de página — casi blanco */
  ```
- Actualizar el comentario descriptivo para reflejar el nuevo token.

## Impacto
Este es un cambio centralizado: `--surface-page` alimenta a `--background`, `--color-surface-page` y el `background` base del `body`. También se usa directamente en las rutas `index.tsx`, `auth.tsx`, `setup/route.tsx` y en `Table.tsx`, por lo que todos esos fondos pasarán automáticamente al nuevo gris más claro sin tocar cada componente.

## Verificación
1. Ejecutar `bun run build` para confirmar que no hay errores de estilos.
2. Capturar una vista previa de `/auth` y `/setup` para validar que el fondo se ve casi blanco y sigue integrado con las tarjetas blancas (`--surface-card` / `--gray-0`).

## Notas
- No se modificarán otros tokens de superficie (`--surface-card`, `--surface-sidebar`, `--surface-sunken`) para mantener la jerarquía visual: página más clara, cards y sidebar blancas.
- No se introducen colores nuevos; se usa un token existente de la rampa Cool Gray.