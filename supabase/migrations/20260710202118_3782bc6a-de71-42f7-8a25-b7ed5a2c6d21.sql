create or replace function public.capture_product_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_in_radar boolean;
  v_changed boolean;
  v_open_id uuid;
begin
  v_changed :=
       OLD.erp_description        is distinct from NEW.erp_description
    or OLD.erp_brand               is distinct from NEW.erp_brand
    or OLD.commercial_description  is distinct from NEW.commercial_description
    or OLD.commercial_brand        is distinct from NEW.commercial_brand
    or OLD.brand_reference         is distinct from NEW.brand_reference;

  if not v_changed then
    return NEW;
  end if;

  select exists (
    select 1 from public.agreement_positions where product_id = NEW.id
  ) into v_in_radar;

  if not v_in_radar then
    return NEW;
  end if;

  select id into v_open_id
    from public.product_history
   where product_id = NEW.id and valid_until is null
   limit 1;

  if v_open_id is null then
    insert into public.product_history (
      product_id, erp_description, erp_brand,
      commercial_description, commercial_brand, brand_reference,
      valid_from, valid_until
    ) values (
      NEW.id, OLD.erp_description, OLD.erp_brand,
      OLD.commercial_description, OLD.commercial_brand, OLD.brand_reference,
      current_date, current_date
    );
  else
    update public.product_history
       set valid_until = current_date
     where id = v_open_id;
  end if;

  insert into public.product_history (
    product_id, erp_description, erp_brand,
    commercial_description, commercial_brand, brand_reference,
    valid_from, valid_until
  ) values (
    NEW.id, NEW.erp_description, NEW.erp_brand,
    NEW.commercial_description, NEW.commercial_brand, NEW.brand_reference,
    current_date, null
  );

  return NEW;
end;
$$;

drop trigger if exists products_capture_history on public.products;
create trigger products_capture_history
after update on public.products
for each row
execute function public.capture_product_history();
