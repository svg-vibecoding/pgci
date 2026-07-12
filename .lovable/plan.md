# Ajustes UX — Clientes y permisos

Archivo único: `src/routes/_authenticated/setup/users.$userId.client-access.tsx`. No se toca lógica de guardado, contadores, toggles masivos, ni queries.

## 1. Paginación (20 por página)

- Nuevo estado local `page` (número, default 1) y constante `PAGE_SIZE = 20`.
- Derivar `pagedClients` a partir de `filteredClients`:
  - Si `search.trim() === ""`: paginar (`slice((page-1)*20, page*20)`).
  - Si hay búsqueda: **también** paginar el resultado filtrado con la misma regla (así respetamos "el filtro manda" pero evitamos listas gigantes; los usuarios pueden llegar a las páginas siguientes de sus resultados). El buscador manda porque restringe primero el universo.
- El `.map(...)` de la lista de clientes usa `pagedClients` en vez de `filteredClients`.
- Al cambiar `search`, resetear `page = 1` (via `useEffect` sobre `search`).
- Estado en curso: `stateMap` ya vive fuera del render de la lista y se indexa por `id`, así que cambiar de página **no pierde nada** — los switches ya activados en la página 1 siguen activos al volver. No se requieren cambios ahí.
- Contadores (`assignedCount`, `summaryText`, `initialSummaryText`, "X de N clientes asignados") siguen calculándose sobre `stateMap` / `clientsQ.data` completo. No se tocan.
- Toggles masivos siguen operando sobre `filteredClients` (todas las coincidencias del buscador, no solo la página visible). Mantiene el comportamiento actual documentado en el texto "Aplican a los clientes que coincidan con el buscador activo."

### Control de paginación

Debajo de la `<ul>` de clientes, dentro del mismo card, renderizar un footer solo si `filteredClients.length > PAGE_SIZE`:

- Botones numerados 1..N (`Math.ceil(filteredClients.length / PAGE_SIZE)`).
- Página activa: estilo primario; otras: `variant="ghost"` con `suma-caption`.
- Si hay más de 7 páginas, colapsar con elipsis: `1 … prev current next … last`.
- Aria-label por botón, `aria-current="page"` en la activa.
- Layout: `flex items-center justify-center gap-1 border-t border-border px-4 py-3`.

## 2. Indentación jerárquica de permisos

Hoy el bloque "Permisos avanzados" ya está indentado (`ml-12 border-l border-border pl-4`), pero los `<Switch>` internos usan `justify-between` que los empuja al mismo borde derecho que el switch de "Asignar cliente", lo cual crea el conflicto visual.

Cambios en el `.map` de `perm` (líneas 682–701):

- Reemplazar `justify-between` por un layout que deje los switches **antes** del borde derecho: cambiar el contenedor de cada fila a `flex items-center gap-4 py-1.5 pr-8 md:pr-12` (padding derecho suficiente para que los switches queden desplazados hacia el interior respecto al switch de asignar).
- Dentro, `<div className="flex flex-1 items-center gap-2">` para el ícono + label (queda a la izquierda), y el `<Switch />` va después sin `justify-between` explícito — el `flex-1` del label empuja al switch, pero el `pr-*` del contenedor lo mantiene alejado del borde.
- El switch de "Asignar cliente" (línea 650) NO se toca: sigue en el borde derecho gracias al `justify-between` de su fila padre.

Resultado: los tres switches de permisos quedan visualmente indentados a la izquierda (más adentro), reforzando que son sub-acciones dentro del cliente ya asignado.

## Verificación

- Preview manual con Playwright: 1) sin búsqueda → ver paginación; 2) navegar a página 2, activar un switch, volver a página 1, confirmar que el switch de página 2 sigue activo; 3) escribir en búsqueda → paginación se resetea a 1 y filtra; 4) asignar un cliente → verificar que los 3 switches de permisos quedan a la izquierda del switch de asignar.
- Sin cambios en tipos ni en llamadas a Supabase.
