import { useState, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBankAccounts } from "@/lib/data-hooks";
import { useAuth } from "@/lib/auth-context";
import { extractPdfLines, PasswordRequiredError } from "@/lib/pdf-import/extract";
import {
  detectBank, parseStatement, summarizeCoverage, reconciliationSummary,
  type ParsedTxn, type BankKey,
} from "@/lib/pdf-import/parsers";
import { runImport, type ImportProgress, type ImportResult } from "@/lib/pdf-import/import";
import { getHint, setHint } from "@/lib/pdf-import/password-memory";
import { inr, fmtDate } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "select" | "password" | "parsing" | "confirm" | "importing" | "done" | "error";

export function ImportPdfDialog({ open, onOpenChange, defaultAccountId }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultAccountId?: string;
}) {
  const accts = useBankAccounts();
  const auth = useAuth();
  const qc = useQueryClient();
  const userId = auth.user?.id;

  const [step, setStep] = useState<Step>("select");
  const [accountId, setAccountId] = useState<string>(defaultAccountId ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [pwHint, setPwHint] = useState("");
  const [pwWrong, setPwWrong] = useState(false);
  const [bank, setBank] = useState<BankKey>("GENERIC");
  const [txns, setTxns] = useState<ParsedTxn[]>([]);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("select"); setFile(null); setPassword(""); setPwWrong(false);
    setBank("GENERIC"); setTxns([]); setProgress(null); setResult(null); setError("");
  }
  function close(v: boolean) {
    onOpenChange(v);
    if (!v) setTimeout(reset, 250);
  }
  const acct = accts.data?.find((a) => a.id === accountId);

  const tryParse = useCallback(async (f: File, pw?: string) => {
    setStep("parsing"); setError("");
    try {
      const lines = await extractPdfLines(f, pw);
      const detected = detectBank(lines);
      setBank(detected);
      const parsed = parseStatement(lines);
      if (!parsed.length) {
        setError("Could not detect any transactions. PDF may be scanned or use an unsupported layout.");
        setStep("error");
        return;
      }
      setTxns(parsed);
      setStep("confirm");
      if (pw && acct?.bank_name) setHint(acct.bank_name, "Saved · last used " + new Date().toLocaleDateString());
    } catch (e) {
      if (e instanceof PasswordRequiredError) {
        setPwWrong(e.incorrect);
        if (acct?.bank_name) setPwHint(getHint(acct.bank_name) ?? "");
        setStep("password");
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((e as any)?.message ?? "Failed to parse PDF");
      setStep("error");
    }
  }, [acct]);

  async function pickFile(f: File) {
    setFile(f);
    await tryParse(f);
  }
  async function submitPassword() {
    if (!file) return;
    await tryParse(file, password);
  }
  async function doImport() {
    if (!userId || !accountId || !txns.length) return;
    setStep("importing");
    try {
      const r = await runImport({
        userId, accountId, bankName: acct?.bank_name ?? "Unknown",
        txns, onProgress: setProgress,
      });
      setResult(r);
      setStep("done");
      qc.invalidateQueries();
      toast.success(`Imported ${r.imported} transactions (${r.skipped} duplicates skipped)`);
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((e as any)?.message ?? "Import failed");
      setStep("error");
    }
  }

  const coverage = summarizeCoverage(txns);
  const recon = reconciliationSummary(txns);
  const reconOk = recon.total > 0 && recon.high / recon.total >= 0.85;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> Import bank statement (PDF)
          </DialogTitle>
          <DialogDescription>
            Column-aware parser. Handles multi-line rows, credits, debits &amp; small amounts.
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-4">
            <div>
              <Label>Bank account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Choose an account…" /></SelectTrigger>
                <SelectContent>
                  {(accts.data ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}{a.bank_name ? " · " + a.bank_name : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-accent/30 cursor-pointer"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f && accountId) pickFile(f);
              }}
            >
              <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-sm mt-2">Drop a PDF here, or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">
                HDFC · SBI · ICICI · Axis · Kotak · IDFC First · Yes · PNB · generic
              </p>
              <input
                ref={inputRef} type="file" accept="application/pdf" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && accountId) pickFile(f);
                  else if (!accountId) toast.error("Pick an account first");
                }}
              />
            </div>
          </div>
        )}

        {step === "password" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <div>
                {pwWrong ? "Wrong password — try again." : "This PDF is password-protected."}
                {pwHint && <div className="text-xs mt-1 opacity-80">Hint: {pwHint}</div>}
              </div>
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password" autoFocus value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitPassword(); }}
                placeholder="Often DOB+name initials"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Decryption happens in your browser. We never upload the PDF.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("select")}>Back</Button>
              <Button onClick={submitPassword} disabled={!password}>Decrypt</Button>
            </DialogFooter>
          </div>
        )}

        {step === "parsing" && (
          <div className="py-10 text-center space-y-3">
            <Progress value={undefined} className="animate-pulse" />
            <p className="text-sm text-muted-foreground">Reading PDF…</p>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <Badge variant="secondary">{bank}</Badge>
              <Badge variant="secondary">{txns.length} transactions</Badge>
              {coverage.from && (
                <Badge variant="secondary">
                  {fmtDate(coverage.from)} → {fmtDate(coverage.to!)}
                </Badge>
              )}
              <div className="flex items-center gap-1 ml-auto text-xs">
                <span className="text-[hsl(142,76%,36%)]">● {recon.high} high</span>
                <span className="text-amber-500">● {recon.medium} med</span>
                <span className="text-destructive">● {recon.low} low</span>
              </div>
            </div>

            {reconOk ? (
              <div className="flex items-start gap-2 p-3 rounded-md bg-[hsl(142,76%,36%)]/10 text-[hsl(142,76%,26%)] dark:text-[hsl(142,76%,60%)] text-sm">
                <ShieldCheck className="h-4 w-4 mt-0.5" />
                <div>Running-balance reconciliation passed. Numbers match the statement.</div>
              </div>
            ) : (
              <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <div>
                  Balance reconciliation had gaps — a few rows may be miscategorised.
                  You can still import; rows marked <b>Low</b> will be flagged for review.
                </div>
              </div>
            )}

            <div className="border rounded-md max-h-[45vh] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="w-[80px]">Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="w-[70px]">Conf.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txns.slice(0, 100).map((t, i) => (
                    <TableRow key={i} className={cn(t.needsReview && "bg-amber-500/5")}>
                      <TableCell className="font-mono text-xs">{fmtDate(t.date)}</TableCell>
                      <TableCell className="text-xs max-w-[280px] truncate" title={t.description}>{t.description}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-[hsl(142,76%,36%)]">{t.credit ? inr(t.credit) : ""}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-destructive">{t.debit ? inr(t.debit) : ""}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{t.balance != null ? inr(t.balance) : ""}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                          t.confidence === "high" && "bg-[hsl(142,76%,36%)]/15 text-[hsl(142,76%,36%)]",
                          t.confidence === "medium" && "bg-amber-500/15 text-amber-600",
                          t.confidence === "low" && "bg-destructive/15 text-destructive",
                        )}>
                          {t.confidence}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {txns.length > 100 && (
                <p className="text-xs text-muted-foreground text-center py-2">+ {txns.length - 100} more rows</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("select")}>Back</Button>
              <Button onClick={doImport}>Import {txns.length} transactions</Button>
            </DialogFooter>
          </div>
        )}

        {step === "importing" && (
          <div className="py-8 space-y-4">
            <Progress value={progress ? (progress.done / Math.max(progress.total, 1)) * 100 : 0} />
            <p className="text-sm text-center text-muted-foreground">
              {progress?.phase === "dedup" ? "Checking for duplicates…" :
               progress?.phase === "insert" ? `Saving ${progress.done} of ${progress.total}…` :
               "Working…"}
            </p>
          </div>
        )}

        {step === "done" && result && (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 mx-auto text-[hsl(142,76%,36%)]" />
            <h3 className="text-lg font-semibold">Import complete</h3>
            <div className="text-sm text-muted-foreground">
              <div>{result.imported} new transactions added</div>
              {result.skipped > 0 && <div>{result.skipped} duplicates skipped</div>}
              {recon.flagged > 0 && <div className="text-amber-500">{recon.flagged} flagged for review</div>}
              {result.coverageFrom && <div>Coverage: {fmtDate(result.coverageFrom)} → {fmtDate(result.coverageTo!)}</div>}
            </div>
            <DialogFooter>
              <Button onClick={() => close(false)}>Done</Button>
              <Button variant="outline" onClick={reset}>Import another</Button>
            </DialogFooter>
          </div>
        )}

        {step === "error" && (
          <div className="py-6 space-y-3 text-center">
            <AlertTriangle className="h-10 w-10 mx-auto text-destructive" />
            <p className="text-sm">{error}</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>Close</Button>
              <Button onClick={reset}>Try again</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
