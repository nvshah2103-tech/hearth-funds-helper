import { supabase } from "@/integrations/supabase/client";
import { makeFingerprint } from "./fingerprint";
import type { ParsedTxn } from "./parsers";

export type ImportProgress = {
  phase: "dedup" | "insert" | "done";
  done: number;
  total: number;
};

export type ImportResult = {
  batchId: string;
  found: number;
  imported: number;
  skipped: number;
  coverageFrom: string | null;
  coverageTo: string | null;
};

const CHUNK = 50;

export async function runImport(args: {
  userId: string;
  accountId: string;
  bankName: string;
  txns: ParsedTxn[];
  onProgress?: (p: ImportProgress) => void;
}): Promise<ImportResult> {
  const { userId, accountId, bankName, txns, onProgress } = args;

  // 1. Compute fingerprints for all
  const withFp = await Promise.all(
    txns.map(async (t) => ({
      ...t,
      fingerprint: await makeFingerprint(userId, accountId, t.date, t.debit, t.credit, t.description),
    })),
  );

  // 2. BULK dedup: fetch existing fingerprints for this user (one query)
  onProgress?.({ phase: "dedup", done: 0, total: withFp.length });
  const fps = withFp.map((t) => t.fingerprint);
  const existing = new Set<string>();
  // chunk the IN() filter to avoid URL length limits
  for (let i = 0; i < fps.length; i += 500) {
    const slice = fps.slice(i, i + 500);
    const { data, error } = await supabase
      .from("transaction_fingerprints")
      .select("fingerprint")
      .eq("user_id", userId)
      .in("fingerprint", slice);
    if (error) throw error;
    for (const r of data ?? []) existing.add((r as { fingerprint: string }).fingerprint);
  }
  const fresh = withFp.filter((t) => !existing.has(t.fingerprint));
  const skipped = withFp.length - fresh.length;

  // 3. Create import batch
  const dates = txns.map((t) => t.date).sort();
  const coverageFrom = dates[0] ?? null;
  const coverageTo = dates[dates.length - 1] ?? null;
  const { data: batchRow, error: batchErr } = await supabase
    .from("import_batches")
    .insert({
      user_id: userId,
      account_id: accountId,
      source_type: "pdf",
      bank_name: bankName,
      transactions_found: withFp.length,
      transactions_imported: fresh.length,
      transactions_skipped: skipped,
      coverage_from_date: coverageFrom,
      coverage_to_date: coverageTo,
      status: "success",
    })
    .select()
    .single();
  if (batchErr) throw batchErr;
  const batchId = (batchRow as { id: string }).id;

  // 4. Batch insert master_transactions in chunks of 50
  let inserted = 0;
  for (let i = 0; i < fresh.length; i += CHUNK) {
    const chunk = fresh.slice(i, i + CHUNK);
    const rows = chunk.map((t) => ({
      user_id: userId,
      bank_account_id: accountId,
      txn_date: t.date,
      description: t.description,
      debit: t.debit,
      credit: t.credit,
      balance: t.balance,
      reference_no: t.reference,
      source: "pdf",
      fingerprint: t.fingerprint,
      fingerprint_hash: t.fingerprint,
      is_imported: true,
      import_batch_id: batchId,
    }));
    const { data: ins, error: insErr } = await supabase
      .from("master_transactions")
      .insert(rows)
      .select("id");
    if (insErr) throw insErr;
    const inserted_ids = (ins ?? []) as { id: string }[];
    // Insert fingerprints
    const fpRows = chunk.map((t, idx) => ({
      user_id: userId,
      fingerprint: t.fingerprint,
      transaction_id: inserted_ids[idx]?.id,
    }));
    const { error: fpErr } = await supabase.from("transaction_fingerprints").insert(fpRows);
    if (fpErr) throw fpErr;
    inserted += chunk.length;
    onProgress?.({ phase: "insert", done: inserted, total: fresh.length });
  }

  // 5. Update bank account last_imported_until
  if (coverageTo) {
    await supabase
      .from("bank_accounts")
      .update({ last_imported_until: coverageTo })
      .eq("id", accountId);
  }

  onProgress?.({ phase: "done", done: fresh.length, total: fresh.length });
  return { batchId, found: withFp.length, imported: fresh.length, skipped, coverageFrom, coverageTo };
}
