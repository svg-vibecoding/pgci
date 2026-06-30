## Objetivo
Alinear la vista de líneas del acuerdo con el patrón visual de Clientes / Productos / Usuarios / listado de Acuerdos: header con acciones, cards de indicadores filtrables, y buscador + tabla a ancho completo sin Card envolvente.

## Cambios

### 1. `src/routes/_authenticated/pgci/agreements.$agreementId.lines.tsx`
- Mantener breadcrumb "Volver al acuerdo".
- Header rediseñado: a la izquierda el título (nombre + StatusBadge + badge "Con alcance") y subtítulo "Gestión de productos · {Cliente}[· {Unidad}]"; a la derecha los botones **Exportar** (outline), **Importar** (outline, solo `canAdmin`) y **Nueva línea** (primario, solo `canAdmin`), alineados como en otras vistas.
- Subir aquí el estado y queries que hoy viven dentro de `AgreementLinesSection`: `listAgreementLines`, filtros `status`/`q`, mutaciones `exclude`/`reactivate`, diálogos `LineEditDialog` y `AlertDialog` de excluir, handler de exportación.
- Renderizar 5 cards filtrables (mismo componente/estilo que `agreements.index.tsx`: Card clicable con `border-l-[3px] border-l-primary` cuando está activa): Líneas / Activas / Pendientes / Requieren revisión / Excluidas. Click setea el filtro `status`.
- Debajo: fila con buscador (a ancho completo, mismo input con icono y botón de limpiar) — sin tabs de status duplicados, ya que las cards cumplen ese rol. Mantener el placeholder actual.
- Tabla y diálogos sueltos en la página (sin `<Card>` envolvente), conservando columnas y acciones actuales.

### 2. `src/components/agreements/AgreementLinesSection.tsx`
- Eliminar (su lógica se traslada a la ruta). Verificar que ningún otro archivo lo importe; si no, borrar el archivo con `rm`.

## Notas
- Reutilizar el patrón exacto de cards filtrables de `agreements.index.tsx` para consistencia visual.
- No tocar `LineEditDialog`, `AgreementImportWizard`, export, ni lógica de mutaciones — solo se mueven de archivo.
- Sin cambios de backend.
