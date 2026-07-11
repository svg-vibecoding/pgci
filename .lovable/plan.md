## Punto 1 — Ocultar "Clientes y permisos" en detalle de super_admin

**Archivo:** `src/routes/_authenticated/setup/users.$userId.index.tsx`

La variable `isSuper = user.role === "super_admin"` ya existe. Envolver con `!isSuper` el botón "Clientes y permisos" en el header de acciones (líneas 150-157). El card "Cartera de clientes" ya renderiza un Alert de "acceso total" cuando `isSuper` y no muestra el botón en esa rama, así que no requiere cambios adicionales.

Sin cambios en `agreements.functions.ts` ni en backend (las RPCs ya filtran por `role = 'platform_user'`).