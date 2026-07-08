## Ajuste

En la vista de posiciones del acuerdo (`src/routes/_authenticated/pgci/agreements.$agreementId.lines.tsx`), la línea 2 del encabezado actualmente muestra:

```
Posiciones · {clientName}
```

donde `clientName` se resuelve a partir del agrupador/cliente del acuerdo, y si no hay dato cae en `"—"`.

## Cambio a realizar

Reemplazar ese texto dinámico por el texto fijo:

```
Posiciones en el acuerdo
```

Sin dato de cliente, sin separador `·`, sin guión.

## Alcance y restricciones

- Solo se modifica el subtítulo del encabezado de la vista de posiciones.
- La variable `clientName` se conserva porque todavía se pasa a `<LineEditDialog />` para su propio encabezado interno; no se altera ese diálogo.
- El resto de la vista (cards de resumen, tabla, acciones) queda sin cambios.

## Verificación

- Revisar visualmente que el encabezado muestre exactamente "Posiciones en el acuerdo".
- Confirmar que no queda referencia al guión ni al nombre de cliente en esa línea.