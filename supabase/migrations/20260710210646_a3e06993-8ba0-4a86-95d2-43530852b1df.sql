
-- 1. Truncate test data in dependency order
TRUNCATE TABLE
  public.agreement_position_client_codes,
  public.agreement_position_price_history,
  public.agreement_position_exclusions,
  public.agreement_costs,
  public.agreement_position_alternatives,
  public.agreement_positions,
  public.agreement_transit_client_codes,
  public.agreement_transit_lines
  RESTART IDENTITY CASCADE;

-- 2. Expand status CHECK and change default
ALTER TABLE public.agreement_positions
  DROP CONSTRAINT IF EXISTS agreement_positions_status_check;

ALTER TABLE public.agreement_positions
  ADD CONSTRAINT agreement_positions_status_check
  CHECK (status IN ('draft','active','requires_review','excluded','archived'));

ALTER TABLE public.agreement_positions
  ALTER COLUMN status SET DEFAULT 'draft';

-- 3. Add new columns
ALTER TABLE public.agreement_positions
  ADD COLUMN published_at   timestamptz,
  ADD COLUMN published_by   uuid REFERENCES auth.users(id),
  ADD COLUMN sku_raw        text,
  ADD COLUMN description    text,
  ADD COLUMN pending_reason text;

-- 4. product_id nullable
ALTER TABLE public.agreement_positions
  ALTER COLUMN product_id DROP NOT NULL;

-- 5. sale_price nullable
ALTER TABLE public.agreement_positions
  ALTER COLUMN sale_price DROP NOT NULL;
