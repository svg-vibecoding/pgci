Plan: reorganización del reporte de importación (Card 3)

Objetivo
Transformar el reporte de importación para que hable en modo POSICIÓN, con un layout limpio y consistente: header de 3 métricas sobre el archivo, 6 grupos colapsados en orden 1→6, sticky de decisión dinámico, y el grupo 4 convertido en "Nuevas posiciones" con subgrupos de completitud y opt-in de publicación.

CERTEZAS que implementa el plan

1. Orden de grupos secuencial 1→6
  Reordenar en ImportReport.tsx:
  1. Requieren decisión
  2. Modifican posiciones publicadas
  3. Modifican gestión / agregan códigos
  4. Nuevas posiciones
  5. Sin cambios
  6. No procesables
2. Renombrar grupo 4
  - Group4NotInAgreement.tsx → Group4NewPositions.tsx
  - Título: "Nuevas posiciones"
  - Subtítulo: "No están en el acuerdo. El estado lo trae el archivo; tú defines cuáles crear. Nada se crea por defecto."
3. Header con 3 cards de indicadores
  Añadir un nuevo componente ImportReportHeader encima de los grupos, con 3 métricas sobre el archivo:
  - Filas totales: total de filas del archivo (parsed rows).
  - Códigos Jaivaná únicos: conteo de códigos cliente únicos presentes en el archivo (solo si hay columna client_code; de lo contrario mostrar "—" o 0 con leyenda).
  - Jaivaná no identificados: códigos cliente del archivo que no se encontraron como códigos activos del acuerdo. Color de alerta (tono warning/primary rojo Sumatec) porque señala algo a atender.
   Las cards reutilizan el patrón visual de métricas de la app (Card simple o contenedor con número grande + label pequeño). No incluyen conteos por grupo; esos viven en cada acordeón.
4. Grupos colapsados por defecto (acordeones)
  - Reemplazar GroupShell por un contenedor acordeón basado en el componente Accordion existente de shadcn/ui.
  - Cada grupo siempre visible, incluso con 0 filas.
  - Fila limpia: título + conteo + chevron. No se muestra el contenido hasta expandir.
  - La vista en reposo es: header + 6 líneas de acordeón + sticky decision bar.
  - Se añade un componente reutilizable ImportReportGroup que unifique el encabezado del acordeón.
5. Sticky de decisión rediseñado
  - Reemplazar StickyDecisionBar por un componente más simple y centrado en el resultado:
    - Línea principal: "N filas necesitan tu decisión antes de continuar" (cuando pendingG1 > 0).
    - Línea de resumen dinámico: "Al confirmar: se crean X posiciones nuevas y se modifican Y existentes." X e Y son conteos vivos de decisiones del usuario, no del cruce inicial.
    - Botón "Confirmar importación".
  - Eliminar del sticky los stats "Total", "Requieren tu atención", "Publicadas se modificarán", "Se aplicarán".
  - Bloqueo del botón: propuesta UX = bloquear mientras haya G1 pendientes, con tooltip/title que indique que hay filas sin resolver. Esto es coherente con el estado actual y evita confirmaciones accidentales.
6. Grupo "Nuevas posiciones" con dos subgrupos
  - Dividir las filas del grupo 4 en dos subgrupos según completitud del archivo:
    - "Listas para publicar": precio y vigencia completos (sale_price != null && start_date != null && end_date != null).
    - "Quedarán en gestión": les falta precio o vigencia. Se muestra el dato faltante por fila: "sin precio", "sin vigencia" o ambos.
  - Subtítulo de cada subgrupo: "X de Y marcadas" (Y total del subgrupo, X marcadas por el usuario). Dinámico.
  - Nada preseleccionado: checkbox apagado por default en cada fila.
  - Atajos en el header del grupo: "Crear todas" e "Ignorar todas".
  - Opt-in de publicación dentro de "Listas para publicar": checkbox "Publicar las marcadas al confirmar (~N se ven listas)", apagado por default. El ~N es la estimación de filas marcadas en ese subgrupo. El valor real de cuáles publicar se envía al backend en la confirmación.

Comportamiento dinámico: la regla que gobierna todo

Todos los conteos de resultado (sticky, subtítulos de subgrupo, opt-in) se derivan del estado de decisiones del usuario, no de la clasificación inicial. El hook useImportDecisions keyed por sourceRow es la fuente de verdad.

Para alimentar los nuevos conteos se extiende el hook de decisiones con:

- createdCount: número de filas de G4 con decisión create_draft.
- modifiedCount: número de filas de G2 y G3 con decisión apply + G1 resueltas con apply/create/apply_to_candidate.
- publishEstimate: número de filas de G4 "listas para publicar" marcadas como create_draft cuando el opt-in está activo.
- pendingG1: se mantiene.

