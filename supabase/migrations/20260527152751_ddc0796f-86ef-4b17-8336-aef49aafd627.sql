
-- profiles for onboarding status
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  family_name TEXT,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "p_own_sel" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "p_own_ins" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "p_own_upd" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- auto create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id);
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- members
CREATE TABLE public.members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_business BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT ALL ON public.members TO service_role;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "m_own" ON public.members FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- bank accounts
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank_name TEXT,
  account_type TEXT NOT NULL DEFAULT 'Savings',
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ba_own" ON public.bank_accounts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- credit cards
CREATE TABLE public.credit_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank_name TEXT,
  member_id UUID REFERENCES public.members ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_cards TO authenticated;
GRANT ALL ON public.credit_cards TO service_role;
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cc_own" ON public.credit_cards FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- emis (loans)
CREATE TABLE public.emis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  lender TEXT,
  total_loan_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  emi_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  due_day INT NOT NULL DEFAULT 1,
  start_date DATE,
  end_date DATE,
  bank_account_id UUID REFERENCES public.bank_accounts ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emis TO authenticated;
GRANT ALL ON public.emis TO service_role;
ALTER TABLE public.emis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "e_own" ON public.emis FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.emi_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  emi_id UUID NOT NULL REFERENCES public.emis ON DELETE CASCADE,
  paid_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  bank_account_id UUID REFERENCES public.bank_accounts ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emi_payments TO authenticated;
GRANT ALL ON public.emi_payments TO service_role;
ALTER TABLE public.emi_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ep_own" ON public.emi_payments FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- investments
CREATE TABLE public.investments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  date DATE NOT NULL,
  member_id UUID REFERENCES public.members ON DELETE SET NULL,
  investment_type TEXT NOT NULL,
  institution TEXT,
  amount NUMERIC(14,2) NOT NULL,
  source_of_funds TEXT NOT NULL DEFAULT 'Fresh Income',
  linked_maturity_id UUID REFERENCES public.investments ON DELETE SET NULL,
  fresh_topup_amount NUMERIC(14,2) DEFAULT 0,
  bank_account_id UUID REFERENCES public.bank_accounts ON DELETE SET NULL,
  maturity_date DATE,
  expected_maturity_amount NUMERIC(14,2),
  status TEXT NOT NULL DEFAULT 'Active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investments TO authenticated;
GRANT ALL ON public.investments TO service_role;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "i_own" ON public.investments FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- incomes
CREATE TABLE public.incomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  date DATE NOT NULL,
  member_id UUID REFERENCES public.members ON DELETE SET NULL,
  income_type TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  tds NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(14,2) NOT NULL,
  bank_account_id UUID REFERENCES public.bank_accounts ON DELETE SET NULL,
  linked_investment_id UUID REFERENCES public.investments ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incomes TO authenticated;
GRANT ALL ON public.incomes TO service_role;
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "in_own" ON public.incomes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- transfers
CREATE TABLE public.transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  date DATE NOT NULL,
  from_account_id UUID NOT NULL REFERENCES public.bank_accounts ON DELETE CASCADE,
  to_account_id UUID NOT NULL REFERENCES public.bank_accounts ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transfers TO authenticated;
GRANT ALL ON public.transfers TO service_role;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "t_own" ON public.transfers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- credit card bills
CREATE TABLE public.credit_card_bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.credit_cards ON DELETE CASCADE,
  billing_month DATE NOT NULL,
  total_bill NUMERIC(14,2) NOT NULL,
  payment_date DATE,
  bank_account_id UUID REFERENCES public.bank_accounts ON DELETE SET NULL,
  payment_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_card_bills TO authenticated;
GRANT ALL ON public.credit_card_bills TO service_role;
ALTER TABLE public.credit_card_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ccb_own" ON public.credit_card_bills FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- business incomes
CREATE TABLE public.business_incomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  date DATE NOT NULL,
  member_id UUID REFERENCES public.members ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  invoice_amount NUMERIC(14,2) NOT NULL,
  tds NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_received NUMERIC(14,2) NOT NULL,
  bank_account_id UUID REFERENCES public.bank_accounts ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_incomes TO authenticated;
GRANT ALL ON public.business_incomes TO service_role;
ALTER TABLE public.business_incomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bi_own" ON public.business_incomes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
