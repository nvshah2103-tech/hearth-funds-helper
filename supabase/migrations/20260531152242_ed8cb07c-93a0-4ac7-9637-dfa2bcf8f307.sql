
-- 1. EXPENSE CATEGORIES
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  icon text,
  color text,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY ec_own ON public.expense_categories
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. EXPENSES
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  member_id uuid,
  date date NOT NULL,
  time time,
  amount numeric(14,2) NOT NULL,
  category text NOT NULL,
  payment_method text,
  paid_from_account_id uuid,
  paid_to_name text,
  upi_id text,
  upi_reference text,
  cheque_number text,
  note text,
  tags text[],
  is_recurring boolean NOT NULL DEFAULT false,
  recurring_frequency text,
  recurring_end_date date,
  receipt_url text,
  is_business_expense boolean NOT NULL DEFAULT false,
  gst_number text,
  receipt_number text,
  is_imported boolean NOT NULL DEFAULT false,
  import_batch_id uuid,
  fingerprint_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY ex_own ON public.expenses
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS expenses_user_date_idx ON public.expenses(user_id, date DESC);
CREATE INDEX IF NOT EXISTS expenses_user_category_idx ON public.expenses(user_id, category);
CREATE INDEX IF NOT EXISTS expenses_user_fingerprint_idx ON public.expenses(user_id, fingerprint_hash);

-- 3. master_transactions augmentation
ALTER TABLE public.master_transactions
  ADD COLUMN IF NOT EXISTS is_imported boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS import_batch_id uuid,
  ADD COLUMN IF NOT EXISTS fingerprint_hash text;

UPDATE public.master_transactions SET fingerprint_hash = fingerprint WHERE fingerprint_hash IS NULL;

-- 4. transaction_fingerprints index for bulk dedup
CREATE INDEX IF NOT EXISTS tf_user_fp_idx ON public.transaction_fingerprints(user_id, fingerprint);

-- 5. import_batches extra meta
ALTER TABLE public.import_batches
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS coverage_meta jsonb;

-- 6. Seed default expense categories for new user profiles
CREATE OR REPLACE FUNCTION public.seed_expense_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cats text[] := ARRAY[
    'Food & Dining','Groceries','Transport','Petrol','Medical',
    'Utilities','Shopping','Entertainment','Education','Household',
    'Personal Care','Other'
  ];
  i integer;
BEGIN
  FOR i IN 1..array_length(cats, 1) LOOP
    INSERT INTO public.expense_categories (user_id, name, is_default, sort_order)
    VALUES (NEW.id, cats[i], true, i)
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_categories_on_profile ON public.profiles;
CREATE TRIGGER seed_categories_on_profile
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.seed_expense_categories();

-- 7. Backfill categories for existing profiles
INSERT INTO public.expense_categories (user_id, name, is_default, sort_order)
SELECT p.id, c.name, true, c.sort_order
FROM public.profiles p
CROSS JOIN (
  VALUES
    ('Food & Dining', 1), ('Groceries', 2), ('Transport', 3), ('Petrol', 4),
    ('Medical', 5), ('Utilities', 6), ('Shopping', 7), ('Entertainment', 8),
    ('Education', 9), ('Household', 10), ('Personal Care', 11), ('Other', 12)
) AS c(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.expense_categories ec
  WHERE ec.user_id = p.id AND ec.name = c.name
);
