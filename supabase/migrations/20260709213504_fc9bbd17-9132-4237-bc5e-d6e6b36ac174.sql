-- RN-MATCH-01: mover de índice único parcial a trigger que cubre el acuerdo entero
-- sin importar el status de la posición ni valid_until.

set session_replication_role = 'replica';

delete from public.agreement_position_client_codes;
delete from public.agreement_transit_client_codes;
delete from public.agreement_position_exclusions;
delete from public.agreement_positions;
delete from public.agreement_transit_lines;

set session_replication_role = 'origin';

drop index if exists public.apcc_agreement_client_product_open_uq;

create or replace function public.check_rn_match_01()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_sku text;
  v_client_code text;
begin
  select p.sku, NEW.client_code
    into v_existing_sku, v_client_code
  from public.agreement_position_client_codes apcc
  join public.agreement_positions p on p.id = apcc.position_id
  where apcc.agreement_id = NEW.agreement_id
    and apcc.client_product_id = NEW.client_product_id
    and apcc.id <> NEW.id
  limit 1;

  if found then
    raise exception 'El código de cliente % ya está asignado a la posición SKU % de este acuerdo (RN-MATCH-01).',
      coalesce(NEW.client_code, '(sin código)'),
      coalesce(v_existing_sku, '(sin SKU)')
      using errcode = '23505';
  end if;

  return NEW;
end;
$$;

drop trigger if exists apcc_check_rn_match_01 on public.agreement_position_client_codes;
create trigger apcc_check_rn_match_01
before insert on public.agreement_position_client_codes
for each row
execute function public.check_rn_match_01();
