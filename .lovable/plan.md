
## Dirección visual

Pasar de "panel admin rígido" a "centro de configuración B2B inteligente" sin tocar lógica.

Principios:
- Rojo Sumatec solo para señalizar acción/estado activo, nunca como fondo plano dominante.
- Eliminar todo azul accidental (hoy el hover usa `hover:bg-accent`, que está mapeado a azul institucional → se ve genérico y fuera de identidad).
- Sidebar mantiene fondo claro pero con superficie levemente diferenciada (`surface-card` con un tinte gris-cool) para sentirse más sofisticada que un panel blanco plano.
- Estado activo: indicador lateral rojo + fondo `red-50` muy ligero + texto `gray-900` + ícono rojo. Sin pill rojo sólido pesado.
- Hover: fondo `gray-100` neutro + transición suave 120ms. Nada de azul, nada de rojo.
- Disabled (Usuarios): se ve intencional con badge "Próximamente" en lugar de parecer roto.
- Tipografía jerárquica Montserrat para títulos y `suma-overline` para etiquetas de sección.

## Cambios concretos (solo UI)

### 1. `src/routes/_authenticated/setup/route.tsx`
- Sidebar: ancho 264px (token `--sidebar-w`), fondo `surface-card`, separador sutil, padding más generoso.
- Header del sidebar: logo + etiqueta "PLATAFORMA" arriba y "Setup Operativo" como label de sección con `suma-overline`.
- Sección de navegación con label "GESTIÓN" en overline.
- Item activo:
  - `bg-red-50 text-gray-900 font-semibold`
  - Barra lateral izquierda de 3px en `--color-primary` (pseudo-borde con `before:`)
  - Ícono en `text-red-500`
- Item hover (no activo): `hover:bg-gray-100` + ícono que pasa a `text-gray-900`. Sin azul.
- Item disabled (Usuarios): texto `text-gray-400`, chip "Próximamente" pequeño a la derecha, tooltip explica que llega con S-08.
- Footer del sidebar: pequeña tarjeta con email del usuario + botón "Cerrar sesión" como `ghost` con ícono.

### 2. `src/routes/_authenticated/setup/index.tsx` — Home Setup
- Header:
  - Overline "SETUP OPERATIVO · MÓDULO M2"
  - H1 "Configura la base operativa de PGCI"
  - Subtítulo: *"Define clientes, empresas, productos y accesos desde una sola fuente de verdad. Esta configuración alimenta acuerdos, matching y todo el flujo comercial."*
- Barra de progreso de setup (visual, no funcional nueva): pasos `Clientes → Empresas → PIM → Accesos`. Cada paso indica `completo / pendiente` derivado de los counts ya existentes (sin nuevas queries). Estado completo = check verde, pendiente = punto gris, próximo recomendado = punto rojo. Esto resuelve "qué configurar primero / qué falta / qué sigue".
- Cards rediseñadas (misma data, sin nuevas métricas):
  - Layout: 3 columnas en desktop, ícono en chip suave (no plano), número grande Montserrat bold, label, **microcopy** debajo, y enlace "Ver →" cuando aplica.
  - Microcopy propuesto (editable):
    - Clientes piloto: "Base inicial de clientes que activa cobertura y acuerdos."
    - Empresas registradas: "Razones sociales por cliente para facturación y matching."
    - Productos PIM: "Catálogo Jaivaná listo para acuerdos y matching automatizado."
    - Usuarios activos: "Personas con sesión activa en la plataforma."
    - Accesos configurados: "Vínculo entre usuarios y clientes habilitados."
  - Sin sombras pesadas: borde sutil + `shadow-xs` en hover.
- Alertas: mantienen contenido pero se mueven a un bloque con icono `AlertTriangle` en `--warning-strong` sobre `--warning-soft`, no como Card genérica.
- Accesos rápidos inferiores: se mantienen los enlaces a Clientes/PIM (Usuarios disabled con chip "Próximamente"), pero como `Button variant="outline"` discretos al pie, no como bloque protagónico.

### 3. Empty state inicial
Cuando no hay clientes ni productos activos:
- Card con `surface-card`, borde sutil, ilustración mínima con ícono `Building2` dentro de círculo `bg-red-50` y anillo `red-100`.
- Título: "Empieza por crear tus clientes piloto"
- Texto: "Los clientes piloto son la base operativa de PGCI. Una vez creados podrás registrar sus empresas, importar el catálogo y habilitar accesos."
- Lista de 3 pasos numerados (1·Clientes  2·Empresas  3·PIM) como guía.
- CTA primario: "Crear primer cliente" → `/setup/clients/new` (se mantiene).
- CTA secundario textual: "¿Necesitas ayuda con la importación? Ver guía de PIM" enlazando a `/setup/products` (sin nuevas rutas).

### 4. Microajustes globales
- Reemplazar todos los `hover:bg-accent hover:text-accent-foreground` del sidebar (origen del azul) por hover neutro.
- Ningún color hex en componentes; todo via tokens (`bg-red-50`, `text-gray-600`, etc., ya existentes en el design system).

## Fuera de alcance (no se toca)

- Backend, RLS, Supabase, rutas, auth, gates, importación PIM, lógica de productos.
- No se crean Usuarios, Accesos, Diagnóstico, Acuerdos, Matching, Dashboard, Export, IA, costos, márgenes.
- No se agregan dependencias.

## Archivos a modificar

- `src/routes/_authenticated/setup/route.tsx` (sidebar)
- `src/routes/_authenticated/setup/index.tsx` (Home, cards, empty state, textos)

## Validación

- Playwright headless screenshot de `/setup` (logueado con sesión inyectada) → revisar sidebar sin azul, Home con nueva jerarquía, empty state guiado.
- Verificar que rutas, navegación y counts siguen funcionando idénticos.
