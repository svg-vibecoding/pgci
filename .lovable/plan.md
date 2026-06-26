Plan de cambios para `src/routes/_authenticated/setup/users.$userId.client-access.tsx` (único archivo a modificar).

### Ajuste 1 — Texto explicativo

Agregar un párrafo debajo del subtítulo `Configura qué clientes puede ver y en cuáles puede crear acuerdos.`:

> "Asigna para este usaurio los clientes que podrá ver en la plataforma. Si además puede crear acuerdos para esos clientes, activa también el permiso de creación"

Estilo: `text-sm text-muted-foreground`, con un pequeño margen que lo separe del párrafo anterior.

### Ajuste 2 — Layout del footer sticky

- Reemplazar el footer `fixed inset-x-0 bottom-0` por un bloque posicionado dentro del flujo del área de contenido principal.
- Debe respetar el ancho y la posición del contenido de `/setup`, sin cubrir el menú lateral.
- El panel expandido de chips debe quedar dentro de esa misma área de contenido, no ocupar todo el viewport.

### Ajuste 3 — Switch general reemplazado por dos switches

En la misma fila del buscador, a la derecha, dos switches con labels dinámicos:

**Switch 1 — Asignar**

- Label: `Asignar todos` (sin búsqueda) / `Asignar visibles` (con búsqueda).
- `on` solo si todos los clientes visibles (`filteredClients`) están asignados.
- Al encender: `assigned: true` en visibles (preserva `can_create` de los ya asignados).
- Al apagar: `assigned: false` y `can_create: false` en visibles.

**Switch 2 — Crear acuerdos**

- Solo habilitado cuando al menos un cliente visible está asignado.
- Label: `Crear acuerdos a todos` (sin búsqueda) / `Crear acuerdos a visibles` (con búsqueda).
- `on` solo si todos los clientes visibles asignados tienen `can_create: true`.
- Al encender: `can_create: true` en visibles asignados.
- Al apagar: `can_create: false` en visibles asignados.
- Cuando está deshabilitado, se muestra con opacidad reducida.

### Ajuste 4 — Labels por fila

Cambiar los labels de los switches en cada fila de cliente:

- `ASIGNADO` → `Asignar`
- `CREA ACUERDOS` → `Crear acuerdos`

Estilo: `text-xs text-muted-foreground font-normal` (no mayúsculas, no negrilla).

### Ajuste 5 — Contador superior y contador del footer unificados

Ambos contadores usarán el mismo formato calculado desde el `stateMap` local:

- `X` = clientes asignados (`assigned: true`).
- `N` = total de clientes disponibles (`totalClients`).
- `Y` = clientes con permiso de creación (`can_create: true`).

Formato:

- `X de N clientes asignados · Y con permiso de creación` (cuando Y > 0).
- `X de N clientes asignados · Sin permiso de creación` (cuando Y = 0).

El contador superior se ubicará bajo el texto explicativo. El contador del footer reemplaza el resumen actual y mantiene el botón `Ver detalle` / `Ocultar` junto a él.

### Lo que NO se toca

- Lógica de guardado (diff + operaciones en Supabase).
- Switches por fila (solo cambian labels).
- Breadcrumb, header con nombre y chip de rol del usuario.
- Chips del panel expandido en el footer.
- Buscador y contador de resultados filtrados.
- Ningún otro archivo del proyecto.