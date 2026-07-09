drop trigger if exists apcc_check_rn_match_01 on public.agreement_position_client_codes;
drop function if exists public.check_rn_match_01();

create or replace function public.check_rn_match_01()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conflict_id uuid;
  v_client_code text;
  v_sku text;
begin
  select apcc.id
    into v_conflict_id
  from public.agreement_position_client_codes apcc
  where apcc.agreement_id = NEW.agreement_id
    and apcc.client_product_id = NEW.client_product_id
    and apcc.id <> NEW.id
  limit 1;

  if v_conflict_id is not null then
    select cp.client_code into v_client_code
    from public.client_products cp
    where cp.id = NEW.client_product_id;

    select p.sku into v_sku
    from public.agreement_position_client_codes apcc
    join public.agreement_positions ap on ap.id = apcc.agreement_position_id
    left join public.products p on p.id = ap.product_id
    where apcc.id = v_conflict_id;

    raise exception 'El código de cliente % ya está asignado a la posición SKU % de este acuerdo (RN-MATCH-01).',
      coalesce(v_client_code, '(sin código)'),
      coalesce(v_sku, '(sin SKU)')
      using errcode = '23505';
  end if;

  return NEW;
end;
$$;

create trigger apcc_check_rn_match_01
before insert on public.agreement_position_client_codes
for each row
execute function public.check_rn_match_01();
