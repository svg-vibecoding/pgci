- Plan: switch "Ver cliente" para mostrar/ocultar la columna de cliente

### Alcance

Solo UI en `src/routes/_authenticated/pgci/agreements.$agreementId.lines.tsx`. Sin cambios en datos, backend, ni en `DataTable`.

### Cambios

1. **Estado local**
  - Añadir `const [showClientCol, setShowClientCol] = useState(true)` en el componente de la vista de posiciones.
  - Persistir opcionalmente en `localStorage` con clave `pgci.lines.showClientCol` para que la preferencia sobreviva a la navegación (misma vista, mismo usuario). Si prefieres sin persistencia, lo dejamos solo en memoria.
2. **Toolbar (fila del buscador, ~línea 737)**
  - A la derecha del input de búsqueda (antes del botón de códigos repetidos), añadir un bloque:
    - `<Switch>` de shadcn + `<Label>` con texto **"Ver cliente"**.
    - Tipografía tenue ya usada en la vista: `suma-body text-text-tertiary` (misma que usan los labels sutiles del toolbar y de las cards).
    - `aria-label="Mostrar columna de cliente"`, `htmlFor` enlazado al Switch.
  - Layout: `<div className="flex items-center gap-2 shrink-0">` para que no se rompa el wrap del toolbar en mobile.
3. **Columnas (línea ~999)**
  - La primera columna (selector de cliente) se construye condicionalmente:
  - `clientColumn` conserva su `width` actual.
  - `jaivanaColumn`: cuando `showClientCol` es `false`, no se toca su definición — al ser columna flexible (sin `width` fijo), `DataTable` reparte automáticamente el sobrante y Jaivaná toma el espacio libre. Si hoy Jaivaná tiene `width` fijo, en ese caso quitamos el width y le dejamos `flex: 1` para que absorba el ancho.
4. **Interacción**
  - Apagar el switch oculta la columna sin perder el cliente seleccionado internamente (el estado `only`/cliente activo sigue vivo; solo se oculta la UI).
  - Encender el switch la vuelve a mostrar con el mismo cliente que tenía.

### Verificación

- Con switch ON: columna cliente visible, ancho igual al actual.
- Con switch OFF: columna desaparece, Jaivaná ocupa el hueco, resto de columnas intactas.
- Búsqueda, selección de filas, menú de acciones y modales siguen funcionando igual.

### Fuera de alcance

- No se cambia la lógica del selector de cliente ni cómo se guardan códigos.
- No se toca `DataTable`, ni otros componentes, ni SQL.
- No se agrega el switch a otras vistas.

### Preguntas rápidas

1. ¿Persistimos la preferencia en `localStorage` (recomendado) o solo en memoria de la vista?
2. Default al entrar: ¿**ON** (como hoy) u **OFF** (más limpio si mayormente no se usa)?

Apruebo el plan. Respondo a tus preguntas. 1. Si, tu recomendación está bien. 2. Default Off. 