import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Member = { id: string; name: string; is_business: boolean };
export type BankAccount = {
  id: string; name: string; bank_name: string | null;
  account_type: string; opening_balance: number;
};
export type CreditCard = { id: string; name: string; bank_name: string | null; member_id: string | null };
export type Emi = {
  id: string; name: string; lender: string | null;
  total_loan_amount: number; emi_amount: number; due_day: number;
  start_date: string | null; end_date: string | null;
  bank_account_id: string | null; status: string; notes: string | null;
};
export type Income = {
  id: string; date: string; member_id: string | null;
  income_type: string; amount: number; tds: number; net_amount: number;
  bank_account_id: string | null; linked_investment_id: string | null; notes: string | null;
};
export type Investment = {
  id: string; date: string; member_id: string | null; investment_type: string;
  institution: string | null; amount: number; source_of_funds: string;
  linked_maturity_id: string | null; fresh_topup_amount: number | null;
  bank_account_id: string | null; maturity_date: string | null;
  expected_maturity_amount: number | null; status: string; notes: string | null;
};
export type Transfer = {
  id: string; date: string; from_account_id: string; to_account_id: string;
  amount: number; reason: string | null;
};
export type CCBill = {
  id: string; card_id: string; billing_month: string; total_bill: number;
  payment_date: string | null; bank_account_id: string | null;
  payment_amount: number; notes: string | null;
};
export type BusinessIncome = {
  id: string; date: string; member_id: string | null; client_name: string;
  invoice_amount: number; tds: number; net_received: number;
  bank_account_id: string | null; notes: string | null;
};
export type EmiPayment = {
  id: string; emi_id: string; paid_date: string; amount: number;
  bank_account_id: string | null; notes: string | null;
};

function q<T>(key: string, table: string, order: { col: string; asc?: boolean } = { col: "created_at", asc: false }) {
  return useQuery({
    queryKey: [key],
    queryFn: async () => {
      const { data, error } = await supabase.from(table).select("*").order(order.col, { ascending: order.asc ?? false });
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

export const useMembers = () => q<Member>("members", "members", { col: "created_at", asc: true });
export const useBankAccounts = () => q<BankAccount>("bank_accounts", "bank_accounts", { col: "created_at", asc: true });
export const useCreditCards = () => q<CreditCard>("credit_cards", "credit_cards", { col: "created_at", asc: true });
export const useEmis = () => q<Emi>("emis", "emis", { col: "created_at", asc: true });
export const useIncomes = () => q<Income>("incomes", "incomes", { col: "date" });
export const useInvestments = () => q<Investment>("investments", "investments", { col: "date" });
export const useTransfers = () => q<Transfer>("transfers", "transfers", { col: "date" });
export const useCCBills = () => q<CCBill>("cc_bills", "credit_card_bills", { col: "billing_month" });
export const useBusinessIncomes = () => q<BusinessIncome>("business_incomes", "business_incomes", { col: "date" });
export const useEmiPayments = () => q<EmiPayment>("emi_payments", "emi_payments", { col: "paid_date" });

/** Compute current balance for each bank account from all activity. */
export function computeBalances(
  accounts: BankAccount[],
  incomes: Income[],
  investments: Investment[],
  transfers: Transfer[],
  ccBills: CCBill[],
  businessIncomes: BusinessIncome[],
  emiPayments: EmiPayment[],
): Record<string, number> {
  const bal: Record<string, number> = {};
  for (const a of accounts) bal[a.id] = Number(a.opening_balance);
  for (const i of incomes) if (i.bank_account_id) bal[i.bank_account_id] = (bal[i.bank_account_id] ?? 0) + Number(i.net_amount);
  for (const b of businessIncomes) if (b.bank_account_id) bal[b.bank_account_id] = (bal[b.bank_account_id] ?? 0) + Number(b.net_received);
  for (const inv of investments) if (inv.bank_account_id) bal[inv.bank_account_id] = (bal[inv.bank_account_id] ?? 0) - Number(inv.amount);
  for (const t of transfers) {
    bal[t.from_account_id] = (bal[t.from_account_id] ?? 0) - Number(t.amount);
    bal[t.to_account_id] = (bal[t.to_account_id] ?? 0) + Number(t.amount);
  }
  for (const c of ccBills) if (c.bank_account_id && c.payment_amount) bal[c.bank_account_id] = (bal[c.bank_account_id] ?? 0) - Number(c.payment_amount);
  for (const e of emiPayments) if (e.bank_account_id) bal[e.bank_account_id] = (bal[e.bank_account_id] ?? 0) - Number(e.amount);
  return bal;
}
