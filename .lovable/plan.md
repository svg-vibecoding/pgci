## Sí, es totalmente viable

`DataTableColumn.header` ya acepta `ReactNode`, así que podemos poner el `Select` directamente adentro del `<th>` de la columna Cliente sin tocar el componente base de tabla.

## Qué cambia visualmente

- La columna "Cliente" deja de tener un label estático. En su lugar, el header muestra el **nombre del cliente seleccionado** en un negro más marcado (`text-text-primary`, misma tipografía `suma-body` que ya usan los demás headers, sin uppercase) y a la derecha un chevron.
- Al hacer clic en el header se abre el mismo listado de clientes visibles del acuerdo. Cambiar de opción actualiza la proyección de la tabla igual que hoy.
- El `Select` que hoy está sobre la barra de filtros (a la izquierda del buscador) desaparece: queda solo el buscador ocupando todo el ancho, más limpio.

```text
Antes                                             Después
[ CORONA ▾ ] [ 🔍 Buscar SKU…              ] 🗇     [ 🔍 Buscar SKU…                       ] 🗇
────────────────────────────────────────────      ────────────────────────────────────────────
Cliente        Jaivaná    Marca   Precio  …       CORONA ▾      Jaivaná    Marca   Precio  …
```

## Comportamiento

- Si el acuerdo tiene **más de un cliente visible**: el header es interactivo (trigger del select), muestra el nombre del cliente activo + chevron.
- Si sólo hay **un cliente visible**: el header muestra su nombre en texto plano, sin chevron ni interacción (evita el disclosure inútil).
- El menú se abre en un popover (portal de shadcn), así que el header sticky de la tabla no lo recorta.
- Al cambiar de cliente se sigue reseteando la selección de filas y recalculando la proyección — mismo `onValueChange` que ya existe.

## Detalles técnicos

- Archivo: `src/routes/_authenticated/pgci/agreements.$agreementId.lines.tsx`.
- Extraer un pequeño componente local `ClientColumnHeader` que reciba `visibleClients`, `projectionClientId`, `setProjectionClientId` y renderice:
  - `Select` de shadcn con `SelectTrigger` custom (sin borde ni fondo, sólo texto + chevron) para que se integre visualmente al header.
  - Nombre en `suma-body text-text-primary font-medium`, chevron `ChevronDown` de lucide en `text-text-tertiary`.
- Reemplazar `header: "Cliente"` de la columna `client` por `header: <ClientColumnHeader … />`.
- Eliminar el bloque `visibleClients.length > 1 && <Select …>` de la barra de filtros (líneas ~738–754). El buscador queda como único hijo flex de esa fila.
- Accesibilidad: `aria-label="Cambiar cliente"` en el trigger, chevron con `aria-hidden`.
- Nada cambia en `DataTable`, tipos, ni en el resto de vistas.

## Fuera de alcance

- No se modifica lógica de datos, permisos ni queries.
- No se cambian las otras columnas ni el resto de la barra de filtros (chip de filtros activos permanece).
