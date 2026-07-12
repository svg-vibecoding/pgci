# Filtro "Solo asignados" en Clientes y permisos

Archivo: `src/routes/_authenticated/setup/users.$userId.client-access.tsx`

## 1. Estado nuevo

Junto a `search`:

```tsx
const [assignedFilter, setAssignedFilter] = useState<"all" | "assigned">("all");
```

Ampliar el `useEffect` de reset de paginación:

```tsx
useEffect(() => { setPage(1); }, [search, assignedFilter]);
```

## 2. Lógica de filtrado

En el `useMemo` de `filteredClients` (línea 149), después del filtro por texto:

```tsx
if (assignedFilter === "assigned") {
  list = list.filter((c) => stateMap.get(c.id)?.assigned);
}
```

Dependencias: agregar `assignedFilter` y `stateMap`.

Consecuencias automáticas:
- `pagedClients` ya deriva de `filteredClients`, así que la paginación opera sobre el resultado filtrado.
- Los toggles masivos ya operan sobre `filteredClients` → siguen respetando el ámbito visible (comportamiento esperado).

## 3. Contador principal

"X de N clientes asignados" (header) NO cambia: sigue derivando de `stateMap` completo.

El contador secundario ("`{filteredClients.length} de {totalClients} clientes`", línea 517) se muestra también cuando `assignedFilter === "assigned"`, para dar feedback del subconjunto.

## 4. Control UI — usar componentes del design system

En lugar de botones sueltos con clases ad-hoc, reutilizar `SummaryToggle` de `@/components/sumatec` (ya importado en el archivo). Es el segmented control estándar del Sumatec Digital Design System y garantiza tipografía Montserrat, radios y estados consistentes con el resto de la vista (ya se usa en el header para "Resumen / Detalle").

Ubicación: mismo contenedor flex que envuelve el `Input` de búsqueda (línea ~502-517), como segundo hijo — buscador a la izquierda (crece), segmented control a la derecha.

```tsx
<SummaryToggle
  value={assignedFilter}
  onChange={(v) => setAssignedFilter(v as "all" | "assigned")}
  options={[
    { value: "all", label: "Todos" },
    { value: "assigned", label: "Solo asignados" },
  ]}
/>
```

(Si `SummaryToggle` no acepta `options` genéricos, se ajusta la firma mínima; NO se introducen clases de color hardcoded ni tipografía suelta — solo tokens y componentes del sistema.)

## 5. Estado vacío

En la rama de "sin resultados" (línea 601), diferenciar copy según contexto:

- `assignedFilter === "assigned"` y `totalAssigned === 0`:
  "Este usuario no tiene clientes asignados todavía."
- `assignedFilter === "assigned"` con búsqueda y sin coincidencias:
  "Ningún cliente asignado coincide con la búsqueda."
- Resto: mensaje actual.

Tipografía y espaciado del estado vacío heredados del contenedor actual (no se introducen clases nuevas).

## Lo que NO se toca

- Lógica de guardado, toggles masivos, permisos avanzados, queries, indentación de permisos, paginación (más allá del reset de página).
- Contador principal "X de N clientes asignados".
- Tokens de color ni tipografía: todo pasa por componentes del design system Sumatec.
