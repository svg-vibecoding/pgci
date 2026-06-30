## Cambios en `/pgci/agreements/$agreementId/lines`

Archivo único a modificar: `src/routes/_authenticated/pgci/agreements.$agreementId.lines.tsx`.

### 1. Columnas finales (en orden)

| # | Header | Contenido |
|---|--------|-----------|
| 1 | Cliente | sin cambios (código + descripción) |
| 2 | Jaivaná | sin cambios en contenido (SKU mono + descripción), solo se renombra el header (antes "SKU Jaivaná") |
| 3 | Marca | **nueva** — `products.commercial_brand`, o "—" si no hay |
| 4 | Precio | renombrado desde "Precio venta", contenido igual (`sale_price`) |
| 5 | Precio par | sin cambios |
| 6 | Vigencia hasta | **rediseño** (ver abajo) — reemplaza la columna "Vigencia" que mostraba rango completo |
| 7 | Estado | sin cambios |
| 8 | Acciones | sin cambios |

Como la marca pasa a ser una columna propia, se quitará el sufijo `· {marca}` que hoy aparece bajo la descripción Jaivaná, para no duplicar.

### 2. Columna "Vigencia hasta"

Fecha efectiva = `line.end_date ?? agreement.end_date`.

Render: un `Badge` compacto (componente `@/components/sumatec/Badge`, mismo patrón usado en la plataforma) con la fecha en formato `dd/mm/yyyy`.

Color según días restantes contra hoy:

- **`color="info"` (azul)** — faltan más de 30 días.
- **`color="warning"` (amarillo)** — faltan ≤ 30 días, incluyendo el día actual (diff ≥ 0 y ≤ 30).
- **`color="error"` (rojo)** — la fecha ya venció (diff < 0).
- **`color="neutral"`** con texto "Sin vigencia" — cuando no hay fecha propia ni heredada.

El cálculo de días se hace en zona horaria local, comparando solo la parte de fecha (sin hora) para evitar off-by-one.

### 3. Sin cambios de backend

- No se toca `agreements_with_counts`, RPCs ni schemas.
- El `agreement` ya está disponible en la página vía `getAgreement` y trae `end_date`.
- El `commercial_brand` ya viene en la query de líneas (se usa hoy bajo la descripción).
- El `colSpan` de los estados de carga / vacío sube de `6/7` a `7/8` para acomodar la nueva columna.

### Notas técnicas

- Helper local `vigenciaBadge(endDate: string | null)` que devuelve `{ color, label }` para mantener el render simple.
- Se mantiene `fmtDate` existente para formatear la fecha dentro del badge.
- Búsqueda existente sigue intacta (ya incluye marca via `brand`).
