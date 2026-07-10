
CREATE OR REPLACE FUNCTION public.position_covers_today(
  p_status text,
  p_pos_end date,
  p_agr_end date
) RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p_status = 'active'
     AND (COALESCE(p_pos_end, p_agr_end) IS NULL
          OR COALESCE(p_pos_end, p_agr_end) >= current_date);
$$;

DROP VIEW IF EXISTS public.agreements_with_counts;

CREATE VIEW public.agreements_with_counts AS
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
    COALESCE(( SELECT count(*) FROM agreement_members am2
                WHERE am2.agreement_id = a.id AND am2.valid_until IS NULL), 0::bigint) AS members_count,
    COALESCE(( SELECT count(*) FROM agreement_companies ac
                WHERE ac.agreement_id = a.id AND ac.valid_until IS NULL), 0::bigint) AS companies_count
   FROM agreements a
     LEFT JOIN agreement_groups g ON g.id = a.group_id
     LEFT JOIN clients gc ON gc.id = g.client_id
     LEFT JOIN LATERAL (
        SELECT
          count(*) FILTER (WHERE ap.status NOT IN ('excluded','archived')) AS total,
          count(*) FILTER (WHERE public.position_covers_today(ap.status, ap.end_date, a.end_date)) AS active,
          count(*) FILTER (WHERE ap.status = 'requires_review') AS review,
          count(*) FILTER (WHERE ap.status = 'excluded') AS excluded,
          count(*) FILTER (WHERE ap.status = 'draft') AS draft,
          count(*) FILTER (WHERE ap.status = 'archived') AS archived,
          count(*) FILTER (WHERE ap.status = 'active' AND NOT public.position_covers_today(ap.status, ap.end_date, a.end_date)) AS expired
        FROM agreement_positions ap
        WHERE ap.agreement_id = a.id
     ) counts ON true;

GRANT SELECT ON public.agreements_with_counts TO authenticated;
GRANT ALL ON public.agreements_with_counts TO service_role;
