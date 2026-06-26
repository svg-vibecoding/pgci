Ajustes a src/routes/_authenticated/setup/users.index.tsx — plan de cambios

Cambio 1 — Columnas de la tabla
- Reemplazar headers actuales por: Usuario, Código, Cartera, Crea acuerdos, Estado, Acciones.
- Celda Usuario: full_name como texto principal + email debajo como text-muted-foreground text-xs. Al lado del nombre mostrar chip "Super admin" cuando role === "super_admin".
- Nueva columna "Código": mostrar erp_user_code o —. Header "Código".
- Nueva columna "Cartera": para platform_user mostrar N clientes (usando client_count); para super_admin mostrar —.
- Nueva columna "Crea acuerdos": para platform_user con create_count > 0 mostrar X de N; para platform_user con create_count === 0 y client_count > 0 mostrar —; para super_admin mostrar —.
- Reducir columnas de capacidades existentes a esta estructura.

Cambio 2 — Chip de alerta en columna Usuario
- Reemplazar el icono suelto de alerta por un chip compacto junto al nombre.
- Chip visible solo cuando getUserIssues(u).length > 0.
- Estilo: bg-amber-50, border border-amber-200, AlertTriangle h-3 w-3 text-amber-500, texto "Alerta" text-xs text-amber-700 font-medium.
- Mismo tooltip con el texto de las alertas (using ToolTipWrapper o title).
- Posición: junto al nombre, después del chip "Super admin" si aplica.

Cambio 3 — Acciones
- Dejar solo Ver y Editar.
- Eliminar el botón "Inactivar" de la columna Acciones y remover su estado confirmUser / AlertDialog asociado del listado.
- No tocar la lógica de activar/inactivar en las vistas de detalle ni edición de usuario.

Lo que no se toca
- Cards superiores, buscador, filtro de rol, queries, UserRow, getUserIssues, botón Crear usuario y ningún otro archivo.