# Decisiones — Sumatec Digital Design System

Registro de decisiones de gobierno del sistema. Las decisiones son **normativas**: se aplican por defecto y solo cambian con una nueva decisión aprobada.

## D-DS-01 — El sistema es Sumatec Digital, transversal

El design system pertenece a **Sumatec**, no a un producto. Es transversal a todos los productos digitales (apps internas, dashboards, herramientas operativas). Lo que se agregue debe ser reutilizable por futuras apps.

## D-DS-02 — PGCI es implementación, no origen único

PGCI es la **primera implementación operativa** del sistema. No es su dueña ni su origen. PGCI consume las capas de fundamentos; no las define ni las gobierna.

## D-DS-03 — Tematizar contra tokens semánticos

El producto consume tokens semánticos (`--text-primary`, `--surface-card`, `--status-*`), nunca HEX crudo. Si falta un valor, se agrega al sistema (tokens), no se hardcodea en la app.

## D-DS-04 — Lovable propone, no improvisa identidad

Lovable implementa **contra la base aprobada**. Puede **proponer** mejoras y nuevos componentes/tokens, pero no improvisa identidad visual. Las propuestas pueden **evolucionar** el sistema solo si se aprueban.

## D-DS-05 — Tipografía

**Montserrat** para display, UI, botones y momentos de marca. **Roboto** para datos, tablas y lectura densa. **Mono del sistema** para SKUs, códigos y NITs. Nunca Roboto en headings o botones.

## D-DS-06 — Comercio fuera del core

**ProductCard, storefront, carrito, catálogo y cualquier pieza de e-commerce/commerce NO hacen parte del core del sistema ni de PGCI.** PGCI es una plataforma interna de gestión de acuerdos comerciales, no un e-commerce. Estas piezas se eliminan del repo; no se archivan dentro de PGCI.

## D-DS-07 — Tokens de estado de dominio

Los estados operativos usan tokens `--status-{estado}-{soft|base|strong}` para `active`, `pending`, `review`, `success`, `warning`, `danger`, `info` y `neutral`. Se mapean a las rampas existentes (sin paleta nueva). Única excepción permitida: `--status-review-strong` (`#8f6300`) por contraste de texto.

## D-DS-10 — Iconografía PGCI

PGCI **no agrega FontAwesome** como dependencia. La iconografía funcional de la plataforma usa **`lucide-react`**, ya disponible en el proyecto. Las clases `fa-*` heredadas deben eliminarse cuando sean decorativas o reemplazarse por Lucide cuando aporten valor funcional. No se usan clases `fa-solid`, `fa-regular` ni `fa-brands` en componentes nuevos ni en la vista `/sistema-diseno`.
