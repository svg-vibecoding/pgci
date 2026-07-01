UPDATE public.agreement_products
SET updated_at = now()
WHERE status <> 'excluded';