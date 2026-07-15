## Diagnóstico

Al crear una posición con "Publicar en acuerdo al guardar" marcado, el paso de publicación **no se ejecuta**. La posición queda en `draft` sin toast de error, sin rastro.

Causa raíz — desalineación entre el retorno del RPC y el tipo TS:

- `create_agreement_line` (Postgres) devuelve `jsonb_build_object('position_id', v_line_id)` — clave `position_id`.
- `CreateAgreementLineResult` en `src/lib/agreements.functions.ts:559` declara `{ line_id, kind }`. No hay runtime check.
- `LineEditDialog.tsx:1519` lee `(saveRes as { line_id? }).line_id` → `undefined` → `targetId = null`.
- El guard de `LineEditDialog.tsx:1527` (`publishOnSave && canPublishNow && targetId && !saveBlocked`) es falso porque `targetId` es null → **`publishFn` nunca se llama**. Silencioso: no hay toast de fallo porque el flujo cree que no había que publicar.

En edición no ocurre porque `targetId = initial!.line_id!` (viene del prop, no del retorno del RPC).

La validación cliente (`canPublishNow`) y el RPC `publish_positions` son correctos. No hay que tocar reglas ni backend.

## Cambios

**1. `src/lib/agreements.functions.ts` — alinear tipo al contrato real del RPC**

- `CreateAgreementLineResult`: cambiar `line_id: string` por `position_id: string`. Quitar `kind` (el RPC no lo devuelve; `kind` es un discriminador de UI que no aplica al crear posiciones — todas nacen `position`).

**2. `src/components/agreements/LineEditDialog.tsx` — leer la clave correcta**

- Línea 1519: `targetId = (saveRes as { position_id?: string } | null)?.position_id ?? null`.
- Línea 1565 (`r?.kind === "transit"` en la rama create de `isPending`): al crear no hay `transit`; la posición nace `draft`. Sustituir por `isPending = isCreate ? false : (!!r?.transit_id && !isPromotion)`. El toast "pendiente" en creación ya no aplica (cuando falta algo, la publicación falla y cae al toast de `publishFailed`; cuando el usuario no marcó publicar, cae al toast "Registro creado en gestión" existente).

Ningún otro consumidor de `CreateAgreementLineResult` lee `line_id`/`kind` — verificado con búsqueda antes de escribir el parche.

## Validación

Reproducir el caso en preview:
- SKU válido activo, precio > 0, fechas vigentes, marcar "Publicar al guardar" → se espera toast "Posición creada y publicada" y estado `active` en la lista.
- Igual pero con precio 0 → checkbox se desactiva solo (`canPublishNow=false`), botón dice "Guardar", cae a `draft` (comportamiento actual, correcto).
- Igual pero con SKU inactivo → checkbox activo (validación cliente no lo detecta), publish RPC devuelve `not_publishable` con `reason=sku_inactive` → toast "No se pudo publicar: sku_inactive". Posición queda `requires_review` según trigger. Este flanco existe hoy y sigue igual — fuera de alcance ampliar la validación cliente por estado de SKU salvo que lo pidas.

## Fuera de alcance

- RPC `publish_positions`, `create_agreement_line`, triggers de estado, RN-MATCH-01, guardián de identidad, buscador de SKU, modelo de estados.
- Añadir validación cliente de `status` de producto (el catálogo ya trae `status` en el lookup — se puede sumar en otra iteración si lo pides explícitamente).