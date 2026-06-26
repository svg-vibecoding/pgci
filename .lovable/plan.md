Plan de cambios para `src/routes/_authenticated/setup/users.$userId.client-access.tsx` (único archivo a modificar).

### Mejora 1 — Switch general "Todos"

- Entre el buscador y la lista, agregar una fila con un label + switch alineado a la derecha del buscador.
- Label: "Todos" cuando `search` está vacío; "Seleccionar visibles" cuando hay búsqueda activa.
- Estado del switch: `on` solo si todos los clientes visibles (`filteredClients`) están asignados. Si la lista filtrada está vacía, el switch se deshabilita.
- Al encender: para cada cliente visible, asignar `assigned: true` (preservar `can_create` de los que ya estaban asignados).
- Al apagar: para cada cliente visible, asignar `assigned: false` y `can_create: false`.

### Mejora 2 — Resumen en el footer sticky

- Encima de los botones "Cancelar" / "Guardar cambios", agregar una línea de resumen con el texto:
  - "X clientes asignados · Y con permiso de creación" (X > 0, Y > 0).
  - "X clientes asignados · Sin permiso de creación" (X > 0, Y = 0).
  - "Sin clientes asignados" (X = 0), en `text-muted-foreground`.
- Al lado del texto, botón tipo link "Ver detalle" / "Ocultar" que expande un panel de chips dentro del footer.
- Cada chip muestra el nombre del cliente y un indicador visual si `can_create` es `true` (puede ser un punto de color o un icono pequeño).
- El panel de chips tendrá `max-height` con scroll interno (p.ej. `max-h-48 overflow-y-auto`).
- El resumen se recalcula en tiempo real a partir del `stateMap` actual.

### Mejora 3 — Contador de resultados bajo el buscador

- Cuando `search` tenga texto, mostrar debajo del input (o junto a él) el texto: "X de N clientes", donde X es `filteredClients.length` y N es `totalClients`.
- Cuando el buscador está vacío, no se muestra el contador.

### Lo que NO se toca

- Lógica de guardado (diff + operaciones en Supabase).
- Switches por fila (Asignado / Crea acuerdos).
- Header, breadcrumb y contador "X de N clientes asignados".
- Footer sticky existente: solo se enriquece con el resumen.
- Ningún otro archivo del proyecto.