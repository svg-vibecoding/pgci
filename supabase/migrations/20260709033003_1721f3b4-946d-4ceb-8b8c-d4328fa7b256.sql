BEGIN;

ALTER TABLE public.agreement_members
  DISABLE TRIGGER prevent_last_agreement_admin_removal_trigger;
ALTER TABLE public.agreement_group_members
  DISABLE TRIGGER trg_prevent_last_group_admin_removal;

DELETE FROM public.agreement_position_price_history;
DELETE FROM public.agreement_position_exclusions;
DELETE FROM public.agreement_position_alternatives;

DELETE FROM public.agreement_positions;
DELETE FROM public.agreement_transit_lines;

DELETE FROM public.agreement_sku_links;
DELETE FROM public.agreement_costs;
DELETE FROM public.agreement_change_requests;
DELETE FROM public.agreement_companies;
DELETE FROM public.agreement_members;

DELETE FROM public.agreements;

DELETE FROM public.agreement_group_members;
DELETE FROM public.agreement_groups;

DELETE FROM public.client_product_match;
DELETE FROM public.client_product_history;
DELETE FROM public.client_products;

DELETE FROM public.user_client_access;

DELETE FROM public.profiles
 WHERE email <> 'sergio.velez@sumatec.co';

ALTER TABLE public.agreement_members
  ENABLE TRIGGER prevent_last_agreement_admin_removal_trigger;
ALTER TABLE public.agreement_group_members
  ENABLE TRIGGER trg_prevent_last_group_admin_removal;

COMMIT;