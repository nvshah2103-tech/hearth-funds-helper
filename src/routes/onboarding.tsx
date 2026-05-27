import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Trash2, ArrowRight, Wallet, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

type DraftMember = { name: string; is_business: boolean };
type DraftAcct = { name: string; bank_name: string; account_type: string; opening_balance: string };
type DraftCard = { name: string; bank_name: string; member_idx: number | null };
type DraftEmi = {
  name: string; lender: string; total_loan_amount: string; emi_amount: string;
  due_day: string; start_date: string; end_date: string; bank_idx: number | null;
};

function Onboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [familyName, setFamilyName] = useState("");
  const [members, setMembers] = useState<DraftMember[]>([
    { name: "", is_business: false },
    { name: "", is_business: false },
    { name: "", is_business: true },
  ]);
  const [accts, setAccts] = useState<DraftAcct[]>(
    Array.from({ length: 11 }, () => ({ name: "", bank_name: "", account_type: "Savings", opening_balance: "0" })),
  );
  const [cards, setCards] = useState<DraftCard[]>(
    Array.from({ length: 3 }, () => ({ name: "", bank_name: "", member_idx: null })),
  );
  const [emis, setEmis] = useState<DraftEmi[]>([{
    name: "", lender: "", total_loan_amount: "", emi_amount: "",
    due_day: "5", start_date: "", end_date: "", bank_idx: null,
  }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

  function addMember() { setMembers([...members, { name: "", is_business: false }]); }
  function rmMember(i: number) { if (members.length > 1) setMembers(members.filter((_, j) => j !== i)); }
  function addAcct() { setAccts([...accts, { name: "", bank_name: "", account_type: "Savings", opening_balance: "0" }]); }
  function rmAcct(i: number) { if (accts.length > 1) setAccts(accts.filter((_, j) => j !== i)); }
  function addCard() { setCards([...cards, { name: "", bank_name: "", member_idx: null }]); }
  function rmCard(i: number) { setCards(cards.filter((_, j) => j !== i)); }
  function addEmi() { setEmis([...emis, { name: "", lender: "", total_loan_amount: "", emi_amount: "", due_day: "5", start_date: "", end_date: "", bank_idx: null }]); }
  function rmEmi(i: number) { setEmis(emis.filter((_, j) => j !== i)); }

  async function finish() {
    if (!user) return;
    setSaving(true);
    try {
      // members
      const mPayload = members.filter((m) => m.name.trim()).map((m) => ({ user_id: user.id, name: m.name.trim(), is_business: m.is_business }));
      if (!mPayload.length) throw new Error("Add at least one family member.");
      const { data: mRows, error: mErr } = await supabase.from("members").insert(mPayload).select();
      if (mErr) throw mErr;

      // accounts
      const aPayload = accts.filter((a) => a.name.trim()).map((a) => ({
        user_id: user.id, name: a.name.trim(), bank_name: a.bank_name.trim() || null,
        account_type: a.account_type, opening_balance: Number(a.opening_balance) || 0,
      }));
      if (!aPayload.length) throw new Error("Add at least one bank account.");
      const { data: aRows, error: aErr } = await supabase.from("bank_accounts").insert(aPayload).select();
      if (aErr) throw aErr;

      // cards
      const validCards = cards.filter((c) => c.name.trim());
      if (validCards.length) {
        const cPayload = validCards.map((c) => ({
          user_id: user.id, name: c.name.trim(), bank_name: c.bank_name.trim() || null,
          member_id: c.member_idx != null ? mRows![c.member_idx]?.id ?? null : null,
        }));
        const { error: cErr } = await supabase.from("credit_cards").insert(cPayload);
        if (cErr) throw cErr;
      }

      // emis
      const validEmis = emis.filter((e) => e.name.trim() && Number(e.emi_amount) > 0);
      if (validEmis.length) {
        const ePayload = validEmis.map((e) => ({
          user_id: user.id, name: e.name.trim(), lender: e.lender.trim() || null,
          total_loan_amount: Number(e.total_loan_amount) || 0,
          emi_amount: Number(e.emi_amount), due_day: Number(e.due_day) || 1,
          start_date: e.start_date || null, end_date: e.end_date || null,
          bank_account_id: e.bank_idx != null ? aRows![e.bank_idx]?.id ?? null : null,
        }));
        const { error: eErr } = await supabase.from("emis").insert(ePayload);
        if (eErr) throw eErr;
      }

      await supabase.from("profiles").update({ family_name: familyName || "My Family", onboarded: true }).eq("id", user.id);
      toast.success("Setup complete!");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Setup failed");
    } finally { setSaving(false); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent to-background p-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Welcome to FamilyLedger</h1>
            <p className="text-sm text-muted-foreground">Step {step} of 5 — let's set up your family's finances.</p>
          </div>
        </div>

        <div className="flex gap-1 mb-6">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {step === 1 && "Family & Members"}
              {step === 2 && "Bank Accounts"}
              {step === 3 && "Credit Cards"}
              {step === 4 && "Active Loans / EMIs"}
              {step === 5 && "Review & Confirm"}
            </CardTitle>
            <CardDescription>
              {step === 1 && "Name your family and list each member."}
              {step === 2 && "Add every bank account. You can edit later."}
              {step === 3 && "Add credit cards (optional). Skip if none."}
              {step === 4 && "Add ongoing loans. Skip if none."}
              {step === 5 && "Confirm everything looks right."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label>Family Name</Label>
                  <Input placeholder="e.g. The Sharma Family" value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
                </div>
                <div className="space-y-3">
                  <Label>Members</Label>
                  {members.map((m, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input placeholder={`Member ${i + 1} name`} value={m.name}
                        onChange={(e) => setMembers(members.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                      <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                        <Checkbox checked={m.is_business} onCheckedChange={(v) => setMembers(members.map((x, j) => j === i ? { ...x, is_business: !!v } : x))} />
                        Has business income
                      </label>
                      <Button variant="ghost" size="icon" onClick={() => rmMember(i)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addMember}><Plus className="h-4 w-4 mr-1" />Add member</Button>
                </div>
              </>
            )}

            {step === 2 && (
              <div className="space-y-3">
                {accts.map((a, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <Input className="col-span-4" placeholder="Account label (e.g. HDFC Salary)" value={a.name}
                      onChange={(e) => setAccts(accts.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                    <Input className="col-span-3" placeholder="Bank" value={a.bank_name}
                      onChange={(e) => setAccts(accts.map((x, j) => j === i ? { ...x, bank_name: e.target.value } : x))} />
                    <div className="col-span-2">
                      <Select value={a.account_type} onValueChange={(v) => setAccts(accts.map((x, j) => j === i ? { ...x, account_type: v } : x))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Savings">Savings</SelectItem>
                          <SelectItem value="Current">Current</SelectItem>
                          <SelectItem value="Joint">Joint</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input className="col-span-2" type="number" placeholder="Opening ₹" value={a.opening_balance}
                      onChange={(e) => setAccts(accts.map((x, j) => j === i ? { ...x, opening_balance: e.target.value } : x))} />
                    <Button className="col-span-1" variant="ghost" size="icon" onClick={() => rmAcct(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addAcct}><Plus className="h-4 w-4 mr-1" />Add account</Button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                {cards.map((c, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <Input className="col-span-4" placeholder="Card label" value={c.name}
                      onChange={(e) => setCards(cards.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                    <Input className="col-span-4" placeholder="Issuing bank" value={c.bank_name}
                      onChange={(e) => setCards(cards.map((x, j) => j === i ? { ...x, bank_name: e.target.value } : x))} />
                    <div className="col-span-3">
                      <Select value={c.member_idx?.toString() ?? ""}
                        onValueChange={(v) => setCards(cards.map((x, j) => j === i ? { ...x, member_idx: v ? Number(v) : null } : x))}>
                        <SelectTrigger><SelectValue placeholder="Belongs to" /></SelectTrigger>
                        <SelectContent>
                          {members.map((m, idx) => m.name && (<SelectItem key={idx} value={idx.toString()}>{m.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="col-span-1" variant="ghost" size="icon" onClick={() => rmCard(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addCard}><Plus className="h-4 w-4 mr-1" />Add card</Button>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                {emis.map((e, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 p-3 rounded-lg border">
                    <Input className="col-span-6" placeholder="Loan name (e.g. Home Loan)" value={e.name}
                      onChange={(ev) => setEmis(emis.map((x, j) => j === i ? { ...x, name: ev.target.value } : x))} />
                    <Input className="col-span-5" placeholder="Lender" value={e.lender}
                      onChange={(ev) => setEmis(emis.map((x, j) => j === i ? { ...x, lender: ev.target.value } : x))} />
                    <Button className="col-span-1" variant="ghost" size="icon" onClick={() => rmEmi(i)}><Trash2 className="h-4 w-4" /></Button>
                    <Input className="col-span-3" type="number" placeholder="Total loan ₹" value={e.total_loan_amount}
                      onChange={(ev) => setEmis(emis.map((x, j) => j === i ? { ...x, total_loan_amount: ev.target.value } : x))} />
                    <Input className="col-span-3" type="number" placeholder="EMI amount ₹" value={e.emi_amount}
                      onChange={(ev) => setEmis(emis.map((x, j) => j === i ? { ...x, emi_amount: ev.target.value } : x))} />
                    <Input className="col-span-2" type="number" placeholder="Due day" value={e.due_day}
                      onChange={(ev) => setEmis(emis.map((x, j) => j === i ? { ...x, due_day: ev.target.value } : x))} />
                    <Input className="col-span-2" type="date" value={e.start_date}
                      onChange={(ev) => setEmis(emis.map((x, j) => j === i ? { ...x, start_date: ev.target.value } : x))} />
                    <Input className="col-span-2" type="date" value={e.end_date}
                      onChange={(ev) => setEmis(emis.map((x, j) => j === i ? { ...x, end_date: ev.target.value } : x))} />
                    <div className="col-span-12">
                      <Select value={e.bank_idx?.toString() ?? ""}
                        onValueChange={(v) => setEmis(emis.map((x, j) => j === i ? { ...x, bank_idx: v ? Number(v) : null } : x))}>
                        <SelectTrigger><SelectValue placeholder="Paid from account" /></SelectTrigger>
                        <SelectContent>
                          {accts.map((a, idx) => a.name && (<SelectItem key={idx} value={idx.toString()}>{a.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addEmi}><Plus className="h-4 w-4 mr-1" />Add loan</Button>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-3 text-sm">
                <Row k="Family" v={familyName || "—"} />
                <Row k="Members" v={members.filter((m) => m.name).map((m) => m.name).join(", ") || "—"} />
                <Row k="Bank accounts" v={`${accts.filter((a) => a.name).length} accounts`} />
                <Row k="Credit cards" v={`${cards.filter((c) => c.name).length} cards`} />
                <Row k="Active loans" v={`${emis.filter((e) => e.name && Number(e.emi_amount) > 0).length} loans`} />
                <div className="rounded-md bg-accent p-3 text-accent-foreground flex items-start gap-2 mt-4">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 text-success" />
                  <div>Everything saves to your private ledger. You can edit any of this later from Settings.</div>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" disabled={step === 1 || saving} onClick={() => setStep(step - 1)}>Back</Button>
              {step < 5 ? (
                <Button onClick={() => setStep(step + 1)}>Next <ArrowRight className="h-4 w-4 ml-1" /></Button>
              ) : (
                <Button onClick={finish} disabled={saving}>{saving ? "Saving…" : "Finish setup"}</Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b py-2"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>
  );
}
