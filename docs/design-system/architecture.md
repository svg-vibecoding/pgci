# Arquitectura — Sumatec Digital Design System

El sistema se organiza en capas. Las capas de **fundamentos** son fuente de verdad; las **implementaciones** consumen el sistema y nunca lo definen.

```text
Sumatec Digital Design System
├── 1 · Brand Foundations   logo, voz, identidad            ★ fuente de verdad
├── 2 · Digital Tokens      color, tipografía, spacing,     ★ fuente de verdad
│                           radius, shadows, motion, estado
├── 3 · Core Components     primitivos agnósticos de dominio ★ fuente de verdad
├── 4 · Product Patterns    composiciones operativas         ★ fuente de verdad (futuro)
└── 5 · Implementations     apps reales (PGCI, dashboards)   ✗ consumen, no definen
```

> **PGCI** es una implementación (capa 5). Consume las capas 1–4; **jamás** al revés.

## Mapeo a este repositorio

| Capa | En el repo |
| --- | --- |
| 2 · Digital Tokens | `src/styles.css` (`:root` + `@theme inline` + helpers `suma-*`) |
| 3 · Core Components | `src/components/sumatec/` (marca/operación) y `src/components/ui/` (shadcn) |
| 5 · Implementation | rutas de la app PGCI bajo `src/routes/` |
| Vista del sistema | `src/routes/sistema-diseno.tsx` (`/sistema-diseno`) |

## 2 · Digital Tokens (`src/styles.css`)

Variables CSS: rampas de color (red / blue / cool-gray), capa semántica (`--text-primary`, `--surface-card`, `--border-default`, estados), **tokens de estado de dominio** (`--status-{active|pending|review|success|warning|danger|info|neutral}-{soft|base|strong}`), escala tipográfica, grid de 8px, radios, sombras cool-gray y motion. Los productos tematizan contra **intención semántica**, no contra HEX crudo.

Los tokens `--status-*` se mapean a las rampas existentes (sin paleta nueva); la única excepción es `--status-review-strong` (`#8f6300`), un ámbar más oscuro estrictamente para contraste de texto.

## 3 · Core Components

Primitivos **agnósticos de dominio**, reutilizables por cualquier app de Sumatec. En `src/components/sumatec/` viven las piezas de marca y operación (Badge, Chip, StatusBadge, Table). La UI general (Button, Input, Select, Dialog…) usa shadcn alineado a los tokens.

> `src/components/sumatec` **no** contiene comercio/catálogo/storefront.

## Reglas de dependencia

- Una capa solo puede depender de capas de número **menor o igual**.
- Las implementaciones (PGCI) consumen 1–4; nunca al revés.
- Si una app necesita algo que el core no tiene, es un **hueco del sistema** → se evalúa promoverlo a token o componente core, no se hardcodea en la app.
- Lovable implementa **contra esta base** y puede **proponer** mejoras; no improvisa identidad visual.

## Compatibilidad objetivo

React + Tailwind v4 + shadcn/Radix. Iconografía funcional con `lucide-react`.
