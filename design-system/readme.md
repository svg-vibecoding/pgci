# Sumatec Design System

The design system for **Sumatec** — Colombia's industrial **MRO** (Maintenance, Repair & Operations) supplier — and the foundation for the new **PGCI (Plataforma de Gestión Comercial Inteligente)**, an intelligent commercial-management platform. This system modernizes the brand for a digital-first, professional product surface while staying true to Sumatec's heritage: bold red, industrial confidence, and a voice that talks *de tú a tú*.

> **Tagline / north star:** *"Trabajamos para que la industria nunca pare."*
> (We work so industry never stops.) Brand promise: *"Una compañía siempre confiable."*

---

## Sources

These inputs were provided and used to build this system. The reader may not have access — links/paths recorded for traceability.

- **Figma:** `Sumatec _Design_System (Figma).fig` — pages `SUMATEC-Design-System` (SUMA Colors / Typography / Logos), `SUMATEC-Icons`, `Button`, plus a large e-commerce component library (App Bar, Catalog, Checkout, Lists, Feedback…).
- **Brand manual:** `uploads/MANUAL DE MARCA 2023.pdf` (63 pp.) — color, type, logo containers, photography, brand voice by channel (industria, comercio, retail, e-commerce, interno).
- **Logos:** `uploads/Logos_Sumatec_últimos-03.png` and Figma logo assets → copied to `assets/logos/`.

Where the Figma and brand manual diverged, the system favors the **digital** values (e.g. digital primary `#D91020` over print `#C10D0E`) and extends the scale upward for web.

---

## What changed for a "more digital" Sumatec

The brand inputs were treated as *nociones*, not a straitjacket. Deliberate moves toward a mature, modern system:

- **A full tonal ramp** for every brand hue (red, blue, 12-step cool-gray) instead of 3–4 flat swatches — enough to build real UI states (hover, disabled, soft backgrounds, borders).
- **A proper semantic layer** (`--text-primary`, `--surface-card`, `--border-default`, status colors) so product teams theme against intent, not raw hex.
- **An extended type scale** with web `display` sizes on top of the original Figma headline set, all on Montserrat.
- **8px spacing grid, 8px default radius, a cool-gray shadow system** derived from the brand's own `rgba(200,200,200,…)` shadow set.

---

## CONTENT FUNDAMENTALS — how Sumatec writes

**Language:** Spanish (Colombia). Address the reader as **tú** (informal, close) — *"para que TU empresa nunca pare"*, *"sabemos lo que necesitas"*. Never *usted* in product/marketing.

