import { Link } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { inr, fmtDate } from "@/lib/format";

export type TxnDetail = {
  date: string;
  description: string;
  amount: number;
  direction: "credit" | "debit" | "transfer";
  category: string;
  bankAccountName: string;
  transferToName?: string;
  memberName: string;
  source: "M" | "I";
  counterparty?: string;
  reference?: string | null;
  upiId?: string | null;
  fingerprint?: string | null;
  batchId?: string | null;
  balance?: number | null;
  notes?: string | null;
};

const UPI_RE = /[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}/;

export function extractUpi(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(UPI_RE);
  return m ? m[0] : null;
}

function CopyRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-sm break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 shrink-0"
        aria-label={`Copy ${label}`}
        onClick={() => {
          navigator.clipboard.writeText(value).then(() => toast.success(`${label} copied`));
        }}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3 py-2 border-b border-border last:border-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

export function TxnDetailDrawer({ txn, onOpenChange }: { txn: TxnDetail | null; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={!!txn} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        {txn && (
          <>
            <SheetHeader>
              <SheetTitle>Transaction details</SheetTitle>
              <SheetDescription>{fmtDate(txn.date)} · {txn.source === "I" ? "Imported from statement" : "Manual entry"}</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6 space-y-5">
              <div className={`text-3xl font-semibold font-mono ${txn.direction === "credit" ? "text-success" : txn.direction === "debit" ? "text-destructive" : ""}`}>
                {txn.direction === "credit" ? "+" : txn.direction === "debit" ? "−" : ""}{inr(Math.abs(txn.amount))}
              </div>
              <div>
                <Field label="Category" value={txn.category} />
                <Field label="Bank" value={txn.transferToName ? `${txn.bankAccountName} → ${txn.transferToName}` : txn.bankAccountName} />
                <Field label="Member" value={txn.memberName !== "—" ? txn.memberName : null} />
                <Field label="Counterparty" value={txn.counterparty} />
                <Field label="Balance after (statement)" value={txn.balance != null ? inr(txn.balance) : null} />
                <Field label="Notes" value={txn.notes} />
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Copy</div>
                <CopyRow label="Description" value={txn.description} />
                <CopyRow label="Reference" value={txn.reference} mono />
                <CopyRow label="UPI ID" value={txn.upiId} mono />
                <CopyRow label="Fingerprint" value={txn.fingerprint} mono />
              </div>
              {txn.batchId && (
                <Button asChild variant="outline" className="w-full">
                  <Link to="/import-status" hash={`batch-${txn.batchId}`}>
                    <ExternalLink className="h-4 w-4 mr-2" /> Imported from batch · open import record
                  </Link>
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
