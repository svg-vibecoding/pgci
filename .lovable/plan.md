
# Paso 2 — Server functions + helpers (decisiones cerradas)

Confirmas ambas recomendaciones: **(1)** RPC `pl/pgsql` para el commit transaccional de importación, **(2)** dentro de `updateAgreement`, al cambiar vigencia, forzar recálculo con un `update` ligero sobre líneas no excluidas.

## Sub-paso 2.0 — Migración pequeña (1 RPC)

```sql
create or replace function public.commit_agreement_import(
  p_agreement_id uuid,
  p_payload      jsonb            -- { rows: [...], price_resolutions: { sku: 'applyAll'|'keepDistinct' } }
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare ...
begin
  if not public.can_admin_agreement(p_agreement_id) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  -- transacción única:
  --   1) upsert client_products por (client_id, client_code)
  --   2) insert client_product_match faltantes
  --   3) insert/update agreement_products (trigger recalcula status)
  --   4) si price_resolutions[sku] = 'applyAll', propaga a líneas existentes mismo sku
  -- devuelve { inserted, updated, byStatus, nConflictsApplied }
end$$;

grant execute on function public.commit_agreement_import(uuid, jsonb) to authenticated;
```

## Sub-paso 2.1 — Archivos nuevos

- `src/lib/agreements.schemas.ts` — esquemas Zod client-safe (`AgreementCreate`, `LinePatch`, `ImportRow`, etc.).
- `src/lib/agreements.server.ts` — helpers server-only: `assertCanAdmin`, `resolveProductBySku`, `ensureClientProduct`, `ensureMatch`, `buildLineUpdate`, `detectSkuConflicts`.
- `src/lib/agreements.functions.ts` — todas las `createServerFn` listadas en el plan anterior, importando de `.server` y `.schemas`. Todas usan `requireSupabaseAuth`.
- `src/lib/agreement-import.ts` — parser xlsx en cliente (`parseAgreementFile`, `downloadAgreementTemplate`, tipos `ParsedRow`/`PreviewBucket`/`NConflictGroup`/`ImportSummary`). Reutiliza el patrón de `pim-import.ts`.
- `src/lib/agreement-export.ts` — `exportAgreementLines(lines, preset)` con columnas del spec §15 y celdas vacías reales (mismo patrón que `product-export.ts`).

## Sub-paso 2.2 — Lista exacta de server fns

`listAgreements`, `getAgreement`, `getAgreementContext`, `listAssignableClients`, `createAgreement`, `updateAgreement` (con recálculo de líneas si cambian fechas), `setAgreementStatus`, `listAgreementLines`, `getAgreementLine`, `createAgreementLine`, `updateAgreementLine` (chequea N:1 al tocar precio), `excludeAgreementLine`, `reactivateAgreementLine`, `detectNConflict`, `applyPriceToSku`, `importAgreementLinesPreview`, `commitAgreementImport` (invoca RPC), `listAgreementMembers`, `addAgreementMember` (auto-inserta `user_client_access` con `can_create_agreements=false`), `removeAgreementMember`, `updateAgreementMember`, `listAgreementCompanies`, `addAgreementCompany`, `removeAgreementCompany`.

## Verificación al cerrar

- `tsgo` limpio (esperado: 0 errores).
- `stack_modern--invoke-server-function` contra `listAgreements` y `listAssignableClients` con la sesión inyectada, para confirmar contrato y que RLS filtra bien.

Al terminar te aviso y entramos a **Paso 3** (UI: listado + crear + detalle).
