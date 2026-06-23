Ajustar el componente `Button` para alinearlo con el Sumatec Design System, sin modificar los ítems de menú.

## Estado actual de los botones (`src/components/ui/button.tsx`)

- **Radio de borde:** base `rounded-md`. Dado el mapeo `--radius-md: var(--radius)` (14 px), los botones terminan con esquinas de 14 px, el mismo radio propuesto para cards, lo que los hace sentirse iguales a contenedores grandes en lugar de controles operativos.
- **Alturas (`size`):**
  - `default`: `h-11` (44 px)
  - `sm`: `h-9` (36 px)
  - `lg`: `h-12` (48 px)
  - `icon`: `h-10 w-10` (40 px)
- **Tipografía:** `text-sm` / `font-medium` (Montserrat vía `--font-ui`), coherente con el sistema.
- **Foco:** `focus-visible:ring-1 focus-visible:ring-ring`, válido.
- **Variantes:** usan los tokens shadcn mapeados a Sumatec (`--primary`, `--secondary`, `--accent`, `--destructive`, etc.); eso está bien.

## Cambios propuestos

1. **Radio de borde de los botones:** cambiar la clase base de `rounded-md` a `rounded-sm`.
   - Eso aplica `--radius-sm = 8 px`, que es el radio default de marca del Sumatec Design System.
   - Diferencia claramente botones (controles compactos) de cards/tablas (que conservan `--radius` o `--radius-lg`).

2. **Alturas de los botones:** ajustar las escalas para que se sientan más operativas y alineadas con la grilla 8 px del sistema:
   - `sm`: `h-8` (32 px), `px-3`, `text-xs`
   - `default`: `h-10` (40 px), `px-5`, `text-sm`
   - `lg`: `h-12` (48 px), `px-8`, `text-sm`
   - `icon`: `h-9 w-9` (36 px) para emparejar con la escala `sm`

3. **No tocar los ítems de menú:** el sidebar personalizado (`src/routes/_authenticated/setup/route.tsx`) mantiene sus clases de hover y radio independientes; este plan solo modifica `src/components/ui/button.tsx`.

## Archivos a editar

- `src/components/ui/button.tsx` — base y variantes de tamaño.

## Verificación

- Revisar visualmente botones en `/auth`, `/setup`, `/setup/clients` y `/setup/products`.
- Confirmar que cards y tabla no cambian de radio (no se tocan).
- Ejecutar `bun run build` para validar que no hay errores.