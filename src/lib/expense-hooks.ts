import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Expense = {
  id: string;
  user_id: string;
  member_id: string | null;
  date: string;
  time: string | null;
  amount: number;
  category: string;
  payment_method: string | null;
  paid_from_account_id: string | null;
  paid_to_name: string | null;
  upi_id: string | null;
  upi_reference: string | null;
  cheque_number: string | null;
  note: string | null;
  tags: string[] | null;
  is_recurring: boolean;
  recurring_frequency: string | null;
  recurring_end_date: string | null;
  receipt_url: string | null;
  is_business_expense: boolean;
  gst_number: string | null;
  receipt_number: string | null;
  is_imported: boolean;
  import_batch_id: string | null;
  fingerprint_hash: string | null;
  created_at: string;
};

export type ExpenseCategory = {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  is_default: boolean;
  sort_order: number;
};

export function useExpenses() {
  return useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("expenses")
        .select("*").order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
  });
}

export function useExpenseCategories() {
  return useQuery({
    queryKey: ["expense_categories"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("expense_categories")
        .select("*").order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ExpenseCategory[];
    },
  });
}

export const DEFAULT_CATEGORIES = [
  "Food & Dining", "Groceries", "Transport", "Petrol", "Medical",
  "Utilities", "Shopping", "Entertainment", "Education", "Household",
  "Personal Care", "Other",
] as const;
