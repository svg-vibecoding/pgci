# Plan: Paso de mapeo de cliente (Card 3)

## Objetivo

Insertar entre "Lectura del archivo" y la clasificación un paso donde el usuario declare a qué cliente pertenecen los códigos del archivo, para que `classifyImport` reciba `mappedClientId` real y el bloque "Relaciones" del reporte funcione.

## Certezas implementadas

### 1. Cuándo aparece el paso

Aparece **solo** cuando se cumplen TODAS estas condiciones:

- El archivo trae la columna canónica `client_code`.
- Al menos una fila tiene un `client_code` no vacío.
- El acuerdo tiene **más de un cliente vigente** (`valid_until IS NULL`).

Si el acuerdo es **mono-cliente**, se usa automáticamente ese único cliente como `mappedClientId`; no se muestra el paso.
Si el archivo **no trae códigos**, el paso no aparece y `mappedClientId` queda `null`.

### 2. Fuente de clientes

El snapshot ya devuelve `clients: Array<{ id, name }>` y `clientIds: string[]` desde `getAgreementImportSnapshot`. No se toca el backend.

### 3. Recálculo del reporte

Al elegir o cambiar de cliente se vuelve a ejecutar `classifyImport` con el nuevo `mappedClientId` y se resetean las decisiones tomadas en el reporte (es un cruce distinto).

### 4. Nada se escribe

Todo es estado local en la vista de importación.

### 5. Restricciones respetadas

- No se modifica `diff.ts`, `parse.ts`, `types.ts` ni `agreements.functions.ts`.
- Un archivo = un cliente: el selector admite una sola opción.
- Design system y copy neutro en español Colombia.

## Propuesta de UX (a mi criterio)

### Numeración del flujo

Se inserta la nueva card como **Card 3**, desplazando la clasificación a **Card 4**:

1. Sube el archivo
2. Lectura del archivo
3. Cliente de los códigos
4. Cómo se clasifica

### Forma del selector

**Radio cards de cliente** en un grid de 1 columna en móvil y 2-3 en escritorio. Cada card muestra el nombre comercial del cliente (o razón social si no hay nombre comercial). Ventajas sobre un dropdown: escaneable, difícil de elegir sin querer, y comunica que la elección es intencional.

No hay opción preseleccionada. El usuario debe elegir explícitamente para continuar. El botón / acción de confirmación queda implícito en la elección misma: al hacer clic en una card se recalcula el reporte inmediatamente. Se añade un indicador de "Cliente elegido" en la card seleccionada.

### Copy propuesto

- Título de la card: **"Cliente de los códigos"**
- Pregunta: **"¿A qué cliente pertenecen los códigos de este archivo?"**
- Subtítulo: **"Un archivo = un cliente. Elige el cliente que corresponde a la columna Código del cliente."**
- Estado vacío / sin elegir: **"Elige un cliente para ver cómo se cruzan los códigos."**
- Cliente seleccionado: chip o label **"Código del cliente asignado a [Nombre]"**

### Qué mostrar cuando el paso no aplica

- **Sin columna de códigos**: una nota informativa breve al final de Card 2: *"El archivo no trae columna de código cliente, así que el cruce se hará solo por SKU."* No se muestra Card 3.
- **Mono-cliente**: una nota breve en Card 2 o como encabezado de Card 3: *"Este acuerdo tiene un solo cliente vigente, así que los códigos se asignan automáticamente a [Nombre]."* Se muestra Card 3 en modo informativo (sin selector) o, preferiblemente, se omite y se muestra la nota justo antes de Card 4.

Propongo **omitir la card cuando no aplica** y mostrar la nota justo debajo de Card 2 (en el mismo espacio de transición). Así el flujo no salta de Card 2 a Card 4 de forma abrupta: la nota explica por qué no hay Card 3.

### Comportamiento del flujo

1. Usuario sube archivo → Card 2 se renderiza.
2. La vista evalúa si aplica el paso de mapeo.
3. Si aplica: se renderiza Card 3 con las radio cards. Nada preseleccionado. Card 4 no aparece hasta que se elija cliente.
4. Si no aplica: aparece la nota informativa y Card 4 se renderiza de inmediato (con `mappedClientId` automático o `null`).
5. Al cambiar de cliente en Card 3: se resetea el estado de decisiones del reporte y se recalcula Card 4.

## Archivos a tocar

