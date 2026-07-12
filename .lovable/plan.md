## Fix 2 — RPC transaccional `create_agreement_tx` (SECURITY DEFINER)

### Contexto verificado contra el esquema real

- **`agreements.scope`**: `text` con default `'global'`. El formulario ya emite `'global'` o `'unit'` (ver `AgreementForm.scope`), y `unit_name` solo se envía cuando `scope='unit'`. Mapeo directo, sin traducción.
- **`agreement_companies`**: NO tiene `UNIQUE(agreement_id, client_id)` como constraint — tiene un **índice único parcial** `agreement_companies_open_uniq (agreement_id, client_id) WHERE valid_until IS NULL`. `INSERT ... ON CONFLICT` requiere la cláusula `ON CONFLICT (agreement_id, client_id) WHERE valid_until IS NULL DO NOTHING` para engancharlo. Lo usaremos así.
- **Trigger `trg_add_creator_as_admin`** existe (AFTER INSERT) y ya inserta al creador con `auth.uid()`. Bajo SECURITY DEFINER, `auth.uid()` sigue devolviendo el usuario autenticado del request (no el owner), porque lo determina el JWT del GUC `request.jwt.claims`, que se preserva. La salvaguarda idempotente al final cubre el caso de que el trigger falle silenciosamente.
- **RLS deadlock actual**: `agreement_companies` INSERT policy exige `can_admin_agreement(agreement_id)`, que a su vez requiere ser miembro con rol `agreement_admin` vigente sobre un cliente ya vinculado — imposible en el mismo request desde el cliente. Con `SECURITY DEFINER` la función corre como owner (postgres) y **bypasea RLS**, resolviendo el deadlock. Validamos permisos explícitamente al inicio.

### SQL de la migración

```sql
-- =========================================================================
-- create_agreement_tx: crea agreement + vincula clientes + garantiza admin
-- en una sola transacción, con validación de permisos explícita.
-- Resuelve el deadlock de RLS al crear acuerdos como platform_user.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.create_agreement_tx(
  p_name           text,
  p_scope          text,
  p_unit_name      text,
  p_start_date     date,
  p_end_date       date,
  p_observations   text,
  p_group_id       uuid,
  p_client_ids     uuid[]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cid uuid;
  v_agreement_id uuid;
  v_clients uuid[];
BEGIN
  -- 1) Sesión válida
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING errcode = '42501';
  END IF;

  -- 2) Autorización global
  IF NOT (public.is_super_admin() OR public.can_create_agreements()) THEN
    RAISE EXCEPTION 'No tienes permiso para crear acuerdos' USING errcode = '42501';
  END IF;

  -- 3) Deduplicar y validar lista de clientes
  SELECT COALESCE(array_agg(DISTINCT c), '{}') INTO v_clients
    FROM unnest(COALESCE(p_client_ids, '{}'::uuid[])) AS c
   WHERE c IS NOT NULL;

  IF array_length(v_clients, 1) IS NULL THEN
    RAISE EXCEPTION 'Debes indicar al menos un cliente cubierto'
      USING errcode = '22023';
  END IF;

  -- 4) Permiso por cada cliente
  FOREACH v_cid IN ARRAY v_clients LOOP
    IF NOT public.can_create_agreements_for_client(v_cid) THEN
      RAISE EXCEPTION 'Sin permiso para crear acuerdos para el cliente %', v_cid
        USING errcode = '42501';
    END IF;
  END LOOP;

  -- 5) Validar scope
  IF p_scope NOT IN ('global', 'unit') THEN
    RAISE EXCEPTION 'scope inválido: %', p_scope USING errcode = '22023';
  END IF;
  IF p_scope = 'unit' AND (p_unit_name IS NULL OR btrim(p_unit_name) = '') THEN
    RAISE EXCEPTION 'unit_name es obligatorio cuando scope = unit'
      USING errcode = '22023';
  END IF;

  -- 6) Insertar acuerdo (dispara trg_add_creator_as_admin)
  INSERT INTO public.agreements
    (name, scope, unit_name, start_date, end_date, observations, group_id, created_by)
  VALUES
    (btrim(p_name),
     p_scope,
     CASE WHEN p_scope = 'unit' THEN btrim(p_unit_name) ELSE NULL END,
     p_start_date, p_end_date, p_observations, p_group_id, v_uid)
  RETURNING id INTO v_agreement_id;

  -- 7) Vincular clientes (idempotente contra el índice parcial abierto)
  FOREACH v_cid IN ARRAY v_clients LOOP
    INSERT INTO public.agreement_companies
      (agreement_id, client_id, started_by, linked_by)
    VALUES
      (v_agreement_id, v_cid, v_uid, v_uid)
    ON CONFLICT (agreement_id, client_id) WHERE (valid_until IS NULL) DO NOTHING;
  END LOOP;

  -- 8) Salvaguarda idempotente del admin (el trigger ya lo hizo; esto cubre
  --    cualquier condición de borde sin duplicar).
  INSERT INTO public.agreement_members
    (agreement_id, user_id, role, assigned_by, started_by)
  VALUES
    (v_agreement_id, v_uid, 'agreement_admin', v_uid, v_uid)
  ON CONFLICT (agreement_id, user_id) WHERE (valid_until IS NULL) DO NOTHING;

  RETURN v_agreement_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_agreement_tx(
  text, text, text, date, date, text, uuid, uuid[]
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_agreement_tx(
  text, text, text, date, date, text, uuid, uuid[]
) TO authenticated;
```

