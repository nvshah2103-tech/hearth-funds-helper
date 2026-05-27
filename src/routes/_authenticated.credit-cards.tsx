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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useCreditCards, useCCBills, useBankAccounts } from "@/lib/data-hooks";
import { inr, fmtDate, today, monthLabel } from "@/lib/format";
import { Field, DeleteRow } from "@/components/forms/IncomeForm";

export const Route = createFileRoute("/_authenticated/credit-cards")({ component: CreditCardsPage });

function CreditCardsPage() {
  const cards = useCreditCards();
  const bills = useCCBills();
  const accts = useBankAccounts();
  const qc = useQueryClient();

  const cardName = (id: string) => cards.data?.find((c) => c.id === id)?.name ?? "—";
  const acctName = (id: string | null) => accts.data?.find((a) => a.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Credit Cards</h1>
          <p className="text-sm text-muted-foreground">Track monthly bills and payments for each card.</p>
        </div>
        <AddBillButton />
      </div>

      <Card>
        <CardHeader><CardTitle>Monthly bills</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Billing month</TableHead><TableHead>Card</TableHead>
              <TableHead className="text-right">Bill amount</TableHead>
              <TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Outstanding</TableHead>
              <TableHead>Paid from</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(bills.data ?? []).map((b) => {
                const out = Number(b.total_bill) - Number(b.payment_amount);
                return (
                  <TableRow key={b.id}>
                    <TableCell>{monthLabel(b.billing_month)}</TableCell>
                    <TableCell>{cardName(b.card_id)}</TableCell>
                    <TableCell className="text-right font-mono">{inr(b.total_bill)}</TableCell>
                    <TableCell className="text-right font-mono">{inr(b.payment_amount)}</TableCell>
                    <TableCell className="text-right font-mono">{inr(out)}</TableCell>
                    <TableCell>{acctName(b.bank_account_id)} {b.payment_date && <span className="text-muted-foreground text-xs">· {fmtDate(b.payment_date)}</span>}</TableCell>
                    <TableCell>{out <= 0 ? <Badge>Paid</Badge> : out < Number(b.total_bill) ? <Badge variant="secondary">Partial</Badge> : <Badge variant="destructive">Due</Badge>}</TableCell>
                    <TableCell className="text-right"><DeleteRow table="credit_card_bills" id={b.id} onDeleted={() => qc.invalidateQueries({ queryKey: ["cc_bills"] })} /></TableCell>
                  </TableRow>
                );
              })}
              {!bills.data?.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No bills yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AddBillButton() {
  const cards = useCreditCards();
  const accts = useBankAccounts();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [cardId, setCardId] = useState("");
  const [month, setMonth] = useState(() => today().slice(0, 7) + "-01");
  const [total, setTotal] = useState("");
  const [payDate, setPayDate] = useState(today());
  const [bankId, setBankId] = useState("");
  const [payAmt, setPayAmt] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!cardId || !total) { toast.error("Card and amount required"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("credit_card_bills").insert({
      user_id: user.id, card_id: cardId, billing_month: month,
      total_bill: Number(total), payment_date: payDate || null,
      bank_account_id: bankId || null, payment_amount: Number(payAmt) || 0,
      notes: notes || null,
    });
    if (error) { toast.error(error.message); setBusy(false); return; }
    qc.invalidateQueries({ queryKey: ["cc_bills"] });
    toast.success("Bill recorded");
    setOpen(false);
    setTotal(""); setPayAmt(""); setNotes("");
    setBusy(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Add bill</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add credit card bill</DialogTitle><DialogDescription>Enter the monthly statement total.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Card" full>
            <Select value={cardId} onValueChange={setCardId}>
              <SelectTrigger><SelectValue placeholder="Select card" /></SelectTrigger>
              <SelectContent>{(cards.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Billing month"><Input type="month" value={month.slice(0, 7)} onChange={(e) => setMonth(e.target.value + "-01")} /></Field>
          <Field label="Bill amount (₹)"><Input type="number" value={total} onChange={(e) => setTotal(e.target.value)} /></Field>
          <Field label="Payment amount (₹)"><Input type="number" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} /></Field>
          <Field label="Payment date"><Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></Field>
          <Field label="Paid from" full>
            <Select value={bankId} onValueChange={setBankId}>
              <SelectTrigger><SelectValue placeholder="Bank account" /></SelectTrigger>
              <SelectContent>{(accts.data ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Notes" full><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Confirm & save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
