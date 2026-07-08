## Cambios en `src/routes/_authenticated/pgci/agreements.$agreementId.lines.tsx`

### 1. Header del resumen
- Cambiar el título del `Alert` de "Resumen de códigos en múltiples posiciones" a **"Estado de códigos en múltiples posiciones"**.
- Reemplazar el icono `Info` por `Layers`.
- Alinear el icono horizontalmente con el título (misma línea), manteniendo la estructura del componente `Alert` con ajustes de clase para lograr el layout horizontal.

### 2. Contenido del resumen
Reorganizar el `AlertDescription` para que sea más compacto y muestre cantidad de **códigos** y **posiciones**:

- **Línea independiente (primera):**
  `{conflictGroups.length} códigos en {conflictPositionCount} posiciones no vinculadas con precios distintos`
  - El número de posiciones (`conflictPositionCount`) va en negrilla.

- **Línea con slash (segunda):**
  `{repeatedGroups.length} códigos en {repeatedPositionCount} posiciones no vinculadas / {unifiedGroups.length} códigos en {unifiedPositionCount} posiciones vinculadas`
  - Los números de posiciones (`repeatedPositionCount` y `unifiedPositionCount`) van en negrilla.
  - Separar los dos segmentos con `/` en lugar de salto de línea.

- **Texto explicativo (tercera línea, más pequeño o con margen reducido):**
  "Las posiciones pueden vincularse para compartir un mismo precio; las no vinculadas se gestionan de forma independiente."

### 3. Cálculo de posiciones
- Agregar un `useMemo` para `repeatedPositionCount` sumando `position_ids.length` de `repeatedGroups`.
- Mantener `conflictPositionCount` y `unifiedPositionCount` existentes.
- `unlinkedPositionCount` puede seguir existiendo si se usa en otros lugares; no se elimina.

### 4. Estilo
- Reducir el espaciado interno y entre líneas para que el card se vea más compacto.
- Usar clases utilitarias de Tailwind (`flex`, `items-center`, `gap-2`, `font-semibold`, etc.) sin hardcodear colores; el `Alert` mantiene `variant="info"`.

### Notas
- No se modifica lógica de negocio ni el comportamiento del botón/modal.
- `Layers` ya está importado en el archivo.
- Se verificará con `tsc --noEmit` y, si es posible, con una captura del preview.