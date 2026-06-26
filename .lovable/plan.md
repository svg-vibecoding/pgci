## Plan

**Objetivo**: alinear el panel "Clientes asignados" con la columna Cliente del listado: para directos mostrar la holding padre como sub-texto; para holdings mostrar un chip "Holding"; para directos sin holding solo el nombre.

1. **Query de clientes en `users.new.tsx`**
   - Ampliar el select a `id, commercial_name, legal_name, type, status, parent_client_id, parent:parent_client_id(commercial_name, legal_name)` para traer el nombre de la holding padre en una sola consulta.

2. **Tipos en `UserForm.tsx`**
   - Extender el shape de `ClientOption` con `parent_client_id` y `parent` (nombre comercial/legal de la holding).

3. **Render del item en el panel**
   - Holding (`type === "holding"`): nombre + chip azul "Holding" a la derecha del nombre (mismo estilo que el listado de clientes).
   - Directo con `parent_client_id`: nombre arriba + nombre de la holding padre como sub-texto pequeño debajo.
   - Directo sin holding: solo el nombre, sin sub-texto ni chip.
   - Eliminar el texto "Directo" / "Holding" actual debajo del nombre.

4. **Sin tocar**
   - Lógica de selección, switches, chips de seleccionados, contador, filtros, búsqueda, scroll interno, ni el resto del formulario.