El hook ya devuelve stats calculadas; se añaden los campos nuevos a la misma función useMemo sin tocar el motor de clasificación.

DONDE NO HAY CERTEZA — PROPUESTAS DEL PLAN

1. Vocabulario único de CTAs
  Para evitar que cada grupo se vea distinto, se propone un vocabulario transversal:
  - Aplicar cambios: verbo "Aplicar" / "Aplicar a esta" para G1, G2, G3.
  - Crear posición: verbo "Crear" para G4.
  - Ignorar/Excluir: unificar como "Ignorar" en todos los grupos. Reemplazar "Excluir" en G2/G3 por "Ignorar" para que la acción de "no aplicar" sea la misma palabra en todos lados.
  - Reincluir: verbo "Restaurar" o "Incluir" para revertir una decisión de ignorar. Se propone "Incluir" para mantenerlo simple.
  - Atajos de grupo: en todos los grupos que tengan acciones masivas, usar el mismo patrón: "Aplicar todas / Ignorar todas" (G2/G3) o "Crear todas / Ignorar todas" (G4) o "Ignorar todas" (G1).
  - Posición de los CTAs: siempre al final de la fila, alineados a la derecha; atajos de grupo en el header del acordeón, alineados a la derecha.
2. Color/tono de cada subgrupo en G4
  - "Listas para publicar": tono success (verde) porque están completas y listas para salir.
  - "Quedarán en gestión": tono warning (amarillo/naranja) porque nacen como borrador y requieren seguimiento.
  - Se usan chips y badges existentes (success, warning) del design system, no colores inventados.
3. Iconos y microcopy
  - Icono de cada grupo en el acordeón: propuestas
    - G1: AlertTriangle (lucide)
    - G2: AlertCircle o Edit3
    - G3: PlusCircle o FilePlus
    - G4: PlusSquare
    - G5: CheckCircle2
    - G6: Ban
  - Icono de opt-in: CheckCircle2 cuando activo, Circle cuando inactivo.
  - Microcopy del sticky: "N filas necesitan tu decisión antes de continuar" / "Al confirmar: se crean X posiciones nuevas y se modifican Y existentes." / "Confirmar importación".
4. Confirmación con pendientes
  - Propuesta: mantener el botón deshabilitado mientras G1 tenga pendientes. Es la opción más segura y evita que el usuario confirme sin haber resuelto conflictos.
  - Alternativa (si se prefiere): dejar el botón activo y mostrar un AlertDialog al confirmar con advertencia. Se deja como opción para decisión posterior, pero la propuesta por defecto es bloquear.

Cómo se reorganizan los componentes

1. ImportReport.tsx
  - Añadir ImportReportHeader con las 3 métricas.
  - Reemplazar el listado actual por 6 acordeones usando ImportReportGroup.
  - Reordenar los grupos 1→6.
  - Renderizar StickyDecisionBar entre el header y los acordeones, o fijo arriba del listado como está hoy.
2. StickyDecisionBar.tsx
  - Simplificar a la caja de resumen con mensaje de pendientes, resumen dinámico y botón.
  - Recibir createdCount, modifiedCount y publishEstimate (si se quiere anticipar publicación en el resumen) desde decisions.
3. Nuevo archivo: import-report/ImportReportGroup.tsx
  - Contenedor acordeón basado en Accordion de shadcn/ui.
  - Header: icono + título + conteo + toolbar (atajos) + chevron.
  - Variante de tono para "warning" (G1) y "muted" (G5/G6).
4. Nuevo archivo: import-report/ImportReportHeader.tsx
  - Tres cards de métricas sobre el archivo.
  - Reutilizar componentes Card de shadcn/ui o un contenedor simple con estilos del design system.
5. Group4NewPositions.tsx (renombrado desde Group4NotInAgreement.tsx)
  - Dividir rows en ready y draft-subgroup.
  - Mostrar cada subgrupo con su subtítulo "X de Y marcadas".
  - Checkbox de creación por fila.
  - Checkbox de opt-in "Publicar las marcadas al confirmar (~N)" dentro de ready.
  - Atajos "Crear todas" / "Ignorar todas".
6. Group1RequiresDecision.tsx, Group2ModifiesPublished.tsx, Group3DraftsAndCodes.tsx, Group5Unchanged.tsx, Group6NotProcessable.tsx
  - Adaptar para renderizarse dentro de ImportReportGroup.
  - Unificar vocabulario de CTAs según lo propuesto.
  - G1: "Ignorar" / "Crear nueva" / "Aplicar a esta".
  - G2/G3: "Incluir" / "Ignorar" (reemplazar "Reincluir" / "Excluir").
  - G5/G6: solo lectura, sin acciones.
