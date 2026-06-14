import { createFileRoute } from "@tanstack/react-router";
import { useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, ArrowRight, Pencil } from "lucide-react";
import { useBankAccounts, useTransfers } from "@/lib/data-hooks";
import { inr, fmtDate, today } from "@/lib/format";
import { Field } from "@/components/forms/IncomeForm";
import { ConfirmDeleteRow, ConfirmChangesDialog, diffFields } from "@/components/forms/_shared";

export const Route = createFileRoute("/_authenticated/transfers")({ component: TransfersPage });

function TransfersPage() {
  const trs = useTransfers();
  const accts = useBankAccounts();
  const qc = useQueryClient();
  const acctName = (id: string) => accts.data?.find((a) => a.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Inter-Account Transfers</h1>
          <p className="text-sm text-muted-foreground">Move money between your own accounts. Never counted as income.</p>
        </div>
        <AddOrEditTransferButton />
      </div>
      <Card>
        <CardHeader><CardTitle>History</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>From</TableHead><TableHead></TableHead>
              <TableHead>To</TableHead><TableHead className="text-right">Amount</TableHead>
              <TableHead>Reason</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(trs.data ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{fmtDate(t.date)}</TableCell>
                  <TableCell>{acctName(t.from_account_id)}</TableCell>
                  <TableCell><ArrowRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                  <TableCell>{acctName(t.to_account_id)}</TableCell>
                  <TableCell className="text-right font-mono">{inr(t.amount)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.reason ?? ""}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <AddOrEditTransferButton editing={t} />
                      <ConfirmDeleteRow table="transfers" id={t.id} amount={Number(t.amount)} label="transfer" onDeleted={() => qc.invalidateQueries({ queryKey: ["transfers"] })} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!trs.data?.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No transfers yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

const TR_LABELS = { date: "Date", from_account_id: "From", to_account_id: "To", amount: "Amount", reason: "Reason" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AddOrEditTransferButton({ editing, trigger }: { editing?: any; trigger?: ReactNode }) {
  const accts = useBankAccounts();
  const qc = useQueryClient();
  const isEdit = !!editing;
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    date: editing?.date ?? today(),
    from: editing?.from_account_id ?? "",
    to: editing?.to_account_id ?? "",
    amount: String(editing?.amount ?? ""),
    reason: editing?.reason ?? "",
  });

  function payload() {
    return { date: f.date, from_account_id: f.from, to_account_id: f.to, amount: Number(f.amount), reason: f.reason || null };
  }

  async function doInsert() {
    if (!f.from || !f.to || f.from === f.to) { toast.error("Pick two different accounts"); return; }
    if (!f.amount) { toast.error("Amount required"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    const { error } = await supabase.from("transfers").insert({ user_id: user.id, ...payload() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["transfers"] });
    toast.success("Transfer recorded");
    setOpen(false);
    setF({ date: today(), from: "", to: "", amount: "", reason: "" });
  }

  async function doUpdate() {
    setBusy(true);
    const { error } = await supabase.from("transfers").update(payload()).eq("id", editing.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["transfers"] });
    toast.success("Updated");
    setConfirmOpen(false); setOpen(false);
  }

  const changes = isEdit ? diffFields(
    { date: editing.date, from_account_id: editing.from_account_id, to_account_id: editing.to_account_id, amount: Number(editing.amount), reason: editing.reason },
    payload() as Record<string, unknown>, TR_LABELS,
  ) : [];

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger ?? (isEdit
            ? <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
            : <Button><Plus className="h-4 w-4 mr-1" />Add transfer</Button>)}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Transfer" : "New transfer"}</DialogTitle>
            <DialogDescription>Move money between two accounts you own.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" full><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label="From">
              <Select value={f.from} onValueChange={(v) => setF({ ...f, from: v })}>
                <SelectTrigger><SelectValue placeholder="From" /></SelectTrigger>
                <SelectContent>{(accts.data ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="To">
              <Select value={f.to} onValueChange={(v) => setF({ ...f, to: v })}>
                <SelectTrigger><SelectValue placeholder="To" /></SelectTrigger>
                <SelectContent>{(accts.data ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Amount (₹)" full><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
            <Field label="Reason" full><Textarea rows={2} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => isEdit ? setConfirmOpen(true) : doInsert()} disabled={busy}>
              {busy ? "Saving…" : (isEdit ? "Review changes" : "Confirm & save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {isEdit && <ConfirmChangesDialog open={confirmOpen} onOpenChange={setConfirmOpen} changes={changes} onConfirm={doUpdate} busy={busy} />}
    </>
  );
}
