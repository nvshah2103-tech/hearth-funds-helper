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
import { Plus } from "lucide-react";
import { useBusinessIncomes, useMembers, useBankAccounts } from "@/lib/data-hooks";
import { inr, fmtDate, today, fyList } from "@/lib/format";
import { Field, DeleteRow } from "@/components/forms/IncomeForm";
import { downloadCSV } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/business")({ component: BusinessPage });

function quarterOf(d: string) {
  const m = new Date(d).getMonth();
  // Indian FY quarters: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
  if (m >= 3 && m <= 5) return "Q1";
  if (m >= 6 && m <= 8) return "Q2";
  if (m >= 9 && m <= 11) return "Q3";
  return "Q4";
}

function BusinessPage() {
  const bis = useBusinessIncomes();
  const members = useMembers().data?.filter((m) => m.is_business) ?? [];
  const accts = useBankAccounts();
  const qc = useQueryClient();
  const fys = fyList();
  const [fyIdx, setFyIdx] = useState(0);
  const fy = fys[fyIdx];

  const acctName = (id: string | null) => accts.data?.find((a) => a.id === id)?.name ?? "—";
  const filtered = (bis.data ?? []).filter((b) => b.date >= fy.start && b.date <= fy.end);

  // quarterly summary
  const byQ: Record<string, { gross: number; tds: number; net: number; count: number }> = {
    Q1: { gross: 0, tds: 0, net: 0, count: 0 }, Q2: { gross: 0, tds: 0, net: 0, count: 0 },
    Q3: { gross: 0, tds: 0, net: 0, count: 0 }, Q4: { gross: 0, tds: 0, net: 0, count: 0 },
  };
  for (const b of filtered) {
    const q = quarterOf(b.date);
    byQ[q].gross += Number(b.invoice_amount); byQ[q].tds += Number(b.tds);
    byQ[q].net += Number(b.net_received); byQ[q].count += 1;
  }

  function exportCsv() {
    downloadCSV(`business-${fy.label}.csv`, filtered.map((b) => ({
      Date: fmtDate(b.date), Client: b.client_name, Quarter: quarterOf(b.date),
      Invoice: Number(b.invoice_amount), TDS: Number(b.tds), Net: Number(b.net_received),
      Account: acctName(b.bank_account_id), Notes: b.notes ?? "",
    })));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Business Income</h1>
          <p className="text-sm text-muted-foreground">Client invoices and TDS for advance tax reference.</p>
        </div>
        <div className="flex gap-2">
          <Select value={fyIdx.toString()} onValueChange={(v) => setFyIdx(Number(v))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{fys.map((f, i) => <SelectItem key={i} value={i.toString()}>{f.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv}>Export</Button>
          <AddBusinessButton members={members} accts={accts.data ?? []} />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Quarterly summary — {fy.label}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Quarter</TableHead><TableHead>Invoices</TableHead>
              <TableHead className="text-right">Gross</TableHead><TableHead className="text-right">TDS</TableHead>
              <TableHead className="text-right">Net</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(["Q1", "Q2", "Q3", "Q4"] as const).map((q) => (
                <TableRow key={q}>
                  <TableCell>{q}</TableCell>
                  <TableCell>{byQ[q].count}</TableCell>
                  <TableCell className="text-right font-mono">{inr(byQ[q].gross)}</TableCell>
                  <TableCell className="text-right font-mono">{inr(byQ[q].tds)}</TableCell>
                  <TableCell className="text-right font-mono text-success">{inr(byQ[q].net)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All invoices</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Client</TableHead><TableHead>Quarter</TableHead>
              <TableHead className="text-right">Invoice</TableHead><TableHead className="text-right">TDS</TableHead>
              <TableHead className="text-right">Net</TableHead><TableHead>Account</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{fmtDate(b.date)}</TableCell>
                  <TableCell>{b.client_name}</TableCell>
                  <TableCell>{quarterOf(b.date)}</TableCell>
                  <TableCell className="text-right font-mono">{inr(b.invoice_amount)}</TableCell>
                  <TableCell className="text-right font-mono">{inr(b.tds)}</TableCell>
                  <TableCell className="text-right font-mono text-success">{inr(b.net_received)}</TableCell>
                  <TableCell>{acctName(b.bank_account_id)}</TableCell>
                  <TableCell className="text-right"><DeleteRow table="business_incomes" id={b.id} onDeleted={() => qc.invalidateQueries({ queryKey: ["business_incomes"] })} /></TableCell>
                </TableRow>
              ))}
              {!filtered.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No business invoices for {fy.label}.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AddBusinessButton({ members, accts }: { members: { id: string; name: string }[]; accts: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ date: today(), member: members[0]?.id ?? "", client: "", invoice: "", tds: "0", bank: "", notes: "" });

  const net = Math.max(0, (Number(f.invoice) || 0) - (Number(f.tds) || 0));

  async function save() {
    if (!f.client || !f.invoice) { toast.error("Client and amount required"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("business_incomes").insert({
      user_id: user.id, date: f.date, member_id: f.member || null, client_name: f.client,
      invoice_amount: Number(f.invoice), tds: Number(f.tds) || 0, net_received: net,
      bank_account_id: f.bank || null, notes: f.notes || null,
    });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["business_incomes"] });
    toast.success("Invoice recorded");
    setOpen(false);
    setF({ date: today(), member: members[0]?.id ?? "", client: "", invoice: "", tds: "0", bank: "", notes: "" });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Add invoice</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add business income</DialogTitle><DialogDescription>Client invoice with TDS.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Member">
            <Select value={f.member} onValueChange={(v) => setF({ ...f, member: v })}>
              <SelectTrigger><SelectValue placeholder="Member" /></SelectTrigger>
              <SelectContent>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Client name" full><Input value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })} /></Field>
          <Field label="Invoice amount (₹)"><Input type="number" value={f.invoice} onChange={(e) => setF({ ...f, invoice: e.target.value })} /></Field>
          <Field label="TDS (₹)"><Input type="number" value={f.tds} onChange={(e) => setF({ ...f, tds: e.target.value })} /></Field>
          <Field label="Net received (₹)"><Input value={net.toString()} readOnly className="bg-muted" /></Field>
          <Field label="Received in">
            <Select value={f.bank} onValueChange={(v) => setF({ ...f, bank: v })}>
              <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
              <SelectContent>{accts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Notes" full><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Confirm & save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
