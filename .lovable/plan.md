## Plan — Filtros operacionales y layout en `users.index.tsx`

Solo se toca `src/routes/_authenticated/setup/users.index.tsx`. Ningún otro archivo.

---

### Mejora 1 — Filtros operacionales

**Datos a traer (extender el `queryFn` existente)**

- Hoy: `agreement_members` solo trae `user_id`. Pasarlo a `select("user_id, role")`.
- Derivar por usuario dos contadores:
  - `admin_count` → membresías con `role = "agreement_admin"`
  - `member_count` → membresías con `role = "agreement_member"`
- Mantener `agreement_count = admin_count + member_count` para compatibilidad interna.

**Filtros nuevos (reemplazan a "Rol" y a "En gestión")**

Se eliminan: `RoleFilter`, `GestionFilter` y sus `Select`. Se conserva el filtro "Crea acuerdos" tal cual.

Dos selects nuevos, independientes y combinables:

1. **"Permiso de creación"** (`createF`, reemplaza al actual)
   - Todos
   - Puede crear (`create_count > 0`)
   - No puede crear (platform_user con `create_count === 0`)

2. **"Participación en acuerdos"** (`participationF`, nuevo)
   - Todos
   - Administra acuerdos (`admin_count > 0`)
   - Participa como miembro (`member_count > 0`)
   - Administra y participa (`admin_count > 0 && member_count > 0`)
   - Sin acuerdos activos (`agreement_count === 0`, solo platform_user)

   Las opciones "Administra" y "Participa" no son excluyentes: un usuario con ambos roles aparece en ambos filtros individuales, además de en "Administra y participa".

**Chips activos**

Reflejar los nuevos selects en los chips con etiquetas legibles (ej. "Participación: Administra acuerdos").

**Columna "Crea acuerdos" en la tabla**

Sustituir el texto plano `N en gestión` por una línea más precisa basada en los conteos por rol:

- Si `admin_count > 0 && member_count > 0` → `Administra N · Participa en M`
- Si solo `admin_count > 0` → `Administra N acuerdo(s)`
- Si solo `member_count > 0` → `Participa en M acuerdo(s)`
- Si ambos en 0 → `Sin acuerdos`

Se mantiene el chip Sí/No del permiso de creación a la izquierda.

---

### Mejora 2 — Layout buscador + filtros en una línea

En el contenedor `flex … md:flex-nowrap`:

- Buscador: quitar el ancho fijo `md:w-64 lg:w-72` y dejarlo como `flex-1 min-w-0` (con `min-w-[16rem]` como piso) para que ocupe todo el espacio sobrante en desktop.
- Selects: mantener anchos compactos actuales (`w-36`/`w-44`), `shrink-0`, alineados al final de la fila.
- En mobile se sigue envolviendo con `flex-wrap`.

Resultado: una sola línea limpia en desktop, buscador elástico a la izquierda y los dos selects fijos a la derecha.

---

### Fuera de alcance

Cards superiores, query base de `profiles`, lógica de alertas, columnas Usuario/Código/Cartera/Estado/Acciones, y cualquier otro archivo.