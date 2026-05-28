
-- 1. master_transactions: raw bank statement rows
CREATE TABLE public.master_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bank_account_id uuid NOT NULL,
  txn_date date NOT NULL,
  description text NOT NULL,
  debit numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0,
  balance numeric,
  reference_no text,
  source text NOT NULL DEFAULT 'pdf',
  fingerprint text NOT NULL,
  is_broker_payout boolean NOT NULL DEFAULT false,
  linked_broker_txn_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_transactions TO authenticated;
GRANT ALL ON public.master_transactions TO service_role;
ALTER TABLE public.master_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY mt_own ON public.master_transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_mt_user_acct_date ON public.master_transactions(user_id, bank_account_id, txn_date DESC);

-- 2. transaction_fingerprints: dedupe key
CREATE TABLE public.transaction_fingerprints (
  fingerprint text NOT NULL,
  user_id uuid NOT NULL,
  transaction_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, fingerprint)
);
GRANT SELECT, INSERT, DELETE ON public.transaction_fingerprints TO authenticated;
GRANT ALL ON public.transaction_fingerprints TO service_role;
ALTER TABLE public.transaction_fingerprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY tf_own ON public.transaction_fingerprints FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. import_batches: audit log
CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid,
  source_type text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  transactions_found integer NOT NULL DEFAULT 0,
  transactions_imported integer NOT NULL DEFAULT 0,
  transactions_skipped integer NOT NULL DEFAULT 0,
  coverage_from_date date,
  coverage_to_date date,
  notes text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY ib_own ON public.import_batches FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. sft_entries: AIS high-value events
CREATE TABLE public.sft_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'AIS',
  sft_type text NOT NULL,
  counterparty_name text,
  amount numeric NOT NULL DEFAULT 0,
  txn_date date,
  fy text,
  raw_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sft_entries TO authenticated;
GRANT ALL ON public.sft_entries TO service_role;
ALTER TABLE public.sft_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY sft_own ON public.sft_entries FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. broker_connections: encrypted API keys
CREATE TABLE public.broker_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  broker_name text NOT NULL,
  encrypted_api_key text NOT NULL,
  encrypted_api_secret text NOT NULL,
  extra_meta jsonb,
  last_synced_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, broker_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broker_connections TO authenticated;
GRANT ALL ON public.broker_connections TO service_role;
ALTER TABLE public.broker_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY bc_own ON public.broker_connections FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. broker_transactions: holdings + trades
CREATE TABLE public.broker_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  broker_name text NOT NULL,
  trade_date date NOT NULL,
  symbol text,
  segment text,
  transaction_type text,
  quantity numeric DEFAULT 0,
  price numeric DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  is_payout boolean NOT NULL DEFAULT false,
  linked_bank_transaction_id uuid,
  raw_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broker_transactions TO authenticated;
GRANT ALL ON public.broker_transactions TO service_role;
ALTER TABLE public.broker_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY bt_own ON public.broker_transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_bt_user_date ON public.broker_transactions(user_id, trade_date DESC);

-- 7. Extend bank_accounts
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS last_imported_until timestamptz,
  ADD COLUMN IF NOT EXISTS import_password_hint text,
  ADD COLUMN IF NOT EXISTS known_broker_account boolean NOT NULL DEFAULT false;
