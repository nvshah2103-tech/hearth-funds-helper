import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Check } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMembers, useBankAccounts, useCreditCards, useEmis, useInvestments } from "@/lib/data-hooks";
import { useExpenseCategories, DEFAULT_CATEGORIES } from "@/lib/expense-hooks";
import { today, inr } from "@/lib/format";
import { getTDSSection, getTDSSectionByCode } from "@/lib/tds-constants";
import { TDSSectionPicker } from "@/components/forms/IncomeForm";
import { TypeSelect } from "@/components/TypeSelect";
import { cn } from "@/lib/utils";

type Tab = "expense" | "income" | "investment" | "transfer" | "cc" | "emi";
const TABS: { id: Tab; label: string }[] = [
  { id: "expense", label: "Expense" },
  { id: "income", label: "Income" },
  { id: "investment", label: "Investment" },
  { id: "transfer", label: "Transfer" },
  { id: "cc", label: "CC Bill" },
  { id: "emi", label: "EMI" },
];

export function QuickEntryFab() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("expense");
  const isMobile = useIsMobile();

  const Btn = (
    <button
      aria-label="Add entry"
      onClick={() => setOpen(true)}
      className={cn(
        "fixed z-[9999] rounded-full bg-primary text-primary-foreground",
        "flex items-center justify-center transition-transform",
        "shadow-[0_8px_32px_rgba(109,40,217,0.4)] hover:scale-110 active:scale-95",
        // Mobile: bottom center. Desktop: bottom left.
        "bottom-6 left-1/2 -translate-x-1/2 md:left-6 md:translate-x-0 md:bottom-8",
      )}
      style={{ width: isMobile ? 52 : 56, height: isMobile ? 52 : 56 }}
    >
      <Plus className="h-6 w-6" />
    </button>
  );

  const Body = (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b">
        <div className="font-semibold">Add Entry</div>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="flex-1 flex flex-col min-h-0">
        <div className="border-b overflow-x-auto">
          <TabsList className="bg-transparent rounded-none h-auto p-0 px-2">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-4 py-3"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <TabsContent value="expense" className="m-0"><ExpenseForm onDone={() => setOpen(false)} /></TabsContent>
          <TabsContent value="income" className="m-0"><IncomeQuick onDone={() => setOpen(false)} /></TabsContent>
          <TabsContent value="investment" className="m-0"><InvestmentQuick onDone={() => setOpen(false)} /></TabsContent>
          <TabsContent value="transfer" className="m-0"><TransferQuick onDone={() => setOpen(false)} /></TabsContent>
          <TabsContent value="cc" className="m-0"><CCBillQuick onDone={() => setOpen(false)} /></TabsContent>
          <TabsContent value="emi" className="m-0"><EmiQuick onDone={() => setOpen(false)} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );

  return (
    <>
      {Btn}
      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="h-[85vh] p-0 flex flex-col">{Body}</SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-xl p-0 h-[640px] flex flex-col gap-0">{Body}</DialogContent>
        </Dialog>
      )}
    </>
  );
}

