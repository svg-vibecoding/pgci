# Plan: Card 2 — "Lectura del archivo"

## Objetivo

Dar identidad clara a la Card 2 del flujo de importación: que sea **solo lo que el archivo trae**, antes de cualquier clasificación. Card 3 queda exclusivamente para clasificación y decisiones.

## Cambios de certeza

### 1. Mover métricas del archivo a Card 2

- Las 3 métricas actuales de `ImportReportHeader` (Filas totales · Códigos Jaivaná únicos · Códigos Jaivaná no identificados) pasan de Card 3 a Card 2.
- Card 3 ya no las muestra; solo conserva la barra de decisión y los 6 acordeones de grupos.

### 2. Renombrar Card 2

- Título actual: **"Qué se reconoció"** → nuevo: **"Lectura del archivo"**.
- El `CardTitle` en la ruta de importación se actualiza.

### 3. Columnas mapeadas con conteo de valores

Para cada una de las 8 columnas canónicas presentes en el archivo se mostrará:

```
Código Jaivaná    31 / 31
Precio par         8 / 31
Observaciones      2 / 31
```

- El conteo se deriva de `parsed.rows`: recorre las filas y cuenta cuántas traen valor no vacío para cada `PricingField` presente.
- Es un **hecho**: se muestra el número sin etiquetas de "completo" / "incompleto".
- Se muestra el conteo en **todas** las columnas mapeadas, incluidas las 31/31, para verificar en pantalla si el total estorba o no.

### 4. Columnas ignoradas (nueva sección)

Listar los encabezados del archivo que **no** correspondan a ninguna de las 8 columnas canónicas. El parser ya lee todos los headers crudos; solo falta exponerlos en la salida.

- **Copy propuesto:**
  - Título: **"Columnas del archivo que no se usan"**
  - Descripción: **"Estos encabezados vinieron en el archivo pero no corresponden a campos que PGCI lee en este paso. No afectan la clasificación."**
  - Vacío: **"No hay columnas adicionales: el archivo trae solo columnas que PGCI reconoce."**
- **Nota técnica:** hoy `ParseResult` solo devuelve `rows` y `presentColumns`. Para mostrar las ignoradas sin duplicar lectura del archivo, se propone añadir `rawHeaders: string[]` al tipo de retorno — solo plomería, sin cambiar la lógica de parseo. La UI deriva las ignoradas filtrando por `matchCanonical`.

## Propuesta visual

### Layout de Card 2 (de arriba hacia abajo)

1. **3 métricas** en fila (`grid-cols-1 sm:grid-cols-3`), reutilizando el componente `ImportReportHeader`.
2. **Columnas mapeadas** — título de sección + grid de mini-cards.
3. **Columnas ignoradas** — título de sección + lista de chips neutrales.

### Columnas mapeadas: mini-cards compactas

En lugar de chips puros, se propone un **grid de mini-cards** (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` con `gap-3`) para que cada columna sea escaneable como un dato:

- Fondo `bg-white` con borde `border-border`.
- Esquinas redondeadas (`rounded-lg`).
- Padding reducido (`px-3 py-2`).
- Label en `suma-caption text-text-tertiary`.
- Conteo en `suma-body font-semibold tabular-nums text-text-primary`.
- El `"/total"` en `text-text-tertiary` para bajar su peso visual.
- **Acento para columnas parciales:** un sutil `border-l-4` en `border-accent` (azul institucional) o un fondo `bg-surface-sunken` cuando `N < total`. Esto es solo para ayudar a escanear rápido qué columnas traen datos y cuáles no; sin palabras ni iconos de valoración.

### Columnas ignoradas: lista discreta

Para diferenciar claramente "se usan" de "no se usan":

- Usar `Chip` con `variant="outline"` y `color="neutral"`.
- Los chips muestran el nombre original del encabezado del archivo.
- No se usan iconos de "error" ni "X"; se opta por un estilo neutro para evitar que suene a fallo.

## Archivos a tocar

1. `**src/lib/agreement-import/types.ts**` — añadir `rawHeaders: string[]` a `ParseResult`.
2. `**src/lib/agreement-import/parse.ts**` — devolver `rawHeaders` en las rutas `.xlsx`/`.xls` y `.csv`.
3. `**src/components/agreements/import-report/ImportReport.tsx**` — eliminar `ImportReportHeader` de Card 3.
4. `**src/components/agreements/import-report/ImportReportHeader.tsx**` — reutilizarlo en Card 2 (no cambia de nombre, solo de ubicación).
5. **Crear `src/components/agreements/import-report/ImportFileReading.tsx**` — nuevo componente que contiene métricas, columnas mapeadas y columnas ignoradas.
6. `**src/routes/_authenticated/pgci/agreements.$agreementId.import.tsx**` — renombrar Card 2, usar `ImportFileReading` en su contenido, mantener Card 3 sin cambios salvo quitar el prop `totalRows` que ya no necesita.

## Restricciones respetadas

- Nada se escribe en base de datos: la Card 2 sigue siendo solo previsualización.
- Conteo como hecho: solo números, sin juicios de valor.
- Copy neutro y voz español Colombia (tú).
- Design system Sumatec: tokens, fuentes, bordes redondeados y componentes existentes (`Card`, `Chip`, `ImportReportHeader`).
- No se modifica la lógica del diff engine ni el motor de clasificación; solo se consume lo que ya devuelven.

Plan aprobado con una precisión importante sobre las columnas ignoradas:

El ParseResult actual NO expone los headers que no mapearon — solo presentColumns 

(las que sí). Verificado en el código. El parser SÍ lee los headers crudos 

(readXlsx/readCsv los tienen) pero los descarta al retornar.

Para las "columnas ignoradas" necesitas un cambio mínimo en parse.ts: calcular los 

headers que no matchean ninguna de las 8 canónicas y exponerlos en ParseResult como 

un campo nuevo (ej. ignoredColumns: string[]). Es solo agregar un campo de salida — 

NO cambies la lógica de parseo existente, que está verificada. Solo reporta un dato 

que el parser ya conoce.

El conteo por columna (N/total) sí es 100% derivable de lo que ya devuelve el parser 

(recorrer ParsedRow, contar no-nulos por campo) — ahí no toques nada.

Todo lo demás de tu plan (mover indicadores, renombrar, tu propuesta visual de barras 

de progreso + destacar incompletas) aprobado. 

Confirma: al agregar ignoredColumns al parser, NO modificas parseSku, parseDate, 

parsePrice, ni la lectura de celdas — solo añades el cálculo de headers no mapeados y 

el campo de salida.