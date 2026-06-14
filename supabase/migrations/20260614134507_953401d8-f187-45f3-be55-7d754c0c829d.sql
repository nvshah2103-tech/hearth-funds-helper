
-- PART 1: TDS intelligence columns
ALTER TABLE public.incomes
  ADD COLUMN IF NOT EXISTS tds_section text,
  ADD COLUMN IF NOT EXISTS tds_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS gross_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS tds_section_confirmed boolean NOT NULL DEFAULT false;

UPDATE public.incomes SET gross_amount = amount WHERE gross_amount IS NULL;

ALTER TABLE public.business_incomes
  ADD COLUMN IF NOT EXISTS tds_section text,
  ADD COLUMN IF NOT EXISTS tds_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS tds_section_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tds_expected numeric(12,2);

-- PART 2: FD / MF / Stock / Gold detail columns
ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS fd_number text,
  ADD COLUMN IF NOT EXISTS branch_name text,
  ADD COLUMN IF NOT EXISTS compounding_type text,
  ADD COLUMN IF NOT EXISTS fd_type text,
  ADD COLUMN IF NOT EXISTS auto_renewal text DEFAULT 'No',
  ADD COLUMN IF NOT EXISTS nomination_details text,
  ADD COLUMN IF NOT EXISTS tenure_months integer,
  ADD COLUMN IF NOT EXISTS isin text,
  ADD COLUMN IF NOT EXISTS folio_number text,
  ADD COLUMN IF NOT EXISTS fund_type text,
  ADD COLUMN IF NOT EXISTS units numeric(18,6),
  ADD COLUMN IF NOT EXISTS nav_at_purchase numeric(14,6),
  ADD COLUMN IF NOT EXISTS symbol text,
  ADD COLUMN IF NOT EXISTS exchange text,
  ADD COLUMN IF NOT EXISTS weight_grams numeric(10,3),
  ADD COLUMN IF NOT EXISTS purity text,
  ADD COLUMN IF NOT EXISTS matured_date date;
