import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBankAccounts } from "@/lib/data-hooks";
import { useImportBatches, useMasterTransactions, type ImportBatch } from "@/lib/master-txn-hooks";
import { supabase } from "@/integrations/supabase/client";
import { inr, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { Trash2, AlertTriangle, Upload } from "lucide-react";
import { ImportPdfDialog } from "@/components/ImportPdfDialog";

export const Route = createFileRoute("/_authenticated/import-status")({ component: ImportStatusPage });

function ImportStatusPage() {
  const qc = useQueryClient();
  const batches = useImportBatches();
  const accts = useBankAccounts();
  const master = useMasterTransactions();

  const [undoTarget, setUndoTarget] = useState<ImportBatch | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const acctName = (id: string | null) =>
    id ? (accts.data?.find((a) => a.id === id)?.name ?? "—") : "—";

  // Coverage summary per bank account
  const coverage = useMemo(() => {
    const byAcct = new Map<string, { count: number; from: string | null; to: string | null; imported: number; manual: number }>();
    for (const a of accts.data ?? []) byAcct.set(a.id, { count: 0, from: null, to: null, imported: 0, manual: 0 });
    for (const t of master.data ?? []) {
      const cur = byAcct.get(t.bank_account_id);
      if (!cur) continue;
      cur.count += 1;
      if (t.is_imported) cur.imported += 1; else cur.manual += 1;
      if (!cur.from || t.txn_date < cur.from) cur.from = t.txn_date;
      if (!cur.to || t.txn_date > cur.to) cur.to = t.txn_date;
    }
    return byAcct;
  }, [master.data, accts.data]);

  // Gap detection: find months with no imported transactions between coverage_from & coverage_to
  const gaps = useMemo(() => {
    const out: { accountId: string; accountName: string; missingMonths: string[] }[] = [];
    for (const a of accts.data ?? []) {
      const rows = (master.data ?? []).filter((t) => t.bank_account_id === a.id && t.is_imported);
      if (rows.length < 2) continue;
      const dates = rows.map((r) => r.txn_date).sort();
      const start = new Date(dates[0] + "T00:00:00");
      const end = new Date(dates[dates.length - 1] + "T00:00:00");
      const monthsPresent = new Set(rows.map((r) => r.txn_date.slice(0, 7)));
      const missing: string[] = [];
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cursor <= end) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
        if (!monthsPresent.has(key)) missing.push(key);
        cursor.setMonth(cursor.getMonth() + 1);
      }
      if (missing.length) out.push({ accountId: a.id, accountName: a.name, missingMonths: missing });
    }
    return out;
  }, [master.data, accts.data]);

  async function performUndo() {
    if (!undoTarget) return;
    if (confirmText !== "UNDO") return;
    setBusy(true);
    try {
      // Delete fingerprints for this batch's txns first (FK safety: use user_id + fingerprints join via txn ids)
      const { data: txnIds, error: e1 } = await supabase
        .from("master_transactions")
        .select("id, fingerprint")
        .eq("import_batch_id", undoTarget.id);
      if (e1) throw e1;
      const ids = (txnIds ?? []).map((t) => (t as { id: string }).id);
      const fps = (txnIds ?? []).map((t) => (t as { fingerprint: string }).fingerprint);
      if (fps.length) {
        await supabase.from("transaction_fingerprints").delete().in("fingerprint", fps);
      }
      if (ids.length) {
        await supabase.from("master_transactions").delete().in("id", ids);
      }
      await supabase.from("import_batches").delete().eq("id", undoTarget.id);
      toast.success(`Removed ${ids.length} imported transactions`);
      setUndoTarget(null);
      setConfirmText("");
      qc.invalidateQueries();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Undo failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Import Status</h1>
          <p className="text-sm text-muted-foreground">
            Coverage, history and gap detection for automatically imported statements.
          </p>
        </div>
        <Button size="sm" onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4 mr-1" />Import PDF
        </Button>
      </div>
      <ImportPdfDialog open={importOpen} onOpenChange={setImportOpen} />

      {/* Coverage table */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Account coverage</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead className="text-right">Txns</TableHead>
              <TableHead className="text-right">Imported</TableHead>
              <TableHead className="text-right">Manual</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(accts.data ?? []).map((a) => {
                const c = coverage.get(a.id);
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{a.bank_name ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono">{c?.count ?? 0}</TableCell>
                    <TableCell className="text-right font-mono text-primary">{c?.imported ?? 0}</TableCell>
                    <TableCell className="text-right font-mono">{c?.manual ?? 0}</TableCell>
                    <TableCell className="text-xs">{c?.from ? fmtDate(c.from) : "—"}</TableCell>
                    <TableCell className="text-xs">{c?.to ? fmtDate(c.to) : "—"}</TableCell>
                  </TableRow>
                );
              })}
              {!(accts.data ?? []).length && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No accounts yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Gap detector */}
      {gaps.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" /> Detected gaps in imported statements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {gaps.map((g) => (
              <div key={g.accountId} className="text-sm">
                <span className="font-medium">{g.accountName}</span>
                <span className="text-muted-foreground"> · missing months: </span>
                <span className="font-mono text-xs">{g.missingMonths.join(", ")}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Batch history */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Import history</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Imported</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead>Coverage</TableHead>
              <TableHead className="text-right">Found</TableHead>
              <TableHead className="text-right">New</TableHead>
              <TableHead className="text-right">Skipped</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(batches.data ?? []).map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="text-xs">{fmtDate(b.imported_at)}</TableCell>
                  <TableCell>{acctName(b.account_id)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{b.bank_name ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {b.coverage_from_date ? fmtDate(b.coverage_from_date) : "—"} → {b.coverage_to_date ? fmtDate(b.coverage_to_date) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">{b.transactions_found}</TableCell>
                  <TableCell className="text-right font-mono text-primary">{b.transactions_imported}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{b.transactions_skipped}</TableCell>
                  <TableCell>
                    <Badge variant={b.status === "success" ? "secondary" : "destructive"}>{b.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => { setUndoTarget(b); setConfirmText(""); }} title="Undo import">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!(batches.data ?? []).length && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">No imports yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Summary strip */}
      <div className="text-xs text-muted-foreground">
        Total imported transactions: <span className="font-mono text-foreground">{(master.data ?? []).filter((t) => t.is_imported).length}</span>
        {" · "}Manual entries: <span className="font-mono text-foreground">{(master.data ?? []).filter((t) => !t.is_imported).length}</span>
        {" · "}Aggregate value moved: <span className="font-mono text-foreground">{inr((master.data ?? []).reduce((s, t) => s + Number(t.credit) + Number(t.debit), 0))}</span>
      </div>

      {/* Undo dialog */}
      <Dialog open={!!undoTarget} onOpenChange={(o) => { if (!o) { setUndoTarget(null); setConfirmText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Undo this import?</DialogTitle>
            <DialogDescription>
              This will permanently delete {undoTarget?.transactions_imported ?? 0} imported transactions from{" "}
              <span className="font-medium">{acctName(undoTarget?.account_id ?? null)}</span>.
              Manual entries are not affected. This cannot be reversed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Type <span className="font-mono font-semibold">UNDO</span> to confirm</Label>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="UNDO" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUndoTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={confirmText !== "UNDO" || busy} onClick={performUndo}>
              {busy ? "Removing…" : "Delete imported transactions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