1. **Crear `src/components/agreements/import-report/ClientCodeMapping.tsx**` — nuevo componente con el grid de radio cards, manejo de selección y chip de confirmación.
2. **Editar `src/routes/_authenticated/pgci/agreements.$agreementId.import.tsx**`:
  - Añadir estado `mappedClientId`.
  - Calcular `hasClientCodeValues` a partir de `parsed.rows`.
  - Calcular `isMultiClient` a partir de `snapshotQuery.data.clients`.
  - Determinar `autoClientId` para mono-cliente.
  - Renderizar Card 3 (`ClientCodeMapping`) cuando aplica.
  - Renderizar Card 4 (renombrado de "3. Cómo se clasifica") solo cuando ya se resolvió el cliente (automático o elegido).
  - Resetear `classified` y decisiones al cambiar de cliente.
  - Añadir la nota informativa cuando el paso no aplica.
3. **Editar `src/components/agreements/import-report/ImportFileReading.tsx**` (opcional, ligero): si conviene, mostrar un resumen de cliente mapeado al final de Card 2 para que el usuario lo vea antes de entrar a Card 3. Esto es secundario; se puede omitir.

## Implementación técnica

### Estado en la ruta

```typescript
const [mappedClientId, setMappedClientId] = useState<string | null>(null);
```

### Helpers

```typescript
const hasClientCodeColumn = parsed?.presentColumns.includes("client_code") ?? false;
const hasClientCodeValues = hasClientCodeColumn && (parsed?.rows.some((r) => r.client_code && r.client_code.trim().length > 0) ?? false);
const clients = snapshotQuery.data?.clients ?? [];
const isMultiClient = clients.length > 1;
const autoClientId = !isMultiClient && clients.length === 1 ? clients[0].id : null;
```

### Reglas de renderizado

- Si `!hasClientCodeValues`: mostrar nota informativa, pasar `mappedClientId = null` a Card 4.
- Si `autoClientId`: mostrar nota informativa con nombre del cliente, pasar `mappedClientId = autoClientId` a Card 4.
- Si `isMultiClient && hasClientCodeValues`: mostrar Card 3 con selector. Card 4 solo si `mappedClientId !== null` (o si se quiere mostrar vacío con mensaje de "elige cliente").

### Recálculo

```typescript
useEffect(() => {
  if (!parsed) return;
  const effectiveClientId = isMultiClient ? mappedClientId : autoClientId;
  // ... recalcular classifyImport con effectiveClientId, resetear decisiones
}, [mappedClientId, autoClientId, parsed, snapshotQuery.data]);
```

O, alternativamente, manejarlo en el handler `onClientSelect` sin `useEffect` para evitar doble render. La decisión de implementación se deja al momento de construir, pero el resultado debe ser: al cambiar cliente, el reporte se recalcula y las decisiones previas se pierden.

## Notas

- El motor `diff.ts` ya soporta `mappedClientId`; no requiere cambios.
- El parser ya expone `client_code` en `ParsedRow`; no requiere cambios.
- El snapshot ya trae nombres de cliente; no requiere cambios.
- No se añaden tablas ni migraciones.

Plan aprobado con UNA corrección importante que faltaba en mi prompt anterior:

INTOCABLE (guía Paso 3 / spec §7): el selector NO lista todos los clientes vigentes 

del acuerdo. Lista SOLO los clientes sobre los que el usuario tiene 

can_manage_client_catalog.

La función can_manage_client_catalog existe en la base (verificado). Aplica ese 

filtro donde corresponda — probablemente en getAgreementImportSnapshot, que sí 

tendrá que tocarse para devolver solo los clientes permitidos (o marcar cuáles lo 

son).

Motivo: un usuario no debe poder mapear los códigos de un archivo a un cliente sobre 

el que no tiene autoridad de catálogo. Es una regla de permisos, no de UI.

Casos a manejar:

- Si el usuario tiene permiso sobre 1 solo cliente del acuerdo → ese es el 

  auto-seleccionado (aunque el acuerdo tenga varios clientes). Se comporta como 

  mono-cliente.

- Si no tiene permiso sobre ninguno → el paso debe comunicarlo claramente ("no 

  tienes permiso de catálogo sobre los clientes de este acuerdo"), no mostrar una 

  lista vacía.

Todo lo demás del plan (flujo condicional, radio cards, copy, recálculo al cambiar 

cliente, reset de decisiones) queda aprobado tal cual. Construye con esa corrección.