CREATE OR REPLACE VIEW public.agreements_with_counts AS
SELECT a.id,
    a.group_id,
    g.group_name,
    g.client_id AS group_client_id,
    gc.commercial_name AS group_client_commercial_name,
    gc.legal_name AS group_client_legal_name,
    gc.tax_id AS group_client_tax_id,
    a.name,
    a.scope,
    a.unit_name,
    a.status,
    a.start_date,
    a.end_date,
    a.observations,
    a.created_at,
    a.updated_at,
    a.created_by,
    ( SELECT am.role
        FROM agreement_members am
       WHERE am.agreement_id = a.id AND am.user_id = auth.uid()
       LIMIT 1) AS my_role,
    COALESCE(counts.total, 0::bigint) AS lines_total,
    COALESCE(counts.active, 0::bigint) AS lines_active,
    COALESCE(counts.pending, 0::bigint) AS lines_pending,
    COALESCE(counts.review, 0::bigint) AS lines_review,
    COALESCE(counts.excluded, 0::bigint) AS lines_excluded,
    COALESCE(( SELECT count(*) FROM agreement_members am2 WHERE am2.agreement_id = a.id), 0::bigint) AS members_count,
    COALESCE(( SELECT count(*) FROM agreement_companies ac WHERE ac.agreement_id = a.id), 0::bigint) AS companies_count
   FROM agreements a
     LEFT JOIN agreement_groups g ON g.id = a.group_id
     LEFT JOIN clients gc ON gc.id = g.client_id
     LEFT JOIN LATERAL (
       SELECT count(*) FILTER (WHERE agreement_products.status <> 'excluded') AS total,
              count(*) FILTER (WHERE agreement_products.status = 'active') AS active,
              count(*) FILTER (WHERE agreement_products.status = 'pending') AS pending,
              count(*) FILTER (WHERE agreement_products.status = 'requires_review') AS review,
              count(*) FILTER (WHERE agreement_products.status = 'excluded') AS excluded
       FROM agreement_products
       WHERE agreement_products.agreement_id = a.id
     ) counts ON true;

GRANT SELECT ON public.agreements_with_counts TO authenticated;
GRANT ALL ON public.agreements_with_counts TO service_role;