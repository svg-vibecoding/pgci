## Objetivo

Vaciar todos los datos de dominio y también eliminar todos los usuarios excepto `sergio.velez@sumatec.co`. Sin cambios de esquema.

## Alcance

- Preservar: únicamente el usuario `sergio.velez@sumatec.co` (su fila en `auth.users` y su `profiles`).
- Eliminar: todo el resto de `profiles` y `auth.users`.
- Vaciar: todo el dominio (catálogo, acuerdos, posiciones, códigos, historia, accesos, matching, change requests, empresas del cliente).

## Orden de ejecución en la migración

Una sola transacción con `session_replication_role = replica` para saltar triggers de guardia (p. ej. `prevent_last_agreement_admin_removal`, `prevent_last_group_admin_removal`, historia de producto).

1. **TRUNCATE de dominio** (`RESTART IDENTITY CASCADE`) sobre las raíces y tablas asociadas — hecho primero para que no queden FKs apuntando a perfiles/usuarios que vamos a borrar:
   - `agreement_change_requests`, `agreement_costs`, `agreement_position_alternatives`, `agreement_position_exclusions`, `agreement_position_price_history`, `agreement_position_client_codes`, `agreement_positions`, `agreement_sku_links`, `agreement_companies`, `agreement_members`, `agreement_group_members`, `agreement_groups`, `agreements`, `client_product_match`, `client_product_history`, `client_products`, `client_companies`, `user_client_access`, `product_history`, `products`, `clients`.

2. **Resolver el `user_id` a preservar** desde `auth.users` por email (`sergio.velez@sumatec.co`). Si no existe, la migración aborta con un `RAISE EXCEPTION` claro para no dejar el sistema sin usuarios.

3. **Borrar `public.profiles`** de todos los usuarios distintos al preservado.

4. **Borrar `auth.users`** de todos los usuarios distintos al preservado. Esto elimina también sus `auth.identities`, sesiones y refresh tokens vía las FKs internas del esquema `auth`. Como el dominio ya está vacío en el paso 1, no habrá FKs colgando desde `public.*`.

## Detalles técnicos

```sql
BEGIN;
SET LOCAL session_replication_role = replica;

TRUNCATE TABLE
  public.agreement_change_requests,
  public.agreement_costs,
  public.agreement_position_alternatives,
  public.agreement_position_exclusions,
  public.agreement_position_price_history,
  public.agreement_position_client_codes,
  public.agreement_positions,
  public.agreement_sku_links,
  public.agreement_companies,
  public.agreement_members,
  public.agreement_group_members,
  public.agreement_groups,
  public.agreements,
  public.client_product_match,
  public.client_product_history,
  public.client_products,
  public.client_companies,
  public.user_client_access,
  public.product_history,
  public.products,
  public.clients
RESTART IDENTITY CASCADE;

DO $$
DECLARE
  v_keep uuid;
BEGIN
  SELECT id INTO v_keep FROM auth.users WHERE email = 'sergio.velez@sumatec.co';
  IF v_keep IS NULL THEN
    RAISE EXCEPTION 'No se encontró el usuario a preservar (sergio.velez@sumatec.co). Aborta.';
  END IF;

  DELETE FROM public.profiles WHERE user_id <> v_keep;
  DELETE FROM auth.users      WHERE id      <> v_keep;
END $$;

-- verificación con RAISE NOTICE de conteos
COMMIT;
```

## Riesgos y mitigaciones

- **Guardia "último admin"**: los triggers de `agreement_members` / `agreement_group_members` podrían bloquear el borrado; `session_replication_role = replica` los desactiva durante la migración.
- **FKs a `auth.users` desde el dominio**: todas quedan huérfanas cero porque el TRUNCATE del paso 1 ya vació el dominio antes de tocar `auth`.
- **Historia de auth (sesiones/refresh tokens/identidades)**: se limpia sola vía las FKs internas de `auth` al borrar `auth.users`.
- **Usuario a preservar no existe**: la migración aborta antes de borrar nada de `auth`/`profiles` gracias al `RAISE EXCEPTION`.

## Fuera de alcance

- No `DROP` / `ALTER` de estructura.
- No se toca el perfil ni la fila `auth.users` de `sergio.velez@sumatec.co`.
- No se re-siembra ningún dato.

## Confirmación

Al aprobar y correr la migración, te reporto conteos por tabla del dominio (esperado: 0), el conteo de `profiles` (esperado: 1) y el conteo de `auth.users` (esperado: 1).
