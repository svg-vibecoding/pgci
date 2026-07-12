## Estándar único de fichas (cards) — toda la plataforma

**Regla aplicada a cada CardTitle y campo de ficha:**
1. `CardTitle` → `suma-h4`
2. Label de campo → `suma-overline text-text-secondary`
3. Valor de campo → `suma-body text-text-primary`

Se elimina cualquier `text-base` / `text-sm` / `text-xs` / `text-muted-foreground` / `text-foreground` que cumpla ese rol en el header o campos de la ficha (no toco esas clases cuando pertenecen a otros elementos como badges, botones, tablas, alerts, celdas ni contenido narrativo).

---

## Cambio central (una sola edición cubre muchas fichas)

**`src/components/setup/InfoSection.tsx`** — actualizar el componente compartido:
- `InfoField` label: `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground` → `suma-overline text-text-secondary`
- `InfoField` valor: `mt-1 text-sm text-foreground break-words` → `mt-1 suma-body text-text-primary break-words`
- `InfoSection` título opcional: `text-xs font-semibold uppercase tracking-wider text-foreground/70` → `suma-overline text-text-secondary` (para consistencia)

Con esto se alinean automáticamente todas las fichas que consumen `InfoField`:
- `src/routes/_authenticated/setup/users.$userId.index.tsx` (Información del usuario)
- `src/routes/_authenticated/setup/products.$productId.tsx` (Información del producto)

---

## CardTitle → suma-h4 (reemplazos puntuales)

Cambiar la clase del `CardTitle` en cada línea listada:

**`src/routes/_authenticated/setup/users.$userId.index.tsx`**
- L308 `suma-h3` → `suma-h4` ("Información del usuario")
- L351 `suma-h3` → `suma-h4` ("Cartera de clientes")

**`src/components/pgci/CommercialProfileView.tsx`**
- L161 `suma-h3` → `suma-h4` ("Información personal")
- L198 `suma-h3` → `suma-h4` ("Clientes y accesos")

**`src/routes/_authenticated/setup/products.$productId.tsx`**
- L142 `text-base` → `suma-h4` ("Información del producto")

**`src/routes/_authenticated/setup/products.import.tsx`**
- L222, L234, L524 `text-base` → `suma-h4` (pasos del wizard)

**`src/routes/_authenticated/pgci/agreements.$agreementId.index.tsx`**
- L213, L255 `text-base` → `suma-h4`

**`src/routes/_authenticated/pgci/groups.$groupId.tsx`**
- L200, L221, L271, L459 `text-base` → `suma-h4`

**`src/components/agreements/AgreementGroupSection.tsx`**
- L66, L192, L221 `text-base` → `suma-h4`

**`src/components/agreements/AgreementCompaniesSection.tsx`**
- L163 `text-base` → `suma-h4`

**`src/components/agreements/AgreementGroupMembersSection.tsx`**
- L145 `text-base` → `suma-h4`

**`src/routes/_authenticated/setup/clients.$clientId.index.tsx`** — ya cumple (`suma-h4` en las 5 cards). No se toca.

---

## Fuera de alcance
- Títulos de vista (h1) — se mantienen en `suma-h1`.
- Datos, queries, permisos, lógica, estructura de layout — sin cambios.
- Tablas, badges, alertas, botones, breadcrumbs y textos narrativos dentro de la card — no son "label/valor de ficha" y no se tocan en este pase.
- `AgreementCompaniesSection`/`AgreementGroupSection`/`groups.$groupId`/`agreements.$agreementId.index` — solo se ajusta el CardTitle; sus internos usan tablas o formularios propios, no el patrón label→valor de ficha.

## Verificación posterior
- `rg "CardTitle className" src/` → todas deben mostrar `suma-h4`.
- `rg "text-\[11px\] font-semibold uppercase" src/components/setup/InfoSection.tsx` → sin resultados.