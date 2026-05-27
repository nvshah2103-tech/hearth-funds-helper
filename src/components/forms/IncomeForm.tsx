import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useMembers, useBankAccounts, useIncomes, useInvestments } from "@/lib/data-hooks";
import { today } from "@/lib/format";

const TYPES = ["Salary", "Business Income", "FD Maturity", "Investment Maturity", "Dividend", "Interest", "Other"] as const;
const TDS_TYPES = new Set(["Salary", "FD Maturity", "Investment Maturity", "Dividend", "Interest"]);

export function AddIncomeButton({ defaultType }: { defaultType?: string }) {
  const members = useMembers();
  const accts = useBankAccounts();
  const invs = useInvestments();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today());
  const [memberId, setMemberId] = useState<string>("");
  const [incomeType, setIncomeType] = useState<string>(defaultType ?? "Salary");
  const [amount, setAmount] = useState("");
  const [tds, setTds] = useState("0");
  const [bankId, setBankId] = useState<string>("");
  const [linkedInv, setLinkedInv] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const showTds = TDS_TYPES.has(incomeType);
  const showLinked = incomeType === "FD Maturity" || incomeType === "Investment Maturity";
  const net = Math.max(0, (Number(amount) || 0) - (Number(tds) || 0));

  async function save() {
    if (!amount || !bankId) { toast.error("Amount and account are required"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    const payload = {
      user_id: user.id, date, member_id: memberId || null, income_type: incomeType,
      amount: Number(amount), tds: showTds ? Number(tds) || 0 : 0,
      net_amount: net, bank_account_id: bankId,
      linked_investment_id: showLinked && linkedInv ? linkedInv : null,
      notes: notes || null,
    };
    const { error } = await supabase.from("incomes").insert(payload);
    if (error) { toast.error(error.message); setBusy(false); return; }

    // If this is a maturity and linked, mark the investment as Matured
    if (showLinked && linkedInv) {
      await supabase.from("investments").update({ status: "Matured" }).eq("id", linkedInv);
      qc.invalidateQueries({ queryKey: ["investments"] });
    }
    qc.invalidateQueries({ queryKey: ["incomes"] });
    toast.success("Income added");
    setOpen(false);
    setAmount(""); setTds("0"); setNotes(""); setLinkedInv("");
    setBusy(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-1" />Add income</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add income</DialogTitle>
          <DialogDescription>Money received into a bank account.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Member">
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{(members.data ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Income type">
            <Select value={incomeType} onValueChange={setIncomeType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Amount (₹)"><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          {showTds && <Field label="TDS deducted (₹)"><Input type="number" value={tds} onChange={(e) => setTds(e.target.value)} /></Field>}
          <Field label="Net received (₹)"><Input value={net.toString()} readOnly className="bg-muted" /></Field>
          <Field label="Received in" full={!showTds}>
            <Select value={bankId} onValueChange={setBankId}>
              <SelectTrigger><SelectValue placeholder="Bank account" /></SelectTrigger>
              <SelectContent>{(accts.data ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {showLinked && (
            <Field label="Linked maturity (optional)" full>
              <Select value={linkedInv} onValueChange={setLinkedInv}>
                <SelectTrigger><SelectValue placeholder="Pick the matured investment" /></SelectTrigger>
                <SelectContent>
                  {(invs.data ?? []).filter((i) => i.status === "Active").map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.investment_type} · {i.institution ?? ""} · ₹{i.amount}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Notes / Reference" full><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Confirm & save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`space-y-1 ${full ? "col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

export function DeleteRow({ table, id, onDeleted }: { table: string; id: string; onDeleted: () => void }) {
  async function go() {
    if (!confirm("Delete this record?")) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from as any)(table).delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); onDeleted(); }
  }
  return <Button variant="ghost" size="icon" onClick={go}><Trash2 className="h-4 w-4 text-destructive" /></Button>;
}
