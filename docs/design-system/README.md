# Sumatec Digital Design System

Base de diseño **transversal** para los productos digitales de **Sumatec**, proveedor industrial **MRO** (Maintenance, Repair & Operations) de Colombia. Gobierna apps internas, dashboards y herramientas operativas con una sola fuente de verdad de marca, tokens y componentes.

> **Norte:** _"Trabajamos para que la industria nunca pare."_

## PGCI es implementación, no origen

**PGCI** (Plataforma de Gestión Comercial Inteligente) es la **primera implementación operativa** del sistema — **no su dueña**. El design system es transversal: lo que se agregue debe ser reutilizable por futuras apps de Sumatec, no exclusivo de PGCI.

## Qué resuelve

Sumatec construye varios productos digitales. Sin una base común, cada uno reinventa colores, tipografía y componentes → deuda visual y técnica. Este sistema **centraliza** las decisiones de diseño para que cada app implemente **contra una base aprobada** en vez de improvisar identidad visual.

Está pensado para **interfaces operativas con mucha información**: tablas, formularios, estados, filtros y dashboards.

## Dónde vive en este repo

| Pieza | Ubicación |
| --- | --- |
| Tokens (color, tipografía, spacing, radius, shadows, estado) | `src/styles.css` |
| Helpers tipográficos `suma-*` | `src/styles.css` (`@utility`) |
| Componentes de marca y operación | `src/components/sumatec/` |
| UI general (botones, inputs, diálogos) | `src/components/ui/` (shadcn) |
| Vista viva del sistema | `src/routes/sistema-diseno.tsx` → `/sistema-diseno` |
| Documentación de gobierno | `docs/design-system/` |

## Componentes de `src/components/sumatec`

Componentes **de marca y operación** para productos digitales Sumatec — **no** comercio/catálogo/storefront.

- **Badge** — etiqueta de estado o conteo.
- **Chip** — token de filtro/selección/removible (forma píldora).
- **StatusBadge** — indicador de estado de dominio (`active`, `pending`, `review`, `success`, `warning`, `danger`, `info`, `neutral`) sobre tokens `--status-*`.
- **Table** — primitivos de tabla (`Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`) con columnas numéricas, celdas mono y soporte de StatusBadge.

## Reglas rápidas

- **Tematiza contra tokens semánticos** (`--text-primary`, `--surface-card`, `--status-*`), no contra HEX crudo.
- **Iconografía funcional con `lucide-react`** (ya disponible en el proyecto). No se adopta FontAwesome como dependencia de PGCI. Ver `decisions.md` (D-DS-10).
- **No improvisar identidad visual.** Si falta un color/tamaño/estado, se agrega al sistema (tokens), no se hardcodea.
- **Sin comercio en el core.** ProductCard / storefront / carrito / catálogo no hacen parte del sistema ni de PGCI.

Ver `architecture.md` (capas y dependencias) y `decisions.md` (decisiones de gobierno).
