# Sumatec Design System
**v1.0 · Junio 2026**
Fundamentos, componentes, tipografía, colores, espaciado y voz de marca para Sumatec y la PGCI (Plataforma de Gestión Comercial Inteligente).

---

## 1. Contexto de marca

**Sumatec** es el principal distribuidor MRO (Mantenimiento, Reparación y Operación) de Colombia, con base en Manizales, Caldas. Su promesa de marca: *"Una compañía siempre confiable."* Su propósito: *"Trabajamos para que la industria nunca pare."*

**La PGCI** es la plataforma B2B / e-commerce inteligente de gestión comercial — el principal producto digital, con catálogo MRO, portal de cuentas empresariales, cotizaciones y checkout.

---

## 2. Voz y tono

### Idioma y registro
- **Idioma:** español (Colombia).
- **Trato:** siempre **tú** (no usted). *"Para que TU empresa nunca pare."*
- **Voz:** confiada, experta, cercana — *de tú a tú*. Respalda, no alardea.

### Tono por canal
| Canal | Tono |
|---|---|
| Industria | Con confianza, innovador, conocedor |
| Comercio | Motivador, inspirador, de tú a tú |
| Retail | Amable, seguro, experto |
| E-commerce / PGCI | Educador, cercano, voz de respaldo |
| Interno | Transparente, trabajo en red, sin fronteras |

### Reglas de escritura
- **Marketing / heroínas:** MAYÚSCULAS cortas, declarativas — *"LO SOLUCIONAMOS PARA QUE TU EMPRESA NUNCA PARE"*.
- **UI de producto:** sentence case para cuerpos y etiquetas. Mayúsculas solo en overlines, botones de acción y momentos de marca.
- **Sin emoji.** Usar iconos FontAwesome.
- **Firma:** siempre cerrar con el dominio **sumatec.co** en piezas externas.

### Patrones de copy
```
Promesa:   "Una compañía siempre confiable."
Valor:     "Nuestra experiencia es para tu negocio."
Motivación:"Crecer contigo nos mueve."
Solución:  "La solución está en nuestras manos."
```

---

## 3. Colores

### Paleta de marca

| Token semántico | Valor | Uso |
|---|---|---|
| `--color-primary` | `#D91020` | Acción principal, botón CTA, marca |
| `--color-primary-hover` | `#C10D0E` | Estado hover del primario |
| `--color-primary-active` | `#A30A0F` | Estado pressed |
| `--color-accent` | `#0033A1` | Links, B2B, info, confianza institucional |
| `--color-secondary` | `#898A8D` | Acciones secundarias, texto auxiliar |

> **Nota:** `#D91020` es el rojo digital. `#C10D0E` (Pantone) es el rojo de impresión. Usar el digital en pantallas.

