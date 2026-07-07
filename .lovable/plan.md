## Diagnóstico

En `src/routes/_authenticated/pgci/agreements.index.tsx`, los rótulos `Cliente`, `Múltiple` y `Con alcance` se están renderizando con `<Badge>` de `@/components/sumatec`. Pero `Badge` está diseñado como **contador numérico / dot de estado**:

- `min-width: 20`, `height: 20`, `padding: 0 7px`, `border-radius: pill`, `font-size: 11`, letter-spacing tabular.
- Con textos cortos ("Cliente"), el `min-width` cuadrado + radio píldora hace que se vea como un círculo aplastado, sin aire lateral — exactamente el síntoma que muestras en la captura.

El sistema ya tiene el componente correcto para etiquetas de texto: **`Chip`** (`src/components/sumatec/Chip.tsx`), con alturas 24/30/36, padding lateral 12px, tipografía UI semibold y radio píldora bien proporcionado. Es el mismo Chip que ya se usa en esta misma vista para los filtros activos ("Con pendientes", "Búsqueda: …"), así que unificar ahí resuelve la inconsistencia sin introducir nada nuevo.

## Cambios

Único archivo: `src/routes/_authenticated/pgci/agreements.index.tsx`.

1. **Columna Cobertura**
   - `<Badge color="neutral">Cliente</Badge>` → `<Chip size="small" variant="soft" color="neutral">Cliente</Chip>`
   - `<Badge color="accent">Múltiple</Badge>` → `<Chip size="small" variant="soft" color="accent">Múltiple</Chip>`
   - Mantener el texto del cliente / "N Clientes…" tal cual al lado del chip.

2. **Columna Acuerdo**
   - `<Badge color="info">Con alcance</Badge>` → `<Chip size="small" variant="soft" color="info">Con alcance</Chip>`
   - Es el mismo caso: rótulo de texto, no contador.

3. **Sin cambios** en:
   - `PositionsCounters` (esos SÍ son contadores numéricos → `Badge` es correcto ahí).
   - Vigencia (`Badge` con formato de fecha, ya luce coherente con los contadores; fuera de alcance del reporte del usuario).
   - `StatusBadge` de Estado.
   - Imports: `Chip` ya está importado en el archivo.

## Verificación

- Confirmar visualmente en `/pgci/agreements` que `Cliente` y `Múltiple` en la fila CORONA EPP / TEST X-DEP muestran padding lateral consistente con los chips de filtros activos.
- `bunx tsgo --noEmit` limpio.

## Fuera de alcance

- No se cambian colores, textos ni jerarquía informativa.
- No se toca `Badge.tsx` ni `Chip.tsx` (son piezas del design system compartidas).
