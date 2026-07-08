## Plan

### Cambios en `src/routes/_authenticated/pgci/agreements.$agreementId.lines.tsx`

1. **Botón del modal "Códigos en múltiples posiciones"**
   - Reemplazar el icono `Wand2` por `Layers` en el botón que abre el modal (línea ~507).
   - El import de `Layers` ya existe en el archivo; el import de `Wand2` quedará sin uso y se puede eliminar.

2. **Columna Jaivaná en la tabla**
   - Para las filas con estado `repeated` (códigos no vinculados), reemplazar el icono `Layers` por `Unlink` (línea ~700).
   - El tooltip y el resto del comportamiento se conservan igual.
   - El import de `Unlink` ya existe en el archivo.

### Notas
- No se toca la lógica de negocio ni el comportamiento de los tooltips.
- No se requieren nuevas dependencias.
- Se actualizará el import de `lucide-react` para eliminar `Wand2` si queda sin referencias.