## Diagnóstico

En el piloto, 22 celdas de `Precio par` son el número `0` con formato contable de Excel (`_-"$"* #,##0.00_-;...;_-"$"* "-"??_-;...`). La 3ª sección de ese formato pinta el cero como `"-"`. Con `raw:false`, SheetJS entrega el string formateado (≈ `" $   -   "`). `parsePrice` hace strip a `[0-9.,]`, obtiene cadena vacía y devuelve `ok:false` → "Precio par: precio no reconocido" → 22 filas al grupo *No procesables*.

El 0 real existe en la celda; sólo lo esconde el formato de presentación.

## Fix (camino a — lectura cruda + normalización 0 → null)

Contrato de negocio (spec §8): precio en `0` = "sin ese precio" (null), NO error. Aplica a `sale_price` y `par_price`.

### 1. `src/lib/agreement-import/parse.ts` — `readXlsx`

Extender el mecanismo de lectura cruda que ya existe para `sku`/`start_date`/`end_date` para incluir `sale_price` y `par_price`. En `rawColumns`, agregar esos dos campos. Para ellos, asignar `cell.v` tal cual (número nativo o string, según venga) en lugar del string formateado por `raw:false`.

Esto elimina la dependencia del formato de celda: un 0 llega como número `0`, no como `"-"`.

### 2. `src/lib/agreement-import/cells.ts` — `parsePrice`

Añadir una regla al inicio: si `value` es `number` finito igual a `0`, devolver `{ value: null, ok: true }`. Esto normaliza el cero legítimo a "sin precio" sin marcarlo como error.

Nota: strings que representan cero (`"0"`, `"0,00"`, `"0.00"`, `"$ 0"`) también deben terminar en null. Se agrega un chequeo post-parseo: si tras normalizar `n === 0`, devolver `{ value: null, ok: true }`.

No se toca la rama `ok:false` de strings ilegibles (letras, símbolos raros con dígitos inconsistentes): un valor realmente ilegible sigue siendo error.

### 3. `parseRow`

No cambia. Ya trata `value === null` con `ok:true` como "campo vacío". Con `parsePrice` devolviendo `{value:null, ok:true}` para ceros, la fila conserva sus otros campos y NO va a *No procesables* por esta razón.

## Sin cambios en

- `diff.ts`, motor de clasificación.
- Vista `/import` y `describeRowReason`.
- Plantilla, encabezados, tipos públicos.

## Verificación

1. Re-subir `plantilla_acuerdo_Carga_piloto_1.xlsx`.
2. Confirmar en el reporte que ninguna fila cae en *No procesables* por "Precio par: precio no reconocido".
3. Las 22 filas con par en 0 deben quedar con `par_price: null` y clasificarse por sus demás campos (SKU, sale_price, fechas).
4. Verificar que `sale_price = 0` (si aparece en otro archivo) también se normaliza a null sin error.
5. Retirar los `console.log` temporales de `onFile` en `agreements.$agreementId.import.tsx`.

[CONSTRUCCIÓN]

Ajuste al fix de Precio par. Diagnóstico tuyo correcto (formato contable pinta 

el 0 como "-", raw:false entrega el guion, parsePrice lo marca ilegible). 

PERO corrige el enfoque: NO colapses 0 y vacío. Son distintos para el usuario 

—"precio $0" no es lo mismo que "sin precio"— y el sistema debe preservar esa 

distinción, aunque para escribir ambos acaben en null en un paso posterior.

FIX CORRECTO:

1. readXlsx (parse.ts): SÍ extiende la lectura cruda (.v) a sale_price y 

   par_price, igual que hiciste con sku/fechas. Esto hace que el 0 escondido 

   tras el formato contable llegue como el número 0 limpio, no como "-".

   → Este paso resuelve el bug: el 0 deja de ser ilegible.

2. parsePrice (cells.ts): NO agregues la regla "0 → null". Déjala como está:

   - número 0 finito → { value: 0, ok: true }  (preserva el 0, NO error)

   - vacío/null → { value: null, ok: true }     (preserva el vacío)

   - string ilegible → { value: null, ok: false }

   El 0 se preserva como 0. El vacío como null. NO se colapsan.

3. parseRow: sin cambios.

RESULTADO ESPERADO:

- Las 22 filas con par en 0 → par_price = 0 (no null, no error), salen de 

  No procesables, se clasifican por lo demás.

- Una fila con par vacío → par_price = null.

- Ambas son válidas; la diferencia 0 vs vacío se conserva en los datos.

La normalización 0→null para escritura se queda en el Paso 4 (confirmación), 

NO en el parser. El reporte podrá distinguir "precio $0" de "sin precio".

Verifica: re-sube el piloto, confirma que las 22 salen de No procesables con 

par_price = 0 (no null). Retira los console.log temporales.