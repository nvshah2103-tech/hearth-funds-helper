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
import { toast } from "sonner";
import { Plus, CheckCircle } from "lucide-react";
import { useEmis, useEmiPayments, useBankAccounts } from "@/lib/data-hooks";
import { inr, fmtDate, today } from "@/lib/format";
import { Field, DeleteRow } from "@/components/forms/IncomeForm";
import { ConfirmDeleteRow, ConfirmChangesDialog, diffFields } from "@/components/forms/_shared";
import { Pencil } from "lucide-react";
import { ReactNode } from "react";

export const Route = createFileRoute("/_authenticated/emis")({ component: EmisPage });

function EmisPage() {
  const emis = useEmis();
  const pays = useEmiPayments();
  const accts = useBankAccounts();
  const qc = useQueryClient();

  const acctName = (id: string | null) => accts.data?.find((a) => a.id === id)?.name ?? "—";

  function paidFor(emiId: string) {
    return (pays.data ?? []).filter((p) => p.emi_id === emiId).reduce((s, p) => s + Number(p.amount), 0);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">EMIs & Loans</h1>
          <p className="text-sm text-muted-foreground">Track loans and mark each EMI as paid.</p>
        </div>
        <AddLoanButton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(emis.data ?? []).map((e) => {
          const paid = paidFor(e.id);
          const outstanding = Number(e.total_loan_amount) - paid;
          const remaining = e.emi_amount ? Math.max(0, Math.ceil(outstanding / Number(e.emi_amount))) : 0;
          return (
            <Card key={e.id}>
              <CardHeader>
                <CardTitle className="flex justify-between">
                  <span>{e.name}</span>
                  <DeleteRow table="emis" id={e.id} onDeleted={() => qc.invalidateQueries({ queryKey: ["emis"] })} />
                </CardTitle>
                <p className="text-sm text-muted-foreground">{e.lender ?? ""} · Due day {e.due_day}</p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row k="Total loan" v={inr(e.total_loan_amount)} />
                <Row k="EMI amount" v={inr(e.emi_amount)} />
                <Row k="Total paid" v={inr(paid)} />
                <Row k="Outstanding (approx)" v={inr(outstanding)} />
                <Row k="EMIs remaining" v={remaining.toString()} />
                <Row k="Paid from" v={acctName(e.bank_account_id)} />
                <PayEmiButton emi={e} />
              </CardContent>
            </Card>
          );
        })}
        {!emis.data?.length && <Card><CardContent className="py-10 text-center text-muted-foreground">No loans yet.</CardContent></Card>}
      </div>

      <Card>
        <CardHeader><CardTitle>Recent EMI payments</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Loan</TableHead>
              <TableHead className="text-right">Amount</TableHead><TableHead>From</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(pays.data ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{fmtDate(p.paid_date)}</TableCell>
                  <TableCell>{emis.data?.find((e) => e.id === p.emi_id)?.name ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono">{inr(p.amount)}</TableCell>
                  <TableCell>{acctName(p.bank_account_id)}</TableCell>
                  <TableCell className="text-right"><DeleteRow table="emi_payments" id={p.id} onDeleted={() => qc.invalidateQueries({ queryKey: ["emi_payments"] })} /></TableCell>
                </TableRow>
              ))}
              {!pays.data?.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No payments logged.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between border-b py-1.5"><span className="text-muted-foreground">{k}</span><span className="font-mono">{v}</span></div>;
}

function AddLoanButton() {
  const accts = useBankAccounts();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", lender: "", total: "", emi: "", due: "5", start: "", end: "", bank: "" });

  async function save() {
    if (!f.name || !f.emi) { toast.error("Loan name and EMI required"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("emis").insert({
      user_id: user.id, name: f.name, lender: f.lender || null,
      total_loan_amount: Number(f.total) || 0, emi_amount: Number(f.emi),
      due_day: Number(f.due) || 1, start_date: f.start || null, end_date: f.end || null,
      bank_account_id: f.bank || null, status: "Active",
    });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["emis"] });
    toast.success("Loan added");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Add loan</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add loan</DialogTitle><DialogDescription>You can add more loans later anytime.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Loan name" full><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Lender" full><Input value={f.lender} onChange={(e) => setF({ ...f, lender: e.target.value })} /></Field>
          <Field label="Total loan (₹)"><Input type="number" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} /></Field>
          <Field label="EMI amount (₹)"><Input type="number" value={f.emi} onChange={(e) => setF({ ...f, emi: e.target.value })} /></Field>
          <Field label="Due day"><Input type="number" min="1" max="31" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
          <Field label="Start date"><Input type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
          <Field label="End date"><Input type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
          <Field label="Paid from" full>
            <Select value={f.bank} onValueChange={(v) => setF({ ...f, bank: v })}>
              <SelectTrigger><SelectValue placeholder="Bank account" /></SelectTrigger>
              <SelectContent>{(accts.data ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Confirm & save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PayEmiButton({ emi }: { emi: { id: string; emi_amount: number; bank_account_id: string | null } }) {
  const accts = useBankAccounts();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState(emi.emi_amount.toString());
  const [bank, setBank] = useState(emi.bank_account_id ?? "");

  async function go() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("emi_payments").insert({
      user_id: user.id, emi_id: emi.id, paid_date: date, amount: Number(amount), bank_account_id: bank || null,
    });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["emi_payments"] });
    toast.success("EMI logged as paid");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="w-full mt-2"><CheckCircle className="h-4 w-4 mr-1" />Mark this month paid</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Log EMI payment</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Paid date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Amount (₹)"><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="From" full>
            <Select value={bank} onValueChange={setBank}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(accts.data ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter><Button onClick={go}>Confirm</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
