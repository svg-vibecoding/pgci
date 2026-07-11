## Alinear el sidebar al sistema Sumatec

El menú lateral usa tokens de color del sistema pero declara tamaños/pesos de forma ad-hoc. Lo unificamos a las utilidades `suma-*` y aligeramos el peso de los items idle, sin cambiar layout, iconografía, estados activos ni comportamiento.

## Cambios en `src/components/layout/AppShell.tsx`

**`SectionLabel`** (encabezados "Setup Operativo", "PGCI")
- De `text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]` a `suma-overline text-text-tertiary`.
- Mantiene uppercase (es un overline por definición del sistema) y la línea divisoria.

**`NavList` items idle** (Plataforma, Usuarios, Clientes, Productos, Inicio, Acuerdos, etc.)
- Tipografía: pasa de `text-sm font-medium` a `suma-body` (Roboto 14/20, regular).
- Color: se mantiene `text-text-secondary` (#525763), mismo que subtítulos y body del sistema.
- Hover: sigue con `hover:bg-[var(--gray-50)] hover:text-text-primary`.
- Icono idle: sigue en `text-text-tertiary`, hover → `text-text-primary`.

**`NavList` item activo** (fondo rojo)
- Tipografía: `suma-body font-semibold` sobre `bg-[var(--color-primary)]`, texto `text-text-on-brand`.
- Sin cambios visuales — sólo se atan a las utilidades del sistema.

**Item deshabilitado** (Consulta, Exportación)
- Tipografía base: `suma-body text-text-disabled`.
- Chip "PRÓX...": de `text-[10px] font-semibold uppercase` a `suma-caption text-text-tertiary` (Roboto 12px, sin uppercase, para ser consistente con los chips de estado de módulos que ya unificamos en `/pgci`). Fondo `bg-[var(--gray-200)]` intacto.

**Botón "Cerrar sesión"**
- Se mantiene el `Button variant="ghost"`, sólo aseguramos que el `className` no fuerce peso extra: quedan las clases actuales de color `text-text-secondary hover:text-text-primary`. El componente `Button` ya define su tipografía; no se sobrescribe.

## Fuera de alcance

- No se cambia el ancho del sidebar, ni la separación entre secciones, ni los iconos.
- No se toca el logo ni el borde derecho.
- No se cambian los estados activo/hover a otros colores.
- No se agrega token nuevo — quedó descartado el intermedio dedicado.

## Resultado esperado

- Items del menú se sienten más livianos (regular en lugar de medium) manteniendo el mismo gris que el resto de la interfaz.
- Los overlines de sección y los chips "PRÓX..." dejan de tener tamaños/pesos hardcoded y pasan a compartir utilidad con el resto del sistema.
- Cualquier cambio futuro en `suma-body` / `suma-overline` / `suma-caption` se refleja automáticamente en el menú.
