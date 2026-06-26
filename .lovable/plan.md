Unificar la tipografía de los títulos en los cards indicadores del detalle de Usuarios (`/setup/users/$userId`) para que coincida con el estilo usado en los detalles de Clientes y Productos.

Cambio concreto en `src/routes/_authenticated/setup/users.$userId.index.tsx`:
- Reemplazar `<p className="suma-overline text-[10px]">{label}</p>` dentro del componente `IndicatorCard` por `<p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>`, alineado con el patrón de los cards de resumen en el detalle de Clientes.

Esto afecta únicamente las etiquetas CLIENTES, ACUERDOS, ALCANCES EN PGCI y VISIBILIDAD. No se modifica funcionalidad, datos, layout ni otros estilos de los cards.