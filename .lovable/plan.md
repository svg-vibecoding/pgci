## Objetivo

Unificar las vistas **Inicio** y **Perfil comercial** en un único módulo del menú lateral llamado **Operación comercial**, con un botón-link en la esquina superior derecha que alterna entre dos vistas dentro de la misma ruta.

## Cambios

### 1. Navegación lateral (`src/components/layout/AppShell.tsx`)
- Renombrar el item "Inicio" → **"Operación comercial"** (mantener icono `LayoutDashboard`, ruta `/pgci`).
- Eliminar el item "Perfil comercial" del `PGCI_NAV`.

### 2. Ruta consolidada (`src/routes/_authenticated/pgci/index.tsx`)
- Mantener header: `"Hola, {nombre}"` + subtítulo `"¡Hoy será un gran día!"`.
- Reemplazar el chip estático "Operación comercial" por un **botón-link** (estilo ghost/link, no primario) que:
  - Cuando la vista activa es Operación comercial → muestra texto **"Perfil comercial"** (con icono `UserCircle`).
  - Cuando la vista activa es Perfil comercial → muestra texto **"Operación comercial"** (con icono `LayoutDashboard`).
- Estado local `view: "ops" | "profile"` (default `"ops"`), controla qué bloque se renderiza debajo del header.
- **Vista `ops`** (actual Inicio): KPIs Clientes asignados / Acuerdos activos, alerta de sin cartera, grid de módulos. Sin cambios de contenido.
- **Vista `profile`**: renderiza las secciones actuales de `/pgci/profile` — Información personal, Seguridad (cambio de contraseña), Portafolio de accesos (accordion cliente → acuerdos → permisos), incluyendo alerta de Super Admin y bloque "Otros acuerdos". Se mantienen componentes y queries actuales.

### 3. Refactor de la vista de perfil
- Extraer el contenido de `src/routes/_authenticated/pgci/profile.tsx` a un componente reutilizable `src/components/pgci/CommercialProfileView.tsx` (sin header/KPIs propios, solo las 3 fichas) para consumirlo desde `index.tsx`.
- Eliminar la ruta `src/routes/_authenticated/pgci/profile.tsx` para que `/pgci/profile` deje de existir.
- Dejar que el plugin regenere `src/routeTree.gen.ts`.

### 4. Detalles de UX
- El botón-link va a la derecha del header (donde hoy está el chip), con transición sutil.
- Al alternar, `scrollTo(0,0)` para reiniciar el scroll.
- No se toca lógica de negocio, queries ni permisos.

## Inventario post-cambio
- Menú PGCI: Operación comercial · Acuerdos · Consulta · Exportación.
- Ruta única `/pgci` con dos vistas conmutables por botón-link.
