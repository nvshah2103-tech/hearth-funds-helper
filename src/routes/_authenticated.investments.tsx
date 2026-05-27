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
import { useMembers, useBankAccounts, useInvestments } from "@/lib/data-hooks";
import { inr, fmtDate, today } from "@/lib/format";
import { Field, DeleteRow } from "@/components/forms/IncomeForm";

const TYPES = ["FD", "Mutual Fund", "Stock", "PPF", "NPS", "Other"] as const;
const SOURCES = ["Fresh Income", "Reinvestment", "Partial Reinvestment"] as const;

export const Route = createFileRoute("/_authenticated/investments")({ component: InvestmentsPage });

function InvestmentsPage() {
  const invs = useInvestments();
  const members = useMembers();
  const accts = useBankAccounts();
  const qc = useQueryClient();

  const memberName = (id: string | null) => members.data?.find((m) => m.id === id)?.name ?? "—";
  const acctName = (id: string | null) => accts.data?.find((a) => a.id === id)?.name ?? "—";

  const active = (invs.data ?? []).filter((i) => i.status === "Active");
  const totalActive = active.reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Investments</h1>
          <p className="text-sm text-muted-foreground">FDs, Mutual Funds, Stocks, PPF, NPS — all tracked here.</p>
        </div>
        <AddInvestmentButton />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Active investments</p><p className="text-2xl font-semibold">{active.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Capital deployed</p><p className="text-2xl font-semibold text-primary">{inr(totalActive)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Total records</p><p className="text-2xl font-semibold">{invs.data?.length ?? 0}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>All investments</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Member</TableHead><TableHead>Type</TableHead>
                <TableHead>Institution</TableHead><TableHead className="text-right">Amount</TableHead>
                <TableHead>Source</TableHead><TableHead>Maturity</TableHead>
                <TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(invs.data ?? []).map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{fmtDate(i.date)}</TableCell>
                    <TableCell>{memberName(i.member_id)}</TableCell>
                    <TableCell>{i.investment_type}</TableCell>
                    <TableCell>{i.institution ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono">{inr(i.amount)}</TableCell>
                    <TableCell className="text-xs">{i.source_of_funds}</TableCell>
                    <TableCell className="text-xs">{i.maturity_date ? fmtDate(i.maturity_date) : "—"}<br />{i.expected_maturity_amount ? inr(i.expected_maturity_amount) : ""}</TableCell>
                    <TableCell><Badge variant={i.status === "Active" ? "default" : "secondary"}>{i.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {i.status === "Active" && <MarkMaturedButton id={i.id} accountId={accts.data?.[0]?.id} />}
                        <DeleteRow table="investments" id={i.id} onDeleted={() => qc.invalidateQueries({ queryKey: ["investments"] })} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!invs.data?.length && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No investments recorded.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AddInvestmentButton() {
  const members = useMembers();
  const accts = useBankAccounts();
  const invs = useInvestments();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today());
  const [memberId, setMemberId] = useState("");
  const [type, setType] = useState<string>("FD");
  const [institution, setInstitution] = useState("");
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState<string>("Fresh Income");
  const [linkedMat, setLinkedMat] = useState("");
  const [freshTop, setFreshTop] = useState("0");
  const [bankId, setBankId] = useState("");
  const [maturityDate, setMaturityDate] = useState("");
  const [expected, setExpected] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!amount || !bankId) { toast.error("Amount and account required"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("investments").insert({
      user_id: user.id, date, member_id: memberId || null, investment_type: type,
      institution: institution || null, amount: Number(amount),
      source_of_funds: source,
      linked_maturity_id: source !== "Fresh Income" && linkedMat ? linkedMat : null,
      fresh_topup_amount: source === "Partial Reinvestment" ? Number(freshTop) || 0 : 0,
      bank_account_id: bankId, maturity_date: maturityDate || null,
      expected_maturity_amount: expected ? Number(expected) : null,
      status: "Active", notes: notes || null,
    });
    if (error) { toast.error(error.message); setBusy(false); return; }
    qc.invalidateQueries({ queryKey: ["investments"] });
    toast.success("Investment added");
    setOpen(false);
    setAmount(""); setNotes(""); setInstitution(""); setExpected(""); setMaturityDate("");
    setBusy(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Add investment</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add investment</DialogTitle>
          <DialogDescription>Money going into an investment.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Member">
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{(members.data ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Type">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Institution / Scheme"><Input value={institution} onChange={(e) => setInstitution(e.target.value)} /></Field>
          <Field label="Amount (₹)"><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Source of funds">
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {source !== "Fresh Income" && (
            <Field label="Linked maturity event" full>
              <Select value={linkedMat} onValueChange={setLinkedMat}>
                <SelectTrigger><SelectValue placeholder="Pick past investment" /></SelectTrigger>
                <SelectContent>
                  {(invs.data ?? []).filter((i) => i.status === "Matured").map((i) => (
                    <SelectItem key={i.id} value={i.id}>{fmtDate(i.date)} · {i.investment_type} · {inr(i.amount)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {source === "Partial Reinvestment" && (
            <Field label="Fresh top-up (₹)"><Input type="number" value={freshTop} onChange={(e) => setFreshTop(e.target.value)} /></Field>
          )}
          <Field label="Paid from">
            <Select value={bankId} onValueChange={setBankId}>
              <SelectTrigger><SelectValue placeholder="Bank account" /></SelectTrigger>
              <SelectContent>{(accts.data ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Maturity date"><Input type="date" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} /></Field>
          <Field label="Expected maturity (₹)"><Input type="number" value={expected} onChange={(e) => setExpected(e.target.value)} /></Field>
          <Field label="Notes" full><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Confirm & save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MarkMaturedButton({ id, accountId }: { id: string; accountId: string | undefined }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [actual, setActual] = useState("");
  const [tds, setTds] = useState("0");
  const [bank, setBank] = useState(accountId ?? "");
  const accts = useBankAccounts();
  const invs = useInvestments();
  const inv = invs.data?.find((i) => i.id === id);

  async function go() {
    if (!actual || !bank) { toast.error("Amount and account required"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !inv) return;
    const net = Math.max(0, Number(actual) - (Number(tds) || 0));
    // create income record
    const { error: e1 } = await supabase.from("incomes").insert({
      user_id: user.id, date: today(), member_id: inv.member_id,
      income_type: inv.investment_type === "FD" ? "FD Maturity" : "Investment Maturity",
      amount: Number(actual), tds: Number(tds) || 0, net_amount: net,
      bank_account_id: bank, linked_investment_id: id,
      notes: `Maturity of ${inv.investment_type} ${inv.institution ?? ""}`,
    });
    if (e1) { toast.error(e1.message); return; }
    await supabase.from("investments").update({ status: "Matured" }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["investments"] });
    qc.invalidateQueries({ queryKey: ["incomes"] });
    toast.success("Marked matured and income recorded");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm">Mark matured</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Mark as matured</DialogTitle><DialogDescription>This creates a matching income record.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Actual maturity (₹)"><Input type="number" value={actual} onChange={(e) => setActual(e.target.value)} /></Field>
          <Field label="TDS deducted (₹)"><Input type="number" value={tds} onChange={(e) => setTds(e.target.value)} /></Field>
          <Field label="Received in" full>
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
