# Plan

## Objetivo
Homologar el tamaño de letra de las opciones radio del card de decisión de precio (dentro del alert de conflicto N:1 en el modal "Nueva posición") con el tamaño de los inputs y textareas del sistema: 14 px (`text-sm`) en desktop.

## Cambio a realizar
- Archivo: `src/components/agreements/LineEditDialog.tsx`
- Líneas: etiquetas `<label>` de las opciones radio del card de decisión de precio (valores `same` y `distinct`).
- Acción: reemplazar `text-[11px]` por `text-sm`.
- Preservar: capitalización normal, peso normal en el texto, y `font-semibold` únicamente en el precio resaltado de la primera opción.

## Verificación
- Typecheck del proyecto (`bunx tsgo --noEmit`).
- Revisión visual rápida del modal con un SKU que genere conflicto N:1.