**Voice (from the manual's brand-voice matrix):** confident, expert, and human — *"¿Cómo le hablamos a las personas como personas?"* The throughline across channels is **respaldo** (backing/support) and **solución**:
- *Industria* → con confianza, con seguridad, conocedor e innovador.
- *Comercio* → motivadora, inspiradora, de tú a tú.
- *Retail* → amable, segura de lo que dice, experta.
- *E-commerce* → educadora, cercana, voz de respaldo.
- *Interno* → trabajo en red, transparencia, sin fronteras.

**Tone:** optimistic and solution-first — *"siempre brindando una solución con actitud positiva."* We sell expertise and reliability, not hype.

**Casing:** marketing headlines are frequently **ALL CAPS** and short, stacked, declarative — *"LO SOLUCIONAMOS PARA QUE TU EMPRESA NUNCA PARE"*, *"NUESTRA EXPERIENCIA ES PARA TU NEGOCIO."* In product UI use sentence case for body and labels; reserve uppercase for overlines, buttons, and brand moments.

**Copy patterns / examples:**
- Promise lines: *"Una compañía siempre confiable."* / *"La solución está en nuestras manos."*
- Value: *"Nuestra experiencia es para tu negocio."* / *"Crecer contigo nos mueve."*
- Always sign off with the domain: **sumatec.co**.

**Emoji:** not part of the brand — do **not** use emoji in product or marketing surfaces. Use FontAwesome icons instead.

---

## VISUAL FOUNDATIONS

**Color vibe.** Sumatec is **red-forward and high-contrast**. Red (`#D91020`) is the action/brand color and is used decisively — buttons, key numbers, hero sections — never as a wash. Blue (`#0033A1`, Pantone 286C) is the institutional/trust accent (links, info, B2B/account contexts). Everything else is **cool gray** — clean, neutral, industrial. White space is generous; backgrounds are `--surface-page` (`#F4F6F8`) or pure white, never gradient-y.

**Typography.** **Montserrat** does the heavy lifting — display, headings, UI labels, buttons (Bold/SemiBold, often uppercase for moments). **Roboto** is the secondary face for dense data tables and long reading. The logotype itself is a custom **bold italic** wordmark (use the image asset; do not re-typeset it). Headlines are tight, confident, often stacked.

**Backgrounds.** Flat color, no decorative gradients. Photography (when present) shows **real people and real industrial action** — workers, tools, plants — warm and natural, conveying *cercanía, confianza, experiencia y seguridad*. Imagery is full-bleed in heroes, clipped by the container shape for brand moments. No illustration-heavy or hand-drawn style.


**Spacing & layout.** 8px grid. Comfortable, generous padding; product density is medium (not cramped). Max content width 1280px; app shell uses a 264px sidebar + 64px topbar.

**Corner radii.** Default **8px** (`--radius-md`) for buttons, inputs, cards. Chips/tags/avatars are **pill** (`--radius-pill`). Small controls 6px. The brand never uses heavy/bubbly rounding.

**Cards.** White surface, 8px radius, hairline `--border-subtle` *or* a soft cool-gray shadow (`--shadow-sm` / `--shadow-md`) — not both heavy. No colored left-border accents.

**Borders & shadows.** Borders are cool-gray hairlines (`#DFE3E8` default, `#C8C8C8` strong). Shadows are soft, neutral, derived from the brand's `rgba(200,200,200,…)` set — never black, never harsh. A red `--shadow-brand` exists for elevated primary CTAs only.

**Hover states.** Primary actions darken red `#D91020 → #C10D0E`. Neutral/ghost surfaces go to `--surface-sunken` (light gray fill). Links underline on hover. Avoid opacity-only hovers on solids.

**Press / active.** Darken one more step (`--color-primary-active`) and a subtle `scale(0.98)`. Don't bounce.

**Focus.** Visible blue focus ring `--focus-ring` (3px, Pantone-blue at 32%) — accessibility is non-negotiable in a B2B tool.

**Motion.** Purposeful and quick. `--ease-standard` for most, `--dur-fast/normal` (120–200ms). Fades and short slides; **no** bouncy/elastic easing, no infinite decorative loops.

**Transparency & blur.** Used sparingly — drawer/modal scrims (cool-gray at ~40%), occasional frosted topbar. Not a glassmorphism system.

---

## ICONOGRAPHY

Sumatec's icon set in Figma is **FontAwesome** (the components are named exactly: `bell-solid`, `magnifying-glass-solid`, `chevron-up-solid`, `circle-info-solid`, `plus-solid`, `bars-filter-solid`, `arrows-up-down-solid`, `square-regular`, `circle-dot-sharp-regular`, `spinner-third-duotone`, `star-solid`…). Weights used span **solid / regular / light / duotone / sharp** (FontAwesome **Pro**).

**Approach in this system:** icons are loaded from the **FontAwesome 6 Free CDN** (solid + regular), which covers the vast majority of the set 1:1 by name. This is a faithful match, not a substitution, for the free weights.

> ⚠️ **Flag:** A handful of brand glyphs use FontAwesome **Pro** weights (light, duotone, sharp) that aren't in the Free CDN. Where a Pro-only glyph is needed, the nearest Free solid/regular is used. If you have a FontAwesome Pro kit, drop the kit `<script>` in and the Pro weights will resolve automatically.

- Style: **solid** is the default product weight; **regular** for lighter/secondary affordances.
- Standard icon sizes: 16 / 20 / 24px. Stroke/visual weight matches Montserrat's confidence.
- Icons inherit `currentColor` — recolor via CSS `color`.
- **No emoji. No unicode-as-icon.** Use FontAwesome.

Usage in cards/components: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.2/css/all.min.css">` then `<i class="fa-solid fa-bell"></i>`.

---

## Index / manifest

**Root**
- `styles.css` — global entry (import this).
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `base.css`.
- `readme.md` — this guide. · `SKILL.md` — agent-skill manifest.

**Foundations** (`guidelines/`) — specimen cards shown in the Design System tab (Type, Colors, Spacing, Brand).

**Components** (`components/`) — reusable React primitives, one folder each, with `.d.ts`, `.prompt.md`, and a `@dsCard` HTML:
- `Button`, `IconButton`, `Chip`, `Badge` · `Input`, `Select`, `Checkbox`, `Radio`, `Switch` · `Card`, `ProductCard` · `Avatar`, `Breadcrumb`, `Tabs`, `Alert`.

**UI kit** (`ui_kits/pgci/`) — interactive PGCI recreation: catalog, product detail, cart/checkout, account/orders.

**Assets** (`assets/`) — `logos/` (red, white, gray wordmark variants). Icons via FontAwesome CDN.

---

## Quick start

```html
<link rel="stylesheet" href="styles.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.2/css/all.min.css">
<!-- components are bundled to window.<Namespace> by the compiler; see component .prompt.md files -->
```
