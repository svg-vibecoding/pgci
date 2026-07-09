CREATE OR REPLACE VIEW public.agreements_with_counts
WITH (security_invoker = true) AS
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
          WHERE am.agreement_id = a.id AND am.user_id = auth.uid() AND am.valid_until IS NULL
         LIMIT 1) AS my_role,
    COALESCE(counts.total, 0::bigint) AS lines_total,
    COALESCE(counts.active, 0::bigint) AS lines_active,
    COALESCE(counts.pending, 0::bigint) AS lines_pending,
    COALESCE(counts.review, 0::bigint) AS lines_review,
    COALESCE(counts.excluded, 0::bigint) AS lines_excluded,
    COALESCE(( SELECT count(*) AS count
           FROM agreement_members am2
          WHERE am2.agreement_id = a.id AND am2.valid_until IS NULL), 0::bigint) AS members_count,
    COALESCE(( SELECT count(*) AS count
           FROM agreement_companies ac
          WHERE ac.agreement_id = a.id AND ac.valid_until IS NULL), 0::bigint) AS companies_count
   FROM agreements a
     LEFT JOIN agreement_groups g ON g.id = a.group_id
     LEFT JOIN clients gc ON gc.id = g.client_id
     LEFT JOIN LATERAL ( SELECT count(*) FILTER (WHERE agreement_positions.status <> 'excluded'::text) AS total,
            count(*) FILTER (WHERE agreement_positions.status = 'active'::text) AS active,
            count(*) FILTER (WHERE agreement_positions.status = 'pending'::text) AS pending,
            count(*) FILTER (WHERE agreement_positions.status = 'requires_review'::text) AS review,
            count(*) FILTER (WHERE agreement_positions.status = 'excluded'::text) AS excluded
           FROM agreement_positions
          WHERE agreement_positions.agreement_id = a.id) counts ON true;