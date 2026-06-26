## Diagnóstico

En `/setup/users/new` se ven dos barras de scroll verticales al borde derecho:

1. La barra **interna** del `<main>` del layout (`src/routes/_authenticated/setup/route.tsx`), declarada con `h-screen overflow-y-auto`. Esta es la correcta y la queremos conservar.
2. Una barra **externa** del documento (html/body). Aparece porque el contenedor raíz del layout es `<div class="flex h-screen …">` sin `overflow-hidden`. Si cualquier hijo del flex (por ejemplo, el `<main>` con su contenido o el `<aside>` con su `h-screen`) genera incluso 1px de desbordamiento, el body lo propaga y el navegador pinta su propio scrollbar encima. En algunos navegadores aparece además como gutter reservado aunque no esté activo.

No hay reglas globales en `src/styles.css` que fijen `overflow` en `html` o `body`, así que el body queda con el comportamiento por defecto (scroll si el contenido lo excede).

El panel "Clientes asignados" y su `max-h-72 overflow-y-auto` NO son la causa y se conservan.

## Solución

Contener el scroll dentro del layout de Setup para que el body nunca tenga que scrollear. Una sola barra: la del `<main>`.

## Cambios

Archivo único: `src/routes/_authenticated/setup/route.tsx`

- En el contenedor raíz del layout cambiar:
  - `className="flex h-screen bg-[var(--surface-page)]"`
  - por: `className="flex h-screen overflow-hidden bg-[var(--surface-page)]"`
- En el `<aside>` quitar el `sticky top-0` redundante (ya está dentro de un flex `h-screen`, el sticky no aporta y puede contribuir a recalcular alturas raras). Mantener `flex h-screen w-[264px] flex-shrink-0 flex-col …`.
- El `<main className="h-screen flex-1 overflow-y-auto">` se mantiene exactamente igual: sigue siendo la única superficie scrollable.

No se tocan:
- `src/styles.css` (sin reglas nuevas sobre html/body).
- `src/routes/__root.tsx`.
- `UserForm.tsx` ni el scroll interno del panel "Clientes asignados".
- Estructura funcional del formulario ni de ninguna otra vista.

## Verificación

- Abrir `/setup/users/new` y otras rutas de Setup: debe verse una sola barra de scroll al borde derecho (la del área principal).
- El sidebar permanece fijo, sin scroll propio.
- El panel "Clientes asignados" conserva su scroll interno cuando la lista excede 18rem.