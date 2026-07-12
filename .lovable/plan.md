# Quitar scroll interno de la lista de clientes

Archivo: `src/routes/_authenticated/setup/users.$userId.client-access.tsx`, línea 606.

## Elemento y clases a modificar

Es el `<div>` que envuelve el header sticky "Cliente / Asignar" y la `<ul>` de clientes:

```tsx
<div className="max-h-[calc(100vh-360px)] min-h-[280px] overflow-y-auto">
```

## Cambio

Quitar `max-h-[calc(100vh-360px)]`, `min-h-[280px]` y `overflow-y-auto`. El `<div>` queda sin clases (o simplemente eliminamos el wrapper si no aporta nada más). Resultado:

```tsx
<div>
```

Con esto:
- La lista fluye a su altura natural dentro del `<Card>`.
- El header "Cliente / Asignar" pierde el `sticky top-0` efectivo dentro del contenedor scrolleable, pero como ya no hay scroll interno eso es lo esperado; el header queda como encabezado normal de la sección.
- El único scroll pasa a ser el de la ventana del navegador.
- La paginación de 20 por página (footer ya implementado bajo la `<ul>`) sigue evitando listas gigantes.

## Lo que NO se toca

- Paginación (`pagedClients`, `PaginationFooter`).
- Indentación de switches de permisos avanzados.
- Contadores, toggles masivos, lógica de guardado, queries.
- El `<Card>` exterior ni el footer sticky de "Guardar cambios" (ese sí debe seguir pegado al fondo del viewport).
