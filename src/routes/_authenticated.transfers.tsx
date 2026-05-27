import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { Plus, ArrowRight } from "lucide-react";
import { useBankAccounts, useTransfers } from "@/lib/data-hooks";
import { inr, fmtDate, today } from "@/lib/format";
import { Field, DeleteRow } from "@/components/forms/IncomeForm";

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
        <AddTransferButton />
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
                  <TableCell className="text-right"><DeleteRow table="transfers" id={t.id} onDeleted={() => qc.invalidateQueries({ queryKey: ["transfers"] })} /></TableCell>
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

function AddTransferButton() {
  const accts = useBankAccounts();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ date: today(), from: "", to: "", amount: "", reason: "" });

  async function save() {
    if (!f.from || !f.to || f.from === f.to) { toast.error("Pick two different accounts"); return; }
    if (!f.amount) { toast.error("Amount required"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("transfers").insert({
      user_id: user.id, date: f.date, from_account_id: f.from, to_account_id: f.to,
      amount: Number(f.amount), reason: f.reason || null,
    });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["transfers"] });
    toast.success("Transfer recorded");
    setOpen(false);
    setF({ date: today(), from: "", to: "", amount: "", reason: "" });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Add transfer</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New transfer</DialogTitle><DialogDescription>Move money between two accounts you own.</DialogDescription></DialogHeader>
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
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Confirm & save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
