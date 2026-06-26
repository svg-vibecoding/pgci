## Objetivo

Unificar la experiencia visual de las vistas de creación (`/setup/clients/new` y `/setup/users/new`) bajo un mismo patrón de página, para que se sientan parte del mismo sistema. Solo cambios de UI/composición — no se toca lógica, validaciones, schema ni server functions.

## Inconsistencias detectadas hoy

| Aspecto | Clientes (new) | Usuarios (new) |
|---|---|---|
| Botón "← Volver" | Solo aparece si vienes desde un holding | Siempre visible, pero con tamaño/espaciado distinto |
| Ancho del formulario | `max-w-2xl` (angosto, inputs ~640px) | Sin límite (inputs llenan todo el `main`) |
| Layout de campos | `space-y-5` + algunos grids 2 col | `grid md:grid-cols-2` siempre |
| Acciones (Guardar/Cancelar) | Alineadas a la izquierda, primario primero | Alineadas a la derecha, "Cancelar" como `ghost` primero |
| Label del submit | "Guardar" | "Crear usuario" |
| Tono del botón "Volver" | `-ml-2 h-8 px-2 text-muted-foreground` | `size="sm"` default |
| Estructura del header | Igual (h1 + p) pero sin contenedor compartido | Igual pero sin contenedor compartido |

Resultado: dos vistas que cumplen lo mismo se ven y se comportan distinto.

## Propuesta de patrón "Vista de creación"

Un único shell para todas las páginas de creación bajo `/setup`:

```text
┌─────────────────────────────────────────────┐
│  ← Volver a {sección}        (siempre)      │
│                                             │
│  Crear {entidad}                            │
│  Texto descriptivo corto.                   │
│  ───────────────────────────────────────    │
│                                             │
│   [ Formulario, max-w-2xl, space-y-5 ]      │
│                                             │
│   ┌──────────────────────────────────┐      │
│   │ Footer acciones                  │      │
│   │              [Cancelar] [Crear X]│      │
│   └──────────────────────────────────┘      │
└─────────────────────────────────────────────┘
```

Reglas del patrón:

1. **Back link siempre visible** arriba del header, mismo tamaño y color en ambas vistas (ghost sm, `-ml-2 text-muted-foreground`). En clientes, cuando viene `?parent=`, el texto cambia a "Volver al holding" pero el componente es idéntico.
2. **Header unificado**: `h1` 2xl bold + `p` muted-foreground, sin contenedor adicional.
3. **Ancho del formulario consistente**: `max-w-2xl` para ambos. Esto encoge el formulario de usuario para que los inputs no se vean enormes y queden del mismo tamaño que en clientes. Excepción: la sección "Clientes asignados" del UserForm puede ocupar el mismo `max-w-2xl` (sigue siendo legible y mantiene la coherencia).
4. **Layout interno del formulario**: grids de 2 columnas para campos cortos relacionados (nombre/email, tipo/estado, tax_id_type/tax_id, etc.), campos largos a 1 columna. Ambos formularios ya lo hacen parcialmente — solo se ajusta UserForm para no forzar 2 col en bloques que se ven mejor full-width dentro de `max-w-2xl`.
5. **Footer de acciones unificado**: alineado a la **derecha**, orden `[Cancelar ghost] [Primario]`, separador superior sutil (`border-t pt-4`). Etiqueta del primario consistente: "Crear cliente" / "Crear usuario" (verbo + entidad, no "Guardar").
6. **Tamaño de inputs**: ambos ya usan el shadcn `Input` por defecto (h-10). Lo que hoy se percibe distinto es el **ancho contenedor**, no la altura. Se resuelve con la regla 3.

## Plan de implementación

Solo presentación, sin tocar lógica:

1. **Crear `src/components/setup/CreateViewShell.tsx`** — componente de layout que recibe `backTo`, `backLabel`, `title`, `description`, `children`. Encapsula el botón Volver + header + contenedor `max-w-2xl`. Reutilizable para futuras vistas de creación.
2. **Refactor `src/routes/_authenticated/setup/clients.new.tsx`** para usar `CreateViewShell`. Back link siempre visible (a `/setup/clients` o al holding si hay `parent`).
3. **Refactor `src/routes/_authenticated/setup/users.new.tsx`** para usar `CreateViewShell`. Mantiene el `Dialog` de credenciales tal cual.
4. **Ajustar `src/components/setup/ClientForm.tsx`**:
   - Mantener `max-w-2xl` (o moverlo al shell y quitarlo aquí — opción b: el shell lo provee y los forms ya no se preocupan por ancho).
   - Footer: cambiar a alineación derecha, orden `[Cancelar ghost] [Crear]`, separador `border-t pt-4`.
   - Cambiar label submit por prop `submitLabel` (default "Guardar") y pasar "Crear cliente" desde la vista new.
5. **Ajustar `src/components/setup/UserForm.tsx`**:
   - Quitar `max-w-` propios — el shell controla el ancho.
   - Mantener el footer ya alineado a la derecha; solo agregar `border-t pt-4` para igualar a ClientForm.
   - Asegurar que el grid `md:grid-cols-2` se mantiene legible dentro de `max-w-2xl` (lo es: ~320px por columna).

## Fuera de alcance

- Edición (`/edit`) y detalle — se podrán alinear después con el mismo shell si quieres.
- Cambios de validación, copy de campos, lógica de Supabase o del Dialog de credenciales.
- Cambios de tipografía, tokens o sistema de diseño.

¿Apruebas este patrón y procedo a implementarlo?