/* ---------------- EXPENSE FORM (unified) ---------------- */
function ExpenseForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const cats = useExpenseCategories();
  const accts = useBankAccounts();
  const members = useMembers();

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [paidFrom, setPaidFrom] = useState<string>("cash");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [time, setTime] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [paidTo, setPaidTo] = useState("");
  const [payeeSuggestions, setPayeeSuggestions] = useState<string[]>([]);
  const [showSug, setShowSug] = useState(false);
  const [upiId, setUpiId] = useState("");
  const [upiRef, setUpiRef] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [tags, setTags] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [freq, setFreq] = useState("Monthly");
  const [memberId, setMemberId] = useState<string>("");
  const [isBusiness, setIsBusiness] = useState(false);
  const [gst, setGst] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newAcctOpen, setNewAcctOpen] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => { amountRef.current?.focus(); }, []);

  // Load recent unique paid-to names once
  useEffect(() => {
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from as any)("expenses")
        .select("paid_to_name")
        .not("paid_to_name", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);
      const uniq = Array.from(new Set(((data ?? []) as { paid_to_name: string }[])
        .map((r) => r.paid_to_name).filter(Boolean)));
      setPayeeSuggestions(uniq);
    })();
  }, []);

  const matchedPayees = paidTo.trim().length >= 2
    ? payeeSuggestions.filter((n) => n.toLowerCase().includes(paidTo.toLowerCase()) && n.toLowerCase() !== paidTo.toLowerCase()).slice(0, 6)
    : [];

  const categoryList = (cats.data ?? []).map((c) => c.name);
  const allCats = categoryList.length ? categoryList : [...DEFAULT_CATEGORIES];

  async function save() {
    if (!amount || Number(amount) <= 0) { toast.error("Amount is required"); return; }
    if (!category) { toast.error("Pick a category"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    const payload = {
      user_id: user.id, date, time: time || null,
      amount: Number(amount), category,
      paid_from_account_id: paidFrom === "cash" ? null : paidFrom,
      payment_method: paymentMethod || null,
      paid_to_name: paidTo || null,
      upi_id: paymentMethod === "UPI" ? (upiId || null) : null,
      upi_reference: paymentMethod === "UPI" ? (upiRef || null) : null,
      cheque_number: paymentMethod === "Cheque" ? (chequeNo || null) : null,
      note: note || null,
      tags: tags ? tags.split(",").map((s) => s.trim()).filter(Boolean) : null,
      is_recurring: recurring,
      recurring_frequency: recurring ? freq : null,
      member_id: memberId || null,
      is_business_expense: isBusiness,
      gst_number: gst || null,
      is_imported: false,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from as any)("expenses").insert(payload);
    if (error) { toast.error(error.message); setBusy(false); return; }
    qc.invalidateQueries({ queryKey: ["expenses"] });
    setSaved(true);
    setTimeout(() => { setSaved(false); onDone(); resetAll(); }, 800);
    setBusy(false);
  }

  function resetAll() {
    setAmount(""); setCategory(""); setPaidFrom("cash"); setNote("");
    setTime(""); setPaymentMethod(""); setPaidTo(""); setUpiId(""); setUpiRef("");
    setChequeNo(""); setTags(""); setRecurring(false); setMemberId(""); setIsBusiness(false); setGst("");
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-success">
        <div className="rounded-full bg-success/10 p-4 mb-3"><Check className="h-8 w-8" /></div>
        <p className="font-semibold">Saved</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-3xl text-muted-foreground">₹</span>
        <Input
          ref={amountRef}
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="text-3xl h-16 pl-10 font-mono"
        />
      </div>

      <div>
        <Label className="text-xs">Category</Label>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {allCats.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm whitespace-nowrap border transition-colors shrink-0",
                category === c ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Paid From</Label>
          <Select value={paidFrom} onValueChange={(v) => { if (v === "__new__") { setNewAcctOpen(true); } else { setPaidFrom(v); } }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              {(accts.data ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              <SelectItem value="__new__">+ Add new account</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div>
        <Label className="text-xs">Payment Method</Label>
        <div className="flex flex-wrap gap-2">
          {["UPI", "Cash", "Debit Card", "NEFT/IMPS", "Cheque", "Other"].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPaymentMethod(p)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs border transition-colors",
                paymentMethod === p ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <Label className="text-xs">Paid To</Label>
        <Input
          value={paidTo}
          onChange={(e) => { setPaidTo(e.target.value); setShowSug(true); }}
          onFocus={() => setShowSug(true)}
          onBlur={() => setTimeout(() => setShowSug(false), 150)}
          placeholder="Person or merchant name"
        />
        {showSug && matchedPayees.length > 0 && (
          <div className="absolute z-50 left-0 right-0 mt-1 rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
            {matchedPayees.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => { setPaidTo(n); setShowSug(false); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>

      {paymentMethod === "UPI" && (
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">UPI ID</Label><Input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="name@bank" /></div>
          <div><Label className="text-xs">UPI Ref / Txn ID</Label><Input value={upiRef} onChange={(e) => setUpiRef(e.target.value)} /></div>
        </div>
      )}
      {paymentMethod === "Cheque" && (
        <div><Label className="text-xs">Cheque Number</Label><Input value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} /></div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Time (optional)</Label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Member (optional)</Label>
          <Select value={memberId} onValueChange={setMemberId}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{(members.data ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-xs">Note</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was this for? (optional)" />
      </div>

      <details className="rounded-md border p-3">
        <summary className="cursor-pointer text-sm text-muted-foreground">More options</summary>
        <div className="space-y-3 pt-3">
          <div><Label className="text-xs">Tags (comma separated)</Label><Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="household, monthly" /></div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Recurring?</Label>
            <Switch checked={recurring} onCheckedChange={setRecurring} />
          </div>
          {recurring && (
            <Select value={freq} onValueChange={setFreq}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Daily">Daily</SelectItem>
                <SelectItem value="Weekly">Weekly</SelectItem>
                <SelectItem value="Monthly">Monthly</SelectItem>
                <SelectItem value="Yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center justify-between">
            <Label className="text-xs">Business expense?</Label>
            <Switch checked={isBusiness} onCheckedChange={setIsBusiness} />
          </div>
          {isBusiness && (
            <div><Label className="text-xs">GST / Receipt No</Label><Input value={gst} onChange={(e) => setGst(e.target.value)} /></div>
          )}
        </div>
      </details>

      <Button onClick={save} disabled={busy} className="w-full h-12 text-base">
        {busy ? "Saving…" : "Save Expense"}
      </Button>

      <NewAccountDialog
        open={newAcctOpen}
        onOpenChange={setNewAcctOpen}
        onCreated={(id) => { setPaidFrom(id); qc.invalidateQueries({ queryKey: ["bank_accounts"] }); }}
      />
    </div>
  );
}

/* Mini bank-account creator used inline. */
function NewAccountDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [type, setType] = useState("Savings");
  const [opening, setOpening] = useState("0");
  const [busy, setBusy] = useState(false);
  async function create() {
    if (!name.trim()) { toast.error("Name required"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from as any)("bank_accounts")
      .insert({ user_id: user.id, name, bank_name: bankName || null, account_type: type, opening_balance: Number(opening) || 0 })
      .select("id").single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Account added");
    onCreated(data.id);
    onOpenChange(false);
    setName(""); setBankName(""); setOpening("0");
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <div className="space-y-3">
          <div className="font-semibold">Add Account / Wallet</div>
          <div><Label className="text-xs">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HDFC Savings, PhonePe Wallet" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Bank / Provider</Label><Input value={bankName} onChange={(e) => setBankName(e.target.value)} /></div>
            <div><Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Savings","Current","Wallet","Cash","Other"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label className="text-xs">Opening Balance</Label><Input type="number" value={opening} onChange={(e) => setOpening(e.target.value)} /></div>
          <Button onClick={create} disabled={busy} className="w-full">{busy ? "Adding…" : "Add"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


/* ---------------- INCOME QUICK (with TDS UX) ---------------- */
function IncomeQuick({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const members = useMembers();
  const accts = useBankAccounts();
  const [date, setDate] = useState(today());
  const [type, setType] = useState("Salary");
  const [gross, setGross] = useState("");
  const [tds, setTds] = useState("0");
  const [tdsTouched, setTdsTouched] = useState(false);
  const [tdsSection, setTdsSection] = useState<string>(getTDSSection("Salary"));
  const [tdsConfirmed, setTdsConfirmed] = useState(true);
  const [tdsRate, setTdsRate] = useState<string>(String(getTDSSectionByCode(getTDSSection("Salary"))?.rate ?? 0));
  const [memberId, setMemberId] = useState("");
  const [bankId, setBankId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const code = getTDSSection(type);
    setTdsSection(code);
    setTdsConfirmed(true);
    const s = getTDSSectionByCode(code);
    if (s) setTdsRate(String(s.rate));
  }, [type]);

  useEffect(() => {
    const s = getTDSSectionByCode(tdsSection);
    if (s) setTdsRate(String(s.rate));
  }, [tdsSection]);

  useEffect(() => {
    if (tdsTouched) return;
    const calc = +(((Number(gross) || 0) * (Number(tdsRate) || 0)) / 100).toFixed(2);
    setTds(String(calc));
  }, [gross, tdsRate, tdsTouched]);

  const net = Math.max(0, (Number(gross) || 0) - (Number(tds) || 0));

  async function save() {
    if (!gross || !bankId) { toast.error("Amount and account required"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("incomes").insert({
      user_id: user.id, date, member_id: memberId || null, income_type: type,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      amount: Number(gross), gross_amount: Number(gross), tds: Number(tds) || 0, net_amount: net,
      tds_section: tdsSection || null, tds_rate: tdsRate ? Number(tdsRate) : null,
      tds_section_confirmed: tdsConfirmed,
      bank_account_id: bankId, notes: note || null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["incomes"] });
    toast.success("Income added"); onDone();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Gross Amount</Label><Input type="number" value={gross} onChange={(e) => setGross(e.target.value)} /></div>
        <div><Label className="text-xs">Type</Label>
          <TypeSelect value={type} onChange={setType} kind="income"
            base={["Salary","Business Income","FD Maturity","Dividend","Interest","Rental","Other"]} />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">TDS Section</Label>
          <TDSSectionPicker section={tdsSection} setSection={setTdsSection} confirmed={tdsConfirmed} setConfirmed={setTdsConfirmed} />
        </div>
        <div><Label className="text-xs">TDS Rate %</Label><Input type="number" step="0.01" value={tdsRate} onChange={(e) => { setTdsRate(e.target.value); setTdsTouched(false); }} /></div>
        <div><Label className="text-xs">TDS Amount</Label><Input type="number" value={tds} onChange={(e) => { setTds(e.target.value); setTdsTouched(true); }} /></div>
        <div><Label className="text-xs">Net</Label><Input value={net} readOnly className="bg-muted" /></div>
        <div><Label className="text-xs">Member</Label>
          <Select value={memberId} onValueChange={setMemberId}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{(members.data ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Received In</Label>
          <Select value={bankId} onValueChange={setBankId}>
            <SelectTrigger><SelectValue placeholder="Bank account" /></SelectTrigger>
            <SelectContent>{(accts.data ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <div><Label className="text-xs">Note</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <Button onClick={save} disabled={busy} className="w-full h-12">{busy ? "Saving…" : "Save Income"}</Button>
    </div>
  );
}

/* ---------------- INVESTMENT QUICK (dynamic by type) ---------------- */
function InvestmentQuick({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const accts = useBankAccounts();
  const [type, setType] = useState("FD");
  const [institution, setInstitution] = useState("");
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("Fresh Income");
  const [bankId, setBankId] = useState("");
  const [maturityDate, setMaturityDate] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Dynamic fields
  const [fdNumber, setFdNumber] = useState("");
  const [fdType, setFdType] = useState("Cumulative");
  const [folioNumber, setFolioNumber] = useState("");
  const [isin, setIsin] = useState("");
  const [symbol, setSymbol] = useState("");
  const [units, setUnits] = useState("");
  const [nav, setNav] = useState("");
  const [weight, setWeight] = useState("");
  const [purity, setPurity] = useState("24K");

  const isFD = type === "FD" || type === "RD";
  const isMF = type === "Mutual Fund";
  const isStock = type === "Stock";
  const isGold = type === "Gold";

  async function save() {
    if (!amount) { toast.error("Amount required"); return; }
    if (isFD && !fdNumber) { toast.error("FD Number is required"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = {
      user_id: user.id, date, investment_type: type, institution: institution || null,
      amount: Number(amount), source_of_funds: source, bank_account_id: bankId || null,
      maturity_date: maturityDate || null, status: "Active", notes: note || null,
    };
    if (isFD) { payload.fd_number = fdNumber; payload.fd_type = fdType; }
    if (isMF) { payload.folio_number = folioNumber || null; payload.isin = isin || null; payload.units = units ? Number(units) : null; payload.nav_at_purchase = nav ? Number(nav) : null; }
    if (isStock) { payload.symbol = symbol || null; payload.isin = isin || null; payload.units = units ? Number(units) : null; payload.nav_at_purchase = nav ? Number(nav) : null; payload.exchange = "NSE"; }
    if (isGold) { payload.weight_grams = weight ? Number(weight) : null; payload.purity = purity; payload.nav_at_purchase = nav ? Number(nav) : null; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("investments") as any).insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["investments"] });
    toast.success("Investment added"); onDone();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["FD","RD","Mutual Fund","Stock","Gold","PPF","NPS","Bond","Other"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Institution</Label><Input value={institution} onChange={(e) => setInstitution(e.target.value)} /></div>
        <div><Label className="text-xs">Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div><Label className="text-xs">Source</Label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["Fresh Income","Reinvestment","Partial Reinvestment"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Paid From</Label>
          <Select value={bankId} onValueChange={setBankId}>
            <SelectTrigger><SelectValue placeholder="Bank" /></SelectTrigger>
            <SelectContent>{(accts.data ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="col-span-2"><Label className="text-xs">Maturity Date</Label><Input type="date" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} /></div>

        {isFD && <>
          <div><Label className="text-xs">FD Number *</Label><Input value={fdNumber} onChange={(e) => setFdNumber(e.target.value)} /></div>
          <div><Label className="text-xs">FD Type</Label>
            <Select value={fdType} onValueChange={setFdType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Cumulative">Cumulative</SelectItem><SelectItem value="Non-Cumulative">Non-Cumulative</SelectItem></SelectContent>
            </Select>
          </div>
        </>}
        {isMF && <>
          <div><Label className="text-xs">Folio</Label><Input value={folioNumber} onChange={(e) => setFolioNumber(e.target.value)} /></div>
          <div><Label className="text-xs">ISIN</Label><Input value={isin} onChange={(e) => setIsin(e.target.value)} /></div>
          <div><Label className="text-xs">NAV</Label><Input type="number" step="0.0001" value={nav} onChange={(e) => setNav(e.target.value)} /></div>
          <div><Label className="text-xs">Units</Label><Input type="number" step="0.0001" value={units} onChange={(e) => setUnits(e.target.value)} /></div>
        </>}
        {isStock && <>
          <div><Label className="text-xs">Symbol</Label><Input value={symbol} onChange={(e) => setSymbol(e.target.value)} /></div>
          <div><Label className="text-xs">ISIN</Label><Input value={isin} onChange={(e) => setIsin(e.target.value)} /></div>
          <div><Label className="text-xs">Quantity</Label><Input type="number" value={units} onChange={(e) => setUnits(e.target.value)} /></div>
          <div><Label className="text-xs">Price/share</Label><Input type="number" step="0.01" value={nav} onChange={(e) => setNav(e.target.value)} /></div>
        </>}
        {isGold && <>
          <div><Label className="text-xs">Weight (g)</Label><Input type="number" step="0.001" value={weight} onChange={(e) => setWeight(e.target.value)} /></div>
          <div><Label className="text-xs">Purity</Label>
            <Select value={purity} onValueChange={setPurity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["24K","22K","18K"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label className="text-xs">Price per gram</Label><Input type="number" step="0.01" value={nav} onChange={(e) => setNav(e.target.value)} /></div>
        </>}
      </div>
      <div><Label className="text-xs">Note</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <Button onClick={save} disabled={busy} className="w-full h-12">{busy ? "Saving…" : "Save Investment"}</Button>
    </div>
  );
}

/* ---------------- TRANSFER QUICK ---------------- */
function TransferQuick({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const accts = useBankAccounts();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!fromId || !toId || !amount) { toast.error("All fields required"); return; }
    if (fromId === toId) { toast.error("From and To must differ"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("transfers").insert({
      user_id: user.id, date, from_account_id: fromId, to_account_id: toId,
      amount: Number(amount), reason: reason || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["transfers"] });
    toast.success("Transfer saved"); onDone();
  }

  return (
    <div className="space-y-3">
      <div className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 p-3 rounded-md">
        Transfers between your own accounts will NOT be counted as income or expense.
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">From</Label>
          <Select value={fromId} onValueChange={setFromId}>
            <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
            <SelectContent>{(accts.data ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">To</Label>
          <Select value={toId} onValueChange={setToId}>
            <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
            <SelectContent>{(accts.data ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div><Label className="text-xs">Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <div><Label className="text-xs">Reason</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      <Button onClick={save} disabled={busy} className="w-full h-12">{busy ? "Saving…" : "Save Transfer"}</Button>
    </div>
  );
}

/* ---------------- CC BILL QUICK ---------------- */
function CCBillQuick({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const cards = useCreditCards();
  const accts = useBankAccounts();
  const [cardId, setCardId] = useState("");
  const [billingMonth, setBillingMonth] = useState(today().slice(0, 7) + "-01");
  const [total, setTotal] = useState("");
  const [bankId, setBankId] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!cardId || !total) { toast.error("Card and amount required"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("credit_card_bills").insert({
      user_id: user.id, card_id: cardId, billing_month: billingMonth,
      total_bill: Number(total), bank_account_id: bankId || null,
      payment_date: paymentDate || null,
      payment_amount: paymentDate ? Number(total) : 0, notes: note || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["cc_bills"] });
    toast.success("CC bill saved"); onDone();
  }

  return (
    <div className="space-y-3">
      <div><Label className="text-xs">Card</Label>
        <Select value={cardId} onValueChange={setCardId}>
          <SelectTrigger><SelectValue placeholder="Select card" /></SelectTrigger>
          <SelectContent>{(cards.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Billing Month</Label><Input type="month" value={billingMonth.slice(0,7)} onChange={(e) => setBillingMonth(e.target.value + "-01")} /></div>
        <div><Label className="text-xs">Total Bill</Label><Input type="number" value={total} onChange={(e) => setTotal(e.target.value)} /></div>
        <div><Label className="text-xs">Paid From</Label>
          <Select value={bankId} onValueChange={setBankId}>
            <SelectTrigger><SelectValue placeholder="Bank" /></SelectTrigger>
            <SelectContent>{(accts.data ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Payment Date</Label><Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></div>
      </div>
      <div><Label className="text-xs">Note</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <Button onClick={save} disabled={busy} className="w-full h-12">{busy ? "Saving…" : "Save CC Bill"}</Button>
    </div>
  );
}

/* ---------------- EMI QUICK ---------------- */
function EmiQuick({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const emis = useEmis();
  const accts = useBankAccounts();
  const [emiId, setEmiId] = useState("");
  const [paidDate, setPaidDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [bankId, setBankId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!emiId || !amount) { toast.error("Loan and amount required"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("emi_payments").insert({
      user_id: user.id, emi_id: emiId, paid_date: paidDate,
      amount: Number(amount), bank_account_id: bankId || null, notes: note || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["emi_payments"] });
    toast.success("EMI marked paid"); onDone();
  }

  // prefill amount from selected loan
  const selectedEmi = (emis.data ?? []).find((e) => e.id === emiId);
  useEffect(() => { if (selectedEmi && !amount) setAmount(String(selectedEmi.emi_amount)); }, [selectedEmi]); // eslint-disable-line

  return (
    <div className="space-y-3">
      <div><Label className="text-xs">Loan</Label>
        <Select value={emiId} onValueChange={setEmiId}>
          <SelectTrigger><SelectValue placeholder="Select EMI" /></SelectTrigger>
          <SelectContent>{(emis.data ?? []).filter((e) => e.status === "Active").map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Date</Label><Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} /></div>
        <div><Label className="text-xs">Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div className="col-span-2"><Label className="text-xs">Paid From</Label>
          <Select value={bankId} onValueChange={setBankId}>
            <SelectTrigger><SelectValue placeholder="Bank" /></SelectTrigger>
            <SelectContent>{(accts.data ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div><Label className="text-xs">Note</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <Button onClick={save} disabled={busy} className="w-full h-12">{busy ? "Saving…" : "Mark EMI Paid"}</Button>
    </div>
  );
}
