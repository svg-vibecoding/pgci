
## Diagnóstico

Hoy `Cliente` y `Jaivaná` son columnas flexibles sin ancho declarado, y la tabla está en modo `table-auto`. El navegador reparte el sobrante según el contenido mínimo de cada celda: Jaivaná trae descripciones más largas que Cliente, así que se lleva más ancho. `Marca` sí tiene ancho fijo (140) y no absorbe sobrante, por eso queda "aire" entre `Marca` y `Precio` (que solo aparece cuando Cliente/Jaivaná son cortos y no consumen el resto).

## Propuesta (una sola opción, ancla del sistema)

Regla nueva del DataTable: **las columnas flexibles se reparten el ancho sobrante en partes iguales, independientes del contenido.**

### Cambios al sistema (`DataTable.tsx` + `types.ts`)

- Nueva prop de columna `flex?: number` (default `1` cuando `width` no está definido). Es la fracción de ancho sobrante que le toca a esa columna, tipo `flex-grow` de CSS.
- Implementación: si hay columnas sin `width`, la tabla pasa a `table-fixed` internamente y a cada columna flex se le asigna `width: (flex_i / sum_flex) * 100%` sobre el sobrante después de restar los `width` fijos. Esto reparte de forma exacta, sin depender del contenido.
- `table-fixed` respeta esos porcentajes; el wrapping ya existente (line-clamp 2 + break-words) sigue absorbiendo textos largos sin romper el layout.
- Nada cambia para columnas con `width` explícito.

### Aplicación en Posiciones

- `Cliente` y `Jaivaná` quedan ambas sin `width` y con `flex: 1` (implícito). Resultado: mitad y mitad del sobrante, siempre. El "aire" entre Marca y Precio desaparece porque el 100% del ancho se distribuye.
- El resto (`Marca 140`, `Precio 110`, `Vigencia 120`, `Estado 130`, `Acciones 48`, selección `40`) queda igual.

### Aplicación en Productos

- `Producto` (única flexible) sigue tomando todo el sobrante — comportamiento idéntico al actual, no rompe nada.

## Efectos colaterales

- Con `table-fixed`, columnas de texto podrían mostrar 3ª línea en filas con descripciones muy largas. Ya está limitado a 2 líneas por `line-clamp-2` en `IdentityCell`; el resto de columnas de texto simple (Marca) casi nunca supera una línea.
- Si en el futuro alguien quiere una tabla donde la flex derecha sea "más ancha" (ej. flex 2 vs 1), la prop `flex` ya lo permite sin refactor.

## Archivos

- `src/components/sumatec/DataTable/types.ts` — añadir `flex?: number`.
- `src/components/sumatec/DataTable/DataTable.tsx` — calcular anchos porcentuales para columnas flex y forzar `table-fixed` cuando haya al menos una flex.
- `src/routes/_authenticated/pgci/agreements.$agreementId.lines.tsx` — sin cambios (Cliente y Jaivaná ya están sin `width`).
- `src/routes/_authenticated/setup/products.index.tsx` — sin cambios.

Sin cambios de comportamiento, RLS, filtros ni datos.
