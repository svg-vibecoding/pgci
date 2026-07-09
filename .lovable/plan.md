## Plan: Unificar header de título entre detalle y posiciones del acuerdo

### Objetivo
Hacer que la vista de posiciones (`agreements.$agreementId.lines.tsx`) muestre el mismo encabezado de título que la vista de detalle (`agreements.$agreementId.index.tsx`): nombre del acuerdo, badge de estado y metadatos de clientes cubiertos, miembros y posiciones.

### Cambios propuestos

1. **Crear componente reutilizable `AgreementHeader`**
   - Ubicación: `src/components/agreements/AgreementHeader.tsx`
   - Responsabilidad: mostrar el título del acuerdo, el `StatusBadge` y la línea de metadatos (`clientes cubiertos · miembros · posiciones`).
   - El componente recibirá `agreementId` y se encargará de sus propias consultas (`getAgreement`, `listAgreementMembers`, conteo de `agreement_companies`) para no repetir lógica en las rutas.
   - Mantendrá los estilos actuales: `text-2xl font-bold tracking-tight`, badge de estado, texto `text-sm text-muted-foreground` con separadores `·`.

2. **Refactorizar `src/routes/_authenticated/pgci/agreements.$agreementId.index.tsx`**
   - Reemplazar el bloque de título/estado/metadatos por `<AgreementHeader agreementId={agreementId} />`.
   - Conservar los botones de acción de la derecha (Posiciones, Editar, Activar/Inactivar) como están, ya que el usuario solo pidió unificar el *header de títulos*.
   - Eliminar o dejar las queries que ya no se usen directamente en la ruta si solo servían al header (se evaluará en el momento de la implementación).

3. **Refactorizar `src/routes/_authenticated/pgci/agreements.$agreementId.lines.tsx`**
   - Reemplazar el bloque actual (`<h1>{agreement.name}</h1>`, `<StatusBadge>`, subtítulo “Posiciones en el acuerdo”) por `<AgreementHeader agreementId={agreementId} />`.
   - Conservar los botones de acción de la derecha (Exportar, Importar, Nueva posición) como están.

### Criterios de aceptación
- En la vista de detalle se sigue viendo: “Corona EPP”, tag de estado y “2 clientes cubiertos · 1 miembro · 88 posiciones”.
- En la vista de posiciones se ve exactamente el mismo encabezado (mismo título, tag y metadatos) para el mismo acuerdo.
- Los botones de acción de cada vista permanecen sin cambios.
- No se rompen las consultas existentes ni las acciones de cada vista.

### Notas técnicas
- Se reutilizarán las funciones server y queries ya existentes (`getAgreement`, `listAgreementMembers`, conteo directo sobre `agreement_companies`).
- Se mantiene el diseño del Sumatec Design System: fuente Montserrat para títulos, tokens semánticos, sin hardcodeo de colores.