7. state.ts
  - Extender Decision con un nuevo tipo para el opt-in de publicación: se maneja como estado local booleano por subgrupo, no como Decision por fila.
  - Añadir createdCount, modifiedCount y publishEstimate a las stats calculadas.
  - Mover la función defaultFor al exportar si se necesita en componentes (no estrictamente necesario, pero útil para subgrupos).
8. parts.tsx
  - Añadir un componente reutilizable para el checkbox de fila con estado parcial (indeterminate) si se usa "Crear todas".
  - No cambiar celdas existentes salvo ajustes menores de espaciado si el acordeón lo requiere.

Tareas de construcción detalladas

1. Crear ImportReportHeader.tsx y conectarlo con los datos del archivo (totalRows, clientCodes únicos, no identificados).
2. Crear ImportReportGroup.tsx como acordeón reutilizable.
3. Refactorizar ImportReport.tsx para usar header + acordeones + reordenamiento.
4. Refactorizar StickyDecisionBar.tsx con el nuevo lenguaje y conteos dinámicos.
5. Renombrar Group4NotInAgreement.tsx a Group4NewPositions.tsx e implementar subgrupos + opt-in.
6. Actualizar Group1RequiresDecision.tsx, Group2ModifiesPublished.tsx, Group3DraftsAndCodes.tsx para unificar vocabulario de CTAs y adaptarse al acordeón.
7. Extender useImportDecisions en state.ts para calcular createdCount, modifiedCount y publishEstimate.
8. Actualizar la importación de archivos afectados y corregir cualquier tipo derivado.
9. Verificar visualmente que los 6 grupos colapsados, el header y el sticky se rendericen correctamente.

Archivos que se tocarán

- src/components/agreements/import-report/ImportReport.tsx
- src/components/agreements/import-report/StickyDecisionBar.tsx
- src/components/agreements/import-report/ImportReportHeader.tsx (nuevo)
- src/components/agreements/import-report/ImportReportGroup.tsx (nuevo)
- src/components/agreements/import-report/groups/Group4NotInAgreement.tsx → Group4NewPositions.tsx (renombrado)
- src/components/agreements/import-report/groups/Group1RequiresDecision.tsx
- src/components/agreements/import-report/groups/Group2ModifiesPublished.tsx
- src/components/agreements/import-report/groups/Group3DraftsAndCodes.tsx
- src/components/agreements/import-report/groups/Group5Unchanged.tsx
- src/components/agreements/import-report/groups/Group6NotProcessable.tsx
- src/components/agreements/import-report/state.ts
- src/components/agreements/import-report/parts.tsx (posiblemente)

Intocables respetados

- No se escribe en la base de datos: todo sigue siendo previsualización y estado local.
- No se preselecciona nada en G1 ni G4.
- No se toca el motor diff.ts ni las server functions.
- Se usan tokens del design system (suma-*, componentes de shadcn/ui existentes).
- Copy neutro y en español Colombia ("tú").

&nbsp;

Tu plan está aprobado casi todo. Un cambio importante y tres confirmaciones:

CAMBIO — el grupo "Nuevas posiciones" va SIMPLE, sin lo que diseñamos de 

publicación:

- SIN subgrupos "Listas para publicar" / "Quedarán en gestión".

- SIN opt-in de publicación.

- SIN tags de "completa/incompleta/lista".

- Es una tabla plana: checkbox (crear) · Producto (SKU + descripción) · Precio · 

  Vigencia · Código propuesto.

- La importación SOLO CREA, todo nace en draft. NO publica (la publicación es un 

  acto posterior en la gestión de posiciones, con su propia regla — no la tocamos).

- Los datos se muestran tal como vienen; si falta precio/fecha, se ve vacío o "—". 

  Sin tag ni color que juzgue completitud. El sistema muestra hechos, no opina.

- La barra de decisión tampoco menciona publicación: solo "se crean X / se 

  modifican Y", dinámico.

CONFIRMA:

1. "Confirmar importación" no ejecuta nada aún (Paso 4, no construido).

2. No tocas el motor (diff.ts) ni las server functions.

3. Nada se escribe: previsualización, estado local.

Todo lo demás de tu plan (vocabulario único de CTAs, orden 1→6, renombre a "Nuevas 

posiciones", header con 3 indicadores, comportamiento dinámico) queda aprobado tal 

cual. Con estos ajustes, construye.