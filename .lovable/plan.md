## Alcance

Rediseño solo-UI del modal de posición, del diálogo de exclusión y de la vista de posiciones para el modelo multi-cliente. Sin migraciones, sin cambios a RPCs.

**H-4 verificado contra schema vivo**: `has_function_privilege('authenticated', 'public.can_manage_client_catalog(uuid)', 'execute') = true`. El plan puede apoyarse en la RPC.

## 1. Nueva lectura de permisos por cliente

`src/lib/agreements.functions.ts` — nueva `listClientCatalogPermissions`:

- Input `{ agreement_id: uuid }`, middleware `requireSupabaseAuth`, `assertCanAccess`.
- Lee `agreement_companies` (período abierto) para obtener `client_id`s del acuerdo.
- Para cada uno, `supabase.rpc("can_manage_client_catalog", { p_client_id })` en paralelo (`Promise.all`).
- Retorna `Array<{ client_id: string; can_manage: boolean }>`.
- React Query key `["agreements", "catalog-perms", agreementId]`.

## 2. Extensión de `listAgreementLines` — códigos liberados

Después de resolver códigos abiertos, para posiciones `status='excluded'` (`excludedIds`):

- Segunda consulta a `agreement_position_client_codes` con `agreement_position_id IN excludedIds AND ended_reason = 'posición excluida'`, incluyendo `valid_until`.
- Dedupe en memoria: por `(position_id, client_id)` conserva el registro con `valid_until` más reciente (`Date.parse` desc). Solo se incluye si la posición NO tiene código abierto para ese cliente (para no duplicar).
- Hidrata `client_products.client_code`, `clients.commercial_name/legal_name`, y añade el `client_product_id` al `Set` que alimenta `client_product_history` (una sola consulta de historial ya existente).
- Añade a `codesByPos` con `released: true`.

Tipo `LineCode` gana `released?: boolean` (default omitido/false).

## 3. Rediseño de `LineEditDialog`

### Layout

`DialogContent` pasa a `max-w-6xl h-[92vh] p-0`. Body: `grid grid-cols-1 lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)]`. Cada columna con `overflow-y-auto`. Footer sticky abajo con un único botón "Guardar".

### Columna izquierda — la posición

- Sección `01 · Producto Jaivaná`: reutiliza tal cual el buscador con Popover, campos read-only, alertas de inactivo/no-encontrado, y el bloque de N-posiciones con `Collapsible` y vincular precio. Se elimina el `Alert` "acuerdo tiene varios clientes / disponible tras el rediseño".
- Sección `02 · Condiciones comerciales`: precio venta, par, `start_date`, `end_date`, observaciones.
  - **Sin gating por `hasProduct`** — inputs siempre habilitados.
  - Se elimina el helper "Las condiciones comerciales se habilitan cuando haya producto..."; se conserva el helper de herencia de vigencia del acuerdo.

### Columna derecha — códigos por cliente

Subcomponente inline `ClientCodeCards`:

- Props: `clients: Array<{ id; name; can_manage: boolean }>`, `values: Map<client_id, {code, description}>`, `onChange`.
- Una tarjeta por cliente del acuerdo — SIEMPRE, también en mono-cliente. Encabezado = nombre. Dos inputs: Código y Descripción.
- Orden alfabético por `name`.
- `!can_manage`: inputs `disabled`, `bg-muted/50`, nota `text-xs`: "Sin permiso para gestionar el catálogo de este cliente".
- Scroll propio.

### Estado del formulario

```ts
export type LineEditValues = {
  line_id?: string | null;
  kind?: "position" | "transit";
  sku: string;
  client_codes: LineEditClientCode[]; // lista completa declarativa
  sale_price: string;
  par_price: string;
  start_date: string;
  end_date: string;
  observations: string;
};
```

- Se **eliminan** `client_code`/`client_description` planos y el helper `buildClientCodes` transitorio.
- Al abrir: `values` se hidrata mezclando (a) `client_codes` de `initial` (edición) con (b) placeholders vacíos para los clientes del acuerdo faltantes. En creación, solo placeholders.

### Construcción del payload (H-3)

```ts
const codes: LineEditClientCode[] = [];
for (const c of clientsSorted) {
  const entry = valuesMap.get(c.id);
  const original = originalMap.get(c.id); // de initial.client_codes
  // Tarjeta deshabilitada por !can_manage: reenviar tal cual si existía.
  if (!c.can_manage) {
    if (original && original.client_code.trim()) codes.push(original);
    continue;
  }
  const code = (entry?.code ?? "").trim();
  if (!code) continue;
  codes.push({
    client_id: c.id,
    client_code: code,
    description: (entry?.description ?? "").trim(),
  });
}
```

Consecuencia aceptada: si el usuario sin permiso guarda una posición con un cliente bloqueado, la RPC responde `42501`. Se muestra tal cual (mensaje legible del SQL). Solución de fondo va en Fase B.

### Guardado — onSuccess por forma de retorno (H-1, H-2)

`createAgreementLine` → `{ line_id: string, kind: "position" | "transit" }`.
`updateAgreementLine` → `{ promoted: boolean, position_id?: string, transit_id?: string, blocked?: boolean, block_reason?: {...} }`.

