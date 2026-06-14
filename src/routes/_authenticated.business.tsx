import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, ReactNode } from "react";
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
import { Plus, Pencil } from "lucide-react";
import { useBusinessIncomes, useMembers, useBankAccounts } from "@/lib/data-hooks";
import { inr, fmtDate, today, fyList } from "@/lib/format";
import { Field, TDSSectionPicker } from "@/components/forms/IncomeForm";
import { ConfirmDeleteRow, ConfirmChangesDialog, diffFields } from "@/components/forms/_shared";
import { getTDSSection, getTDSSectionByCode } from "@/lib/tds-constants";
import { downloadCSV } from "@/lib/csv";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/business")({ component: BusinessPage });

function quarterOf(d: string) {
  const m = new Date(d).getMonth();
  if (m >= 3 && m <= 5) return "Q1";
  if (m >= 6 && m <= 8) return "Q2";
  if (m >= 9 && m <= 11) return "Q3";
  return "Q4";
}

function BusinessPage() {
  const bis = useBusinessIncomes();
  const allMembers = useMembers().data ?? [];
  const members = allMembers.filter((m) => m.is_business);
  const accts = useBankAccounts();
  const qc = useQueryClient();
  const fys = fyList();
  const [fyIdx, setFyIdx] = useState(0);
  const fy = fys[fyIdx];

  const acctName = (id: string | null) => accts.data?.find((a) => a.id === id)?.name ?? "—";
  const filtered = (bis.data ?? []).filter((b) => b.date >= fy.start && b.date <= fy.end);

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Section: (b as any).tds_section ?? "", Rate: (b as any).tds_rate ?? "",
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
          <AddOrEditBusinessButton members={members} accts={accts.data ?? []} />
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
              <TableHead>TDS Section</TableHead>
              <TableHead className="text-right">Invoice</TableHead><TableHead className="text-right">TDS</TableHead>
              <TableHead className="text-right">Net</TableHead><TableHead>Account</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((b) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const r = b as any;
                const unconfirmed = !r.tds_section_confirmed && Number(r.tds) > 0;
                return (
                  <TableRow key={b.id}>
                    <TableCell>{fmtDate(b.date)}</TableCell>
                    <TableCell>{b.client_name}</TableCell>
                    <TableCell>{quarterOf(b.date)}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1.5">
                        {unconfirmed && <span className={cn("h-2 w-2 rounded-full bg-amber-500")} />}
                        {r.tds_section ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">{inr(b.invoice_amount)}</TableCell>
                    <TableCell className="text-right font-mono">{inr(b.tds)}</TableCell>
                    <TableCell className="text-right font-mono text-success">{inr(b.net_received)}</TableCell>
                    <TableCell>{acctName(b.bank_account_id)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <AddOrEditBusinessButton editing={b} members={members} accts={accts.data ?? []} />
                        <ConfirmDeleteRow table="business_incomes" id={b.id} amount={Number(b.invoice_amount)} label="invoice" onDeleted={() => qc.invalidateQueries({ queryKey: ["business_incomes"] })} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!filtered.length && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No business invoices for {fy.label}.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

const BIZ_LABELS = {
  date: "Date", client_name: "Client", invoice_amount: "Invoice", tds: "TDS",
  net_received: "Net", bank_account_id: "Account", tds_section: "TDS section",
  tds_rate: "TDS rate %", notes: "Notes",
};

function AddOrEditBusinessButton({
  members, accts, editing, trigger,
}: {
  members: { id: string; name: string }[];
  accts: { id: string; name: string }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editing?: any;
  trigger?: ReactNode;
}) {
  const qc = useQueryClient();
  const isEdit = !!editing;
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [date, setDate] = useState(editing?.date ?? today());
  const [memberId, setMemberId] = useState(editing?.member_id ?? members[0]?.id ?? "");
  const [client, setClient] = useState(editing?.client_name ?? "");
  const [invoice, setInvoice] = useState(String(editing?.invoice_amount ?? ""));
  const [tds, setTds] = useState(String(editing?.tds ?? "0"));
  const [tdsTouched, setTdsTouched] = useState(false);
  const [tdsSection, setTdsSection] = useState<string>(editing?.tds_section ?? "194J");
  const [tdsConfirmed, setTdsConfirmed] = useState<boolean>(editing?.tds_section_confirmed ?? false);
  const [tdsRate, setTdsRate] = useState<string>(String(editing?.tds_rate ?? getTDSSectionByCode("194J")?.rate ?? 10));
  const [bank, setBank] = useState(editing?.bank_account_id ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");

  useEffect(() => {
    const s = getTDSSectionByCode(tdsSection);
    if (s) setTdsRate(String(s.rate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tdsSection]);

  useEffect(() => {
    if (tdsTouched) return;
    const calc = +(((Number(invoice) || 0) * (Number(tdsRate) || 0)) / 100).toFixed(2);
    setTds(String(calc));
  }, [invoice, tdsRate, tdsTouched]);

  const net = Math.max(0, (Number(invoice) || 0) - (Number(tds) || 0));

  function payload() {
    return {
      date, member_id: memberId || null, client_name: client,
      invoice_amount: Number(invoice), tds: Number(tds) || 0, net_received: net,
      tds_section: tdsSection || null, tds_rate: tdsRate ? Number(tdsRate) : null,
      tds_section_confirmed: tdsConfirmed,
      tds_expected: +(((Number(invoice) || 0) * (Number(tdsRate) || 0)) / 100).toFixed(2),
      bank_account_id: bank || null, notes: notes || null,
    };
  }

  async function doInsert() {
    if (!client || !invoice) { toast.error("Client and amount required"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("business_incomes") as any).insert({ user_id: user.id, ...payload() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["business_incomes"] });
    toast.success("Invoice recorded");
    setOpen(false);
  }

  async function doUpdate() {
    setBusy(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("business_incomes") as any).update(payload()).eq("id", editing.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["business_incomes"] });
    toast.success("Updated");
    setConfirmOpen(false); setOpen(false);
  }

  const changes = isEdit
    ? diffFields(editing as Record<string, unknown>, payload() as Record<string, unknown>, BIZ_LABELS)
    : [];

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger ?? (
            isEdit
              ? <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
              : <Button><Plus className="h-4 w-4 mr-1" />Add invoice</Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Business Income" : "Add business income"}</DialogTitle>
            <DialogDescription>Client invoice with TDS.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Member">
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger><SelectValue placeholder="Member" /></SelectTrigger>
                <SelectContent>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Client name" full><Input value={client} onChange={(e) => setClient(e.target.value)} /></Field>
            <Field label="Invoice amount (₹)"><Input type="number" value={invoice} onChange={(e) => setInvoice(e.target.value)} /></Field>
            <Field label="Net received (₹)"><Input value={net.toString()} readOnly className="bg-muted" /></Field>
            <Field label="TDS Section" full>
              <TDSSectionPicker section={tdsSection} setSection={setTdsSection} confirmed={tdsConfirmed} setConfirmed={setTdsConfirmed} />
            </Field>
            <Field label="TDS Rate %"><Input type="number" step="0.01" value={tdsRate} onChange={(e) => { setTdsRate(e.target.value); setTdsTouched(false); }} /></Field>
            <Field label="TDS Amount (₹)"><Input type="number" value={tds} onChange={(e) => { setTds(e.target.value); setTdsTouched(true); }} /></Field>
            <Field label="Received in" full>
              <Select value={bank} onValueChange={setBank}>
                <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
                <SelectContent>{accts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Notes" full><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => isEdit ? setConfirmOpen(true) : doInsert()} disabled={busy}>
              {busy ? "Saving…" : (isEdit ? "Review changes" : "Confirm & save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {isEdit && (
        <ConfirmChangesDialog open={confirmOpen} onOpenChange={setConfirmOpen} changes={changes} onConfirm={doUpdate} busy={busy} />
      )}
    </>
  );
}
// satisfy linter on unused import for getTDSSection (kept for parity / future helpers)
void getTDSSection;
