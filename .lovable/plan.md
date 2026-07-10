## Diagnóstico confirmado

El bug no es del orden de efectos entre padre e hijo, sino de **cuándo** se puebla `codeEntries` en el padre:

- `LineEditDialog` mantiene `codeEntries` como `useState` y lo hidrata dentro de un `useEffect` con deps `[open, initial?.line_id, ...]` (línea 1129).
- Al cambiar de posición vía "Editar esta posición", `initialLineId` cambia. React renderiza el árbol con el **nuevo** `initialLineId` pero `codeEntries` todavía vacío (el efecto del padre aún no corrió). `ClientCodeCard` recibe un `entry` vacío.
- En la fase de commit, los efectos pasivos corren **bottom-up**: primero el de `ClientCodeCard` (que ya se disparó porque `initialLineId` cambió) → lee `entry` vacío → `mode="search"`. Luego corre el efecto del padre → `setCodeEntries` con los códigos reales → re-render, pero el efecto del hijo no vuelve a correr (sus deps no cambiaron) y queda en `search`.

Cambiar deps del hijo no arregla nada: aunque agregáramos `entry.code`, dispararía resets en cada edición del usuario dentro del propio card. El problema es que el padre entrega datos tarde.

## Solución

Hidratar `codeEntries` **durante el render** en el padre, no en un efecto. Cuando el hijo se monta/renderiza con el nuevo `initialLineId`, ya recibe el `entry` correcto. Con eso, el `useState` de `mode` en `ClientCodeCard` puede inicializarse directamente desde `entry` y la sincronización por cambio de posición se hace con el mismo patrón "reset en render por cambio de key" (React docs: [Storing information from previous renders](https://react.dev/reference/react/useState#storing-information-from-previous-renders)).

### Cambios en `LineEditDialog.tsx`

1. **Padre — hidratación síncrona de `codeEntries`** (reemplaza la parte del `useEffect` de la línea 1129 que hace `setCodeEntries`):
   - Agregar un ref `hydratedForRef = useRef<string | null | undefined>(undefined)` que guarda para qué `initial?.line_id` (o `null` en modo crear) ya se hidrató.
   - Durante render, si `open && hydratedForRef.current !== (initial?.line_id ?? null)`:
     - Construir el `Map` desde `initial?.client_codes ?? []`.
     - Llamar `setCodeEntries(m)` y actualizar el ref. React reinicia el render antes de commitear; los hijos ven el map poblado en su primer render con el nuevo `initialLineId`.
   - Cuando `open` pasa a `false`, resetear el ref para que la próxima apertura vuelva a hidratar.
   - El resto del `useEffect` actual (setV, setProductMeta, lookup, conflict, searchOpen, etc.) se queda como está — esos estados no alimentan a `ClientCodeCard`.

2. **Hijo — `ClientCodeCard`**: eliminar la dependencia del efecto de datos que llegan tarde.
   - `useState` de `mode`, `originalDescription`, `isNew` se inicializan desde `entry` (ya lo hacen). Con el fix del padre, el primer render ya trae `entry` correcto.
   - Reemplazar el `useEffect` de resync `[open, initialLineId]` (líneas 333-344) por el mismo patrón "reset en render por cambio de key":
     - `prevKeyRef = useRef<string | null>(null)` con la clave `open ? (initialLineId ?? "__new__") : null`.
     - Durante render, si la clave cambió: `setMode(has ? "edit" : "search")`, `setOriginalDescription(...)`, `setIsNew(false)`, `setQuery("")`, `setResults([])`, `setExpandedId(null)`, `setPopoverOpen(false)`, `setTakenBlock(null)` y actualizar el ref.
   - Con esto, los tres modos se preservan:
     - **search**: `entry.code` vacío al abrir → arranca en search. Elecciones del usuario (`setMode("creating")`, `setMode("edit")` desde selección) siguen intactas porque no dependen del efecto.
     - **creating**: sigue siendo decisión del usuario (línea 417). El reset solo corre cuando cambia la posición, no en re-renders normales.
     - **edit**: `entry.code` no vacío en el primer render (gracias al fix del padre) → arranca en edit. Selección desde buscador (línea 388) sigue igual.
   - `takenBlock` sigue siendo decisión de la tarjeta (colisión detectada tras seleccionar/crear); se limpia al cambiar de posición, que es lo correcto.

### Notas técnicas

- El patrón `setState` durante render solo dispara re-render si el valor cambia; combinado con el ref, se ejecuta una única vez por transición de key. No causa loops.
- No se toca `LineEditValues`, `buildClientCodes`, RPC, ni la estructura visual.
- No se toca el flujo de "En posición excluida".

### Verificación

- Playwright: abrir modal con posición A que tiene códigos, verificar tarjetas pobladas en modo `edit`; disparar "Editar esta posición" desde alerta de código ya asignado; confirmar que las tarjetas de la nueva posición muestran sus códigos en `edit`, no vacías en `search`.
- Regresión: crear nueva línea (arranca en `search`), elegir "Crear producto" en una tarjeta (pasa a `creating`), seleccionar código del buscador (pasa a `edit`), abrir alerta de taken y elegir "Elegir otro código" (vuelve a `search` limpio).
- `bunx tsgo --noEmit`.
