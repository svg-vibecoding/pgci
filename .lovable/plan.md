## Diagnóstico

El archivo del piloto guarda `Fecha inicio` y `Fecha fin` como `datetime` con formato de celda `mm-dd-yy`. En `src/lib/agreement-import/parse.ts`, `readXlsx` usa `raw: false`, así que SheetJS entrega la fecha ya formateada como string `"06-24-24"`. `parseDate` sólo acepta ISO `YYYY-MM-DD` o `D/M/YYYY|D-M-YYYY` con año de 4 dígitos → todas las fechas del archivo caen en **"Fecha no reconocida"** y las 30 filas terminan en *No procesables*.

Los precios (`Precio de venta`, `Precio par`) llegan como número nativo (SheetJS con `raw:false` sobre celdas numéricas devuelve el string formateado `"$ 74,127.91"`, y `parsePrice` lo procesa bien). Si tras corregir las fechas siguen apareciendo filas por "Precio par", será por un valor puntual — lo verifico al final.

## Fix propuesto (mínimo)

Aplicar en `readXlsx` de `src/lib/agreement-import/parse.ts` la misma técnica que ya usamos para la columna SKU, pero para las columnas de fecha (`start_date`, `end_date`):

1. Detectar las columnas cuyo header canónico sea `start_date` o `end_date`.
2. Para cada fila no vacía, sobrescribir el valor de esas columnas con `cell.v` crudo (que, gracias a `cellDates:true`, viene como `Date` nativo) en lugar del string formateado que dejó `raw:false`.
3. `parseDate` ya sabe manejar `Date` (extrae `getUTCFullYear/Month/Date` sin corrimiento de huso), así que no hay que tocar `cells.ts`.

Resultado: fechas con formato `mm-dd-yy`, `dd/mm/yyyy`, `yyyy-mm-dd` u otros formatos de Excel se resuelven todas por la vía del `Date` nativo y dejan de fallar por el string cortado a dos dígitos de año.

## Sin cambios en

- `cells.ts` (`parseDate` ya cubre `Date`).
- `diff.ts`, motor de clasificación, vista `/import`.
- Plantilla ni encabezados.

## Verificación

1. Re-subir el mismo `plantilla_acuerdo_Carga_piloto_1.xlsx`.
2. Confirmar en el reporte que las 30 filas dejan de estar en *No procesables* por fechas.
3. Si aparecen residuales por "Precio par", inspeccionar celda concreta (probable valor atípico) y decidir si amerita otro fix — fuera de este plan.
4. Al validar, retirar los `console.log` temporales que quedan en `onFile` de `agreements.$agreementId.import.tsx`.