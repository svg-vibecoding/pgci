DROP VIEW IF EXISTS public.agreements_with_counts;
CREATE VIEW public.agreements_with_counts AS
SELECT a.id, a.client_id, a.name, a.scope, a.unit_name, a.status, a.start_date, a.end_date,
       a.observations, a.created_at, a.updated_at, a.created_by,
       c.commercial_name AS client_commercial_name,
       c.legal_name AS client_legal_name,
       c.tax_id AS client_tax_id,
       (SELECT am.role FROM agreement_members am
         WHERE am.agreement_id = a.id AND am.user_id = auth.uid() LIMIT 1) AS my_role,
       COALESCE(counts.total, 0::bigint) AS lines_total,
       COALESCE(counts.active, 0::bigint) AS lines_active,
       COALESCE(counts.pending, 0::bigint) AS lines_pending,
       COALESCE(counts.review, 0::bigint) AS lines_review,
       COALESCE(counts.excluded, 0::bigint) AS lines_excluded
FROM agreements a
JOIN clients c ON c.id = a.client_id
LEFT JOIN LATERAL (
  SELECT count(*) FILTER (WHERE agreement_products.status <> 'excluded'::text) AS total,
         count(*) FILTER (WHERE agreement_products.status = 'active'::text) AS active,
         count(*) FILTER (WHERE agreement_products.status = 'pending'::text) AS pending,
         count(*) FILTER (WHERE agreement_products.status = 'requires_review'::text) AS review,
         count(*) FILTER (WHERE agreement_products.status = 'excluded'::text) AS excluded
  FROM agreement_products WHERE agreement_products.agreement_id = a.id
) counts ON true;
GRANT SELECT ON public.agreements_with_counts TO authenticated;
GRANT ALL ON public.agreements_with_counts TO service_role;