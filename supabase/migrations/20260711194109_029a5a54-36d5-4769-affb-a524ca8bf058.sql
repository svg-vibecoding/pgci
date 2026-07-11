
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
  v_domain_total bigint;
  v_profiles_count bigint;
  v_users_count bigint;
BEGIN
  SELECT id INTO v_keep FROM auth.users WHERE email = 'sergio.velez@sumatec.co';
  IF v_keep IS NULL THEN
    RAISE EXCEPTION 'No se encontró el usuario a preservar (sergio.velez@sumatec.co). Aborta.';
  END IF;

  DELETE FROM public.profiles WHERE user_id <> v_keep;
  DELETE FROM auth.users      WHERE id      <> v_keep;

  SELECT
      (SELECT count(*) FROM public.clients)
    + (SELECT count(*) FROM public.client_companies)
    + (SELECT count(*) FROM public.client_products)
    + (SELECT count(*) FROM public.client_product_history)
    + (SELECT count(*) FROM public.client_product_match)
    + (SELECT count(*) FROM public.products)
    + (SELECT count(*) FROM public.product_history)
    + (SELECT count(*) FROM public.agreements)
    + (SELECT count(*) FROM public.agreement_groups)
    + (SELECT count(*) FROM public.agreement_group_members)
    + (SELECT count(*) FROM public.agreement_members)
    + (SELECT count(*) FROM public.agreement_companies)
    + (SELECT count(*) FROM public.agreement_positions)
    + (SELECT count(*) FROM public.agreement_position_client_codes)
    + (SELECT count(*) FROM public.agreement_position_price_history)
    + (SELECT count(*) FROM public.agreement_position_exclusions)
    + (SELECT count(*) FROM public.agreement_position_alternatives)
    + (SELECT count(*) FROM public.agreement_costs)
    + (SELECT count(*) FROM public.agreement_sku_links)
    + (SELECT count(*) FROM public.agreement_change_requests)
    + (SELECT count(*) FROM public.user_client_access)
    INTO v_domain_total;

  SELECT count(*) INTO v_profiles_count FROM public.profiles;
  SELECT count(*) INTO v_users_count    FROM auth.users;

  RAISE NOTICE 'Filas totales en tablas de dominio tras vaciado: %', v_domain_total;
  RAISE NOTICE 'profiles restantes: % (esperado 1)', v_profiles_count;
  RAISE NOTICE 'auth.users restantes: % (esperado 1)', v_users_count;
END $$;

COMMIT;