Nota: verificaré que exista el índice `UNIQUE (agreement_id, user_id) WHERE valid_until IS NULL` en `agreement_members` antes de aplicar (el código actual ya usa el mismo `ON CONFLICT` en la línea 273-285, así que existe). Si no existiera, ajustaría el paso 8 a un `IF NOT EXISTS`.

### Cambio en `src/lib/agreements.functions.ts` (`createAgreement`)

Reemplazar el bloque de pasos 3–5 (inserts sueltos de agreement + agreement_companies + agreement_members) por una sola llamada RPC. Se conserva:
- Paso 1: chequeo `can_create_agreements` (opcional, redundante — la RPC ya valida, pero da mensaje inmediato).
- Paso 2: resolución/creación del `group_id` (queda igual, ya funciona porque los inserts en `agreement_groups` no dependen de admin del acuerdo).

Nuevo bloque 3–5:

```ts
// 3) Resolver clientes iniciales
const companyIds = data.client_id
  ? [data.client_id]
  : data.company_ids ?? [];
if (companyIds.length === 0) {
  throw new Error("Debes indicar al menos un cliente cubierto.");
}

// 4) Crear acuerdo + vincular clientes + registrar admin en una sola transacción
const { data: newId, error } = await context.supabase.rpc("create_agreement_tx", {
  p_name: data.name,
  p_scope: data.scope,
  p_unit_name: data.unit_name ?? null,
  p_start_date: data.start_date ?? null,
  p_end_date: data.end_date ?? null,
  p_observations: data.observations ?? null,
  p_group_id: groupId,
  p_client_ids: companyIds,
});
if (error) throw new Error(`No se pudo crear el acuerdo: ${error.message}`);
return { agreement_id: newId as string };
```

Se elimina el import de `assertCanCreateForClient` si deja de usarse en el archivo (la RPC valida en servidor).

### Notas finales

- `auth.uid()` en SECURITY DEFINER: se resuelve desde `request.jwt.claims` (GUC de sesión), NO desde el owner. Por eso funciona tanto en la RPC como dentro del trigger `add_creator_as_admin` que se dispara desde ella.
- La RPC es atómica: si cualquier paso falla, PostgreSQL revierte todo (incluida la inserción del acuerdo y los inserts del trigger).
- No cambia el schema — solo agrega función. Sin GRANTs de tabla nuevos.

¿Aplico?