```ts
onSuccess: (res) => {
  // (1) bloqueo (solo update)
  if (res?.blocked) {
    const br = res.block_reason ?? {};
    const clientName = br.client_id ? clientById.get(br.client_id)?.name ?? null : null;
    const who = clientName ?? "otro cliente";
    const sku = br.conflicting_sku ?? "<sin SKU>";
    toast.error(
      br.code === "identity_no_codes"
        ? "No se puede promover: ya existe otra posición vigente de este SKU sin códigos de cliente."
        : `No se puede guardar: el código de ${who} ya está fijado al SKU ${sku} en otra posición del acuerdo.`,
    );
    return;
  }
  // (2) éxito
  const isCreate = !isEdit;
  const isPromotion = res?.promoted === true;
  const isPending = isCreate
    ? res?.kind === "transit"
    : !!res?.transit_id && !isPromotion;
  if (isPending) {
    const missing = computePendingLabels(); // H-1: en cliente
    toast.info(
      missing.length
        ? `Guardado como pendiente — falta ${missing.join(", ")}`
        : "Guardado como pendiente",
    );
  } else if (isPromotion || isCreate) {
    toast.success("Posición creada");
  } else {
    toast.success("Posición actualizada");
  }
  qc.invalidateQueries(...);
  onOpenChange(false);
},
```

`computePendingLabels()` deriva faltantes desde el formulario y `agreementStartDate`/`agreementEndDate`:

- SKU: `productId == null` o `v.sku.trim() === ""` → `"SKU"`.
- Precio: `parsePriceInput(v.sale_price)` ≤ 0 o null → `"precio"`.
- Vigencia efectiva: `!v.start_date && !agreementStartDate || !v.end_date && !agreementEndDate` → `"vigencia"`.

### onError (menor)

```ts
onError: (e: Error) => {
  const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  const msg = e.message.replace(uuid, (m) => clientById.get(m)?.name ?? m);
  toast.error(msg);
},
```

Los 23505/42501 llegan como `Error` normal (serverFn ya los convierte). No overlay de dev.

## 4. Exclusión informada

`excludeTarget` se extiende con `codes: LineCode[]`. La `AlertDialogDescription` muestra:

```
Esta posición atiende el código {code1} de {clientName1}[, el código {code2} de {clientName2}, ...].
Al excluirla, el/los código(s) quedará(n) liberado(s) y podrá(n) fijarse a otra posición del acuerdo.
```

Sin códigos: se conserva el texto actual.

## 5. Códigos liberados en filas excluidas

Celda "Cliente" para `r.kind === "position" && r.status === "excluded"`:

- Si `r.codes` (abiertos) para el cliente proyectado (§7) existe → render normal.
- Si no existe pero hay `code` con `released === true` para ese cliente → render atenuado (`text-muted-foreground opacity-60`) + `<Badge color="neutral" variant="soft">liberado</Badge>`.
- Fallback: `—`.

## 6. Importación en OFF

Header: botón "Importar" con `disabled` + Tooltip "Importación en mantenimiento — disponible en la próxima versión". Se elimina el estado `importOpen` y el render del `<AgreementImportWizard />` (archivo no se borra).

## 7. Selector de proyección por cliente

```ts
const visibleClients = useMemo(() =>
  [...agreementClients].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
[agreementClients]);
const [projectionClientId, setProjectionClientId] = useState<string | null>(null);
useEffect(() => {
  if (!projectionClientId && visibleClients[0]) setProjectionClientId(visibleClients[0].id);
}, [visibleClients, projectionClientId]);
```

- `<Select>` "Cliente: {nombre}" visible solo si `visibleClients.length > 1`, ubicado junto al buscador.
- Celda "Cliente": muestra código+descripción del `code` cuyo `client_id === projectionClientId` (o `released` para excluidas). Sin match → `—`.
- Buscador (`q`) sigue barriendo `r.codes` completo. La proyección **nunca** cambia el conteo de filas.

## 8. Limpieza de tipos y prellenado

- `LineEditClientCode`: sin cambios.
- `LineCode`: `released?: boolean`.
- `LineEditDialog`: `empty` sin `client_code`/`client_description`; `openEditForLine` deja de setearlos (solo pasa `client_codes`).

## 9. Verificación

1. `bunx tsgo --noEmit` → 0.
2. `rg -n "client_code:|client_description:" src/components/agreements/LineEditDialog.tsx src/routes/_authenticated/pgci/agreements.$agreementId.lines.tsx` → sin coincidencias.
3. `has_function_privilege('authenticated', 'public.can_manage_client_catalog(uuid)', 'execute') = true` **[YA VERIFICADO]**.
4. Manual: (a) crear sin SKU → toast "…falta SKU"; (b) editar multi-cliente sin cerrar códigos de terceros; (c) 23505 → toast rojo con nombre; (d) exclusión menciona código+cliente; (e) selector re-proyecta sin ocultar filas.

## Fuera de alcance

Wizard importación multi-cliente. Rediseño de export. "Reactivar sin código en conflicto". Mitigación de permiso parcial en UI (aceptado como consecuencia de H-3).