### Ramp completo — Rojo
`--red-50` (#FDECEC) → … → `--red-500` (#D91020) → `--red-600` (#C10D0E) → … → `--red-900` (#5A0709)

### Ramp completo — Azul
`--blue-50` (#E7EDF7) → … → `--blue-500` (#0033A1) → … → `--blue-900` (#001238)

### Neutros — Cool Gray
`--gray-0` (#FFF) → `--gray-50` (#F4F6F8) → … → `--gray-500` (#898A8D) → … → `--gray-900` (#1B1A1A)

### Colores semánticos
| Semántico | Soft | Main | Strong |
|---|---|---|---|
| Info | `#EBF1FF` | `#3366FF` | `#1F47CC` |
| Éxito | `#E4F4EA` | `#229A52` | `#16723B` |
| Alerta | `#FFF4DA` | `#FFC745` | `#C9930F` |
| Error | `#FDE7E6` | `#ED362F` | `#C0211B` |

### Aliases semánticos (usar en producto)
```css
--surface-page      /* #F4F6F8 — fondo de página */
--surface-card      /* #FFFFFF — tarjetas, modales */
--surface-sunken    /* #EBEDF0 — secciones hundidas */
--surface-inverse   /* #1B1A1A — barra utility oscura */
--text-primary      /* #1B1A1A */
--text-secondary    /* #637381 */
--text-tertiary     /* #898A8D */
--text-disabled     /* #A8AEB5 */
--border-subtle     /* #DFE3E8 */
--border-default    /* #C8C8C8 */
--focus-ring        /* azul 3px, 32% opacidad */
```

---

## 4. Tipografía

### Familias
| Variable | Fuente | Uso |
|---|---|---|
| `--font-display` / `--font-ui` | **Montserrat** | Display, títulos, UI, botones |
| `--font-body` | **Roboto** | Cuerpo largo, tablas de datos |
| `--font-mono` | Sistema (SF Mono / Menlo) | Código, SKUs, referencias |

Carga Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;0,800;1,600;1,700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
```

### Escala tipográfica
| Nombre | Tamaño | Line-height | Peso | Uso |
|---|---|---|---|---|
| Display LG | 56px | 64px | Black (800) | Héroe web, landing |
| Display MD | 44px | 52px | Black (800) | Sección destacada |
| Display SM | 36px | 44px | Bold (700) | Subtítulo de sección |
| H1 | 30px | 38px | Bold (700) | Título de página |
| H2 | 24px | 32px | Bold (700) | Sección de contenido |
| H3 | 20px | 28px | SemiBold (600) | Subsección, card title |
| H4 | 18px | 24px | SemiBold (600) | Subtítulo de componente |
| Subtitle 1 | 16px | 22px | SemiBold (600) | Énfasis en UI |
| Subtitle 2 | 14px | 20px | Bold (700) | Label de sección |
| Body MD | 14px | 20px | Regular (400) | Texto UI por defecto |
| Body LG | 16px | 24px | Regular (400) | Larga lectura |
| Button | 14px | 18px | Bold (700) | Labels de botón |
| Caption | 12px | 16px | Regular (400) | Notas, metadatos |
| Overline | 11px | 16px | Bold (700) | Labels de categoría |

### Clases de ayuda (CSS)
```css
.suma-display-lg   /* héroe */
.suma-h1 … .suma-h4
.suma-subtitle
.suma-body
.suma-caption
.suma-overline     /* UPPERCASE, tracking ancho */
```

### Reglas de tipografía
- Montserrat **bold/black + UPPERCASE** para momentos de marca y botones CTA.
- Tight letter-spacing (`-0.02em`) en display.
- No usar Roboto en headings o botones.
- Tamaño mínimo en producto digital: **12px** (caption). En móvil, no bajar de 13px.

---

## 5. Espaciado

**Grilla de 8px** con semipaso en 4px.

| Token | Valor | Uso típico |
|---|---|---|
| `--space-1` | 4px | Gaps internos mínimos |
| `--space-2` | 8px | Padding de chip, gap de iconos |
| `--space-3` | 12px | Gap entre label e input |
| `--space-4` | 16px | Padding de tarjeta sm, list item |
| `--space-6` | 24px | Padding de tarjeta md, sección |
| `--space-8` | 32px | Gap entre secciones |
| `--space-12` | 48px | Margen de sección grande |
| `--space-16` | 64px | Topbar height, separación de bloques |

---

## 6. Radio de borde

| Token | Valor | Uso |
|---|---|---|
| `--radius-xs` | 4px | Checkbox |
| `--radius-sm` | 6px | Controles pequeños |
| `--radius-md` | **8px** | **Default** — botones, inputs, tarjetas |
| `--radius-lg` | 12px | Tarjetas de producto, paneles |
| `--radius-xl` | 16px | Modales, galerías |
| `--radius-pill` | 999px | Chips, badges, avatares |

---

## 7. Sombras

Derivadas de la paleta cool-gray de la marca. **Nunca usar negro puro.**

| Token | Uso |
|---|---|
| `--shadow-xs` | Input, elemento elevado mínimo |
| `--shadow-sm` | Card por defecto |
| `--shadow-md` | Card hover, dropdown |
| `--shadow-lg` | Modal, drawer |
| `--shadow-brand` | Botón CTA primario con énfasis |

---

## 8. Movimiento

Transiciones rápidas y con propósito. Sin rebotes ni loops infinitos.

| Token | Valor | Uso |
|---|---|---|
| `--ease-standard` | `cubic-bezier(0.2,0,0,1)` | Mayoría de transiciones |
| `--ease-emphasis` | `cubic-bezier(0.3,0,0,1)` | Escala, entradas |
| `--dur-fast` | 120ms | Hover, focus |
| `--dur-normal` | 200ms | Cambios de estado |
| `--dur-slow` | 320ms | Entrada de paneles |

---

## 9. Iconografía

**Sistema:** FontAwesome 6 (los componentes de Figma están nombrados con glifos de FA exactos).
- Peso por defecto: **solid**. Peso secundario: **regular**.
- Tamaños estándar: 16 / 20 / 24 px.
- Los iconos heredan `currentColor` — recolorear vía CSS `color`.

**Carga CDN (Free, producción):**
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.2/css/all.min.css">
```

**Uso en JSX:**
```jsx
<i className="fa-solid fa-bell" aria-hidden="true" />
<i className="fa-solid fa-magnifying-glass" />
```

> ⚠️ El archivo Figma usa pesos **Pro** (light, duotone, sharp) en algunos glifos. El CDN Free cubre solid/regular al 100%. Si tienes licencia Pro, reemplaza el `<link>` por tu kit y los pesos Pro se resuelven automáticamente.

---

## 10. Logotipo

| Variante | Archivo | Uso |
|---|---|---|
| Wordmark rojo | `assets/logos/sumatec-wordmark-red.png` | Fondos blancos / claros |
| Wordmark blanco | `assets/logos/sumatec-wordmark-white.png` | Fondos oscuros / de marca |
| Logo gris | `assets/logos/sumatec-gray.png` | Usos monocromáticos |
| Contenedor angular | `assets/logos/sumatec-alt-06.png` | Pieza de marca, cintillos |

**Reglas del logotipo:**
- Nunca re-tipografiar el wordmark — usar siempre el asset de imagen.
- Zona de exclusión mínima: equivalente a la altura de la "S".
- Sobre fondos de marca roja, usar siempre la versión blanca.


---

## 11. Componentes

### Resumen

| Componente | Variantes clave | Props principales |
|---|---|---|
| **Button** | contained / outlined / text · primary / accent / secondary / success / error | `color` `variant` `size` (sm/md/lg) `iconLeft` `iconRight` `uppercase` `fullWidth` `disabled` |
| **IconButton** | contained / outlined / ghost · rounded / circle | `icon` `color` `variant` `size` `shape` |
| **Input** | normal / error / disabled | `label` `iconLeft` `iconRight` `prefix` `suffix` `error` `helperText` `size` |
| **Select** | normal / error / disabled | `label` `options` `error` `helperText` `size` |
| **Checkbox** | unchecked / checked / indeterminate / disabled | `label` `checked` `indeterminate` `size` |
| **Radio** | unselected / selected / disabled | `label` `checked` `name` `value` `size` |
| **Switch** | off / on / disabled | `label` `checked` `size` |
| **Card** | elevations xs-lg · interactive | `padding` `elevation` `interactive` |
| **ProductCard** | in-stock / out-of-stock · con/sin descuento | `brand` `sku` `name` `image` `price` `oldPrice` `badge` `inStock` `onAdd` |
| **Badge** | soft / solid · dot | `color` `variant` `dot` |
| **Chip** | soft / solid / outline · selected / removable | `color` `variant` `selected` `iconLeft` `onRemove` |
| **Avatar** | initials / image / fallback | `name` `src` `size` `color` |
| **Breadcrumb** | chevron / slash separator | `items` `separator` |
| **Tabs** | underline · con icono / con conteo | `tabs` `value` `onChange` |
| **Alert** | info / success / warning / error · con cierre | `severity` `title` `onClose` |

---

### 11.1 Button

```jsx
// Importar (si usas el bundle compilado):
const { Button } = window.SumatecDesignSystem;

// Ejemplos
<Button color="primary" iconLeft="bolt">Cotizar ahora</Button>
<Button color="primary" variant="outlined">Ver detalle</Button>
<Button color="primary" size="large" uppercase iconLeft="cart-plus" fullWidth>
  Agregar al carrito
</Button>
<Button color="accent" onClick={...}>Portal B2B</Button>
<Button color="error" variant="outlined" iconLeft="trash">Eliminar</Button>
<Button disabled>No disponible</Button>
```

**Reglas:**
- Un solo botón `contained primary` por vista como CTA principal.
- `uppercase` solo en momentos de marca, no en botones inline.
- Tamaño mínimo de hit target: 32px (sm) / 40px (md) / 48px (lg).
- Estado hover: darken un step (`--color-primary-hover`).
- Estado pressed: darken + `scale(0.98)`.

---

### 11.2 Input & Select

```jsx
<Input
  label="Buscar productos"
  iconLeft="magnifying-glass"
  placeholder="Taladro, broca, EPP…"
  value={q}
  onChange={e => setQ(e.target.value)}
/>

<Input label="NIT" value={nit} error helperText="Formato inválido" />

<Select
  label="Categoría"
  options={['Seguridad', 'Herramientas de poder', 'Soldadura']}
  value={cat}
  onChange={e => setCat(e.target.value)}
/>
```

**Reglas:**
- Siempre mostrar `label` visible — no reemplazar con `placeholder`.
- `error` + `helperText` juntos para errores de validación.
- Anillo de foco visible: `--focus-ring` (blue, 3px).
- Altura: small 36px / medium 44px / large 52px.

---

### 11.3 Card

```jsx
// Tarjeta estática
<Card padding="md" elevation="sm">
  <p>Contenido de tarjeta</p>
</Card>

// Interactiva (hover lift)
<Card interactive onClick={...}>
  <h3>Asesoría experta</h3>
</Card>
```

**Reglas:**
- Fondo siempre `--surface-card` (#fff). Sin fondos de color en cards.
- Borde `1px solid --border-subtle` o sombra sm/md — no los dos a la vez en la misma card.
- Radio `--radius-lg` (12px) en tarjetas de producto. `--radius-md` en paneles de formulario.

---

### 11.4 Badge & Chip

```jsx
// Badge — etiqueta de estado
<Badge color="primary" variant="solid">-25%</Badge>
<Badge color="success">Disponible</Badge>
<Badge dot color="success" /> {/* punto de estado */}

// Chip — filtro / selección
<Chip selected iconLeft="check">Solo disponibles</Chip>
<Chip color="primary" onRemove={() => removeFilter('brand')}>Bosch</Chip>
```

**Reglas:**
- Badge: para estado (Disponible, Agotado, %) y conteos numéricos. Nunca para acciones.
- Chip: para filtros activos, selección múltiple y tags removibles.
- `dot` solo para indicadores de presencia/estado en línea.

---

### 11.5 Alert

```jsx
<Alert severity="success" title="Pedido confirmado" onClose={() => {}}>
  Tu orden #SU-48213 está en preparación.
</Alert>
<Alert severity="error" title="Pago rechazado">
  Verifica los datos de tu tarjeta.
</Alert>
```

**Reglas:**
- Siempre `title` + mensaje para contexto completo.
- Inline (no toasts) en formularios y pantallas de confirmación.
- El botón `onClose` es opcional — omitir en mensajes críticos que deben leerse.

---

## 12. Layouts de producto (PGCI)

### Shell
```
┌─────────────────────────────────────────┐
│ Utility strip (oscuro, 34px)            │
│ TopBar: logo + search + account + cart  │ 72px
│ Category nav                            │ 46px
├─────────────────────────────────────────┤
│                                         │
│  main content (max-width: 1240px)       │
│  padding: 0 24px                        │
│                                         │
├─────────────────────────────────────────┤
│ Footer (oscuro)                         │
└─────────────────────────────────────────┘
```

### Catálogo con filtros
```
┌──────────────┬────────────────────────────┐
│ FilterPanel  │ Sort + Active chips        │
│ 244px        │ Product grid               │
│ (fijo)       │ auto-fill minmax(220px, 1fr)│
└──────────────┴────────────────────────────┘
```

### PDP (detalle de producto)
```
┌────────────────────┬───────────────────────┐
│ Gallery 460px      │ Brand / SKU           │
│ (img + thumbnails) │ Nombre                │
│                    │ Rating                │
│                    │ Price card            │
│                    │ Qty stepper + Agregar │
│                    │ Trust badges          │
└────────────────────┴───────────────────────┘
Tabs: Descripción / Especificaciones / Reseñas
Productos relacionados
```

---

## 13. Accesibilidad

- **Focus ring visible** en todos los controles interactivos (`--focus-ring` blue).
- Mínimo contraste 4.5:1 texto sobre fondo (WCAG AA). Rojo primario pasa sobre blanco.
- `aria-label` obligatorio en `IconButton`.
- Inputs siempre con `<label>` asociado o `aria-label`.
- `role="alert"` en `<Alert>`. `aria-selected` en tabs.
- `disabled` no oculta el foco — use `aria-disabled` + `tabIndex=-1` si necesitas focus trap.

---

## 14. Iconografía — glifos de referencia de marca

Nombres exactos de FontAwesome usados en el sistema:

| Glifo | Clase FA | Uso en PGCI |
|---|---|---|
| Campana | `fa-bell` | Notificaciones |
| Lupa | `fa-magnifying-glass` | Search |
| Carrito | `fa-cart-shopping` / `fa-cart-plus` | E-commerce |
| Usuario | `fa-user` | Account |
| Ubicación | `fa-location-dot` | Ciudad, tienda |
| Chevrón | `fa-chevron-right` / `fa-chevron-down` | Navegación |
| Rayo | `fa-bolt` | CTA destacado |
| Camión | `fa-truck-fast` | Envío |
| Candado | `fa-lock` | Pago seguro |
| Estrella | `fa-star` / `fa-star` (regular) | Rating |
| Escudo | `fa-shield-halved` | Garantía |
| Engranaje | `fa-gear` / `fa-gears` | Mecánica, fijaciones |
| Martillo | `fa-hammer` | Herramientas manuales |
| Casco | `fa-helmet-safety` | Seguridad industrial |
| Fuego | `fa-fire` | Soldadura |
| Regla | `fa-ruler-combined` | Medición |
| Barras filtro | `fa-sliders` | Panel de filtros |

---

## 15. Quick start

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <!-- 1. Tokens + fuentes -->
  <link rel="stylesheet" href="design-tokens.css">
  <!-- 2. Iconos -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.2/css/all.min.css">
  <!-- 3. React (si usas componentes) -->
  <script src="https://unpkg.com/react@18.3.1/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js"></script>
  <!-- 4. Bundle del DS -->
  <script src="_ds_bundle.js"></script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { Button, Card, Badge } = window.SumatecDesignSystem_6b8e18;
    // ...
  </script>
</body>
</html>
```
