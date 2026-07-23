import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MasterTxn = {
  id: string;
  bank_account_id: string;
  txn_date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number | null;
  reference_no: string | null;
  source: string;
  is_imported: boolean;
  is_broker_payout: boolean;
  import_batch_id: string | null;
  notes: string | null;
};

export type ImportBatch = {
  id: string;
  account_id: string | null;
  bank_name: string | null;
  source_type: string;
  status: string;
  transactions_found: number;
  transactions_imported: number;
  transactions_skipped: number;
  coverage_from_date: string | null;
  coverage_to_date: string | null;
  imported_at: string;
  notes: string | null;
};

export function useMasterTransactions() {
  return useQuery({
    queryKey: ["master_transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("master_transactions")
        .select("*")
        .order("txn_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MasterTxn[];
    },
  });
}

export function useImportBatches() {
  return useQuery({
    queryKey: ["import_batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_batches")
        .select("*")
        .order("imported_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ImportBatch[];
    },
  });
}
