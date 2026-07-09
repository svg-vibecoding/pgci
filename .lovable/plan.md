## Corregir trigger `apcc_check_rn_match_01`

Tu plan está correcto y completo. Los tres defectos son reales (verificados contra el schema: la columna es `agreement_position_id`, `client_code` vive en `client_products`, y el trigger quedó como `INSERT OR UPDATE`). Lo implemento tal cual, con un par de detalles menores de robustez:

### Migración única

1. `DROP TRIGGER IF EXISTS apcc_check_rn_match_01 ON public.agreement_position_client_codes;`
2. `DROP FUNCTION IF EXISTS public.check_rn_match_01();`
3. Recrear `public.check_rn_match_01()`:
   - `SELECT apcc.id INTO v_conflict_id FROM public.agreement_position_client_codes apcc WHERE apcc.agreement_id = NEW.agreement_id AND apcc.client_product_id = NEW.client_product_id AND apcc.id <> NEW.id LIMIT 1;`
   - `IF v_conflict_id IS NOT NULL THEN` resolver en subqueries:
     - `client_code` desde `client_products` por `NEW.client_product_id`
     - `sku` desde `agreement_positions ap LEFT JOIN products p ON p.id = ap.product_id` donde `ap.id = (select agreement_position_id from agreement_position_client_codes where id = v_conflict_id)`
   - `RAISE EXCEPTION 'El código de cliente % ya está asignado a la posición SKU % de este acuerdo (RN-MATCH-01).', ..., ... USING ERRCODE = '23505';`
   - `RETURN NEW;`
   - Mantener `SECURITY DEFINER` + `SET search_path = public` (consistente con las demás funciones del proyecto y evita depender del search_path del caller).
4. Recrear trigger **solo** `BEFORE INSERT`:
   ```sql
   CREATE TRIGGER apcc_check_rn_match_01
   BEFORE INSERT ON public.agreement_position_client_codes
   FOR EACH ROW EXECUTE FUNCTION public.check_rn_match_01();
   ```

### Mejoras menores que sugiero sumar

- **`LIMIT 1`** en el SELECT de conflicto: barato y explícito, evita cualquier warning de "more than one row" si en el futuro cambia algo.
- **Mantener `SECURITY DEFINER` + `SET search_path = public`** en vez de dejar la función como `SECURITY INVOKER` (que es el default del snippet de referencia). Razón: consistente con el resto de funciones del módulo y hace el trigger inmune a un search_path manipulado.
- **`coalesce(..., '(sin código)')` / `coalesce(..., '(sin SKU)')`** en el mensaje, por si la posición conflictiva es una posición sin producto vinculado (SKU nulo es válido en `agreement_positions`).

### Verificación post-migración

- `SELECT tgtype FROM pg_trigger WHERE tgname = 'apcc_check_rn_match_01';` → debe devolver `5` (BEFORE + ROW + INSERT), no `7`.
- `SELECT count(*) FROM pg_indexes WHERE indexname = 'apcc_agreement_client_product_open_uq';` → sigue en `0`.
- `SELECT count(*) FROM pg_indexes WHERE indexname = 'apcc_position_client_open_uq';` → sigue en `1` (intacto).

### Qué NO se toca

- `exclude_agreement_position`, `reactivate_agreement_position`, `create_agreement_line`, `update_agreement_line`: sin cambios (siguiente paso según tu instrucción anterior).
- RLS, GRANT, índice `apcc_position_client_open_uq`: intactos.
