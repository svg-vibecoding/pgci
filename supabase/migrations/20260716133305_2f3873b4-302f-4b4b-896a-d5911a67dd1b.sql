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
          WHERE am.agreement_id = a.id AND am.user_id = auth.uid() AND am.valid_until IS NULL
         LIMIT 1) AS my_role,
    COALESCE(counts.total, 0::bigint) AS lines_total,
    COALESCE(counts.active, 0::bigint) AS lines_active,
    COALESCE(counts.review, 0::bigint) AS lines_review,
    COALESCE(counts.excluded, 0::bigint) AS lines_excluded,
    COALESCE(counts.draft, 0::bigint) AS lines_draft,
    COALESCE(counts.archived, 0::bigint) AS lines_archived,
    COALESCE(counts.expired, 0::bigint) AS lines_expired,
    COALESCE(( SELECT count(*) AS count
           FROM agreement_members am2
          WHERE am2.agreement_id = a.id AND am2.valid_until IS NULL), 0::bigint) AS members_count,
    COALESCE(( SELECT count(*) AS count
           FROM agreement_companies ac
          WHERE ac.agreement_id = a.id AND ac.valid_until IS NULL), 0::bigint) AS companies_count
   FROM agreements a
     LEFT JOIN agreement_groups g ON g.id = a.group_id
     LEFT JOIN clients gc ON gc.id = g.client_id
     LEFT JOIN LATERAL ( SELECT count(*) FILTER (WHERE ap.status <> ALL (ARRAY['excluded'::text, 'archived'::text])) AS total,
            count(*) FILTER (WHERE position_covers_today(ap.status, ap.end_date, a.end_date)) AS active,
            count(*) FILTER (WHERE ap.status = 'requires_review'::text) AS review,
            count(*) FILTER (WHERE ap.status = 'excluded'::text) AS excluded,
            count(*) FILTER (WHERE ap.status = 'draft'::text) AS draft,
            count(*) FILTER (WHERE ap.status = 'archived'::text) AS archived,
            count(*) FILTER (
              WHERE ap.status IN ('active','requires_review')
                AND COALESCE(ap.end_date, a.end_date) IS NOT NULL
                AND COALESCE(ap.end_date, a.end_date) < current_date
            ) AS expired
           FROM agreement_positions ap
          WHERE ap.agreement_id = a.id) counts ON true;