import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Search } from "lucide-react";
import { useMembers, useBankAccounts, useInvestments } from "@/lib/data-hooks";
import { inr, fmtDate, today } from "@/lib/format";
import { Field } from "@/components/forms/IncomeForm";
import { ConfirmDeleteRow, ConfirmChangesDialog, diffFields } from "@/components/forms/_shared";
import { cn } from "@/lib/utils";

const TYPES = ["FD", "RD", "Mutual Fund", "Stock", "Gold", "PPF", "NPS", "Bond", "Other"] as const;
const SOURCES = ["Fresh Income", "Reinvestment", "Partial Reinvestment"] as const;
const COMPOUND = ["Quarterly", "Monthly", "Annual", "On Maturity"] as const;
const FD_TYPES = ["Cumulative", "Non-Cumulative"] as const;
const RENEWAL = ["Yes", "No", "Partial"] as const;
const FUND_TYPES = ["Equity", "Debt", "Hybrid", "ELSS", "International", "Gold Fund", "Index"] as const;
const PURITY = ["24K", "22K", "18K"] as const;
const EXCHANGES = ["NSE", "BSE"] as const;

export const Route = createFileRoute("/_authenticated/investments")({ component: InvestmentsPage });

type Window = { label: string; days: number };
const WINDOWS: Window[] = [
  { label: "30 days", days: 30 }, { label: "60 days", days: 60 }, { label: "90 days", days: 90 },
  { label: "6 months", days: 180 }, { label: "1 year", days: 365 },
];

function daysBetween(a: Date, b: Date) {
  return Math.ceil((a.getTime() - b.getTime()) / 86_400_000);
}

function InvestmentsPage() {
  const invs = useInvestments();
  const members = useMembers();
  const accts = useBankAccounts();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"active" | "going" | "matured" | "all">("active");
  const [winIdx, setWinIdx] = useState(2); // 90 days default
  const [search, setSearch] = useState("");
  const win = WINDOWS[winIdx];

  const memberName = (id: string | null) => members.data?.find((m) => m.id === id)?.name ?? "—";
  const acctName = (id: string | null) => accts.data?.find((a) => a.id === id)?.name ?? "—";

  const all = (invs.data ?? []) as unknown as InvRow[];
  const active = all.filter((i) => i.status === "Active");

  const now = new Date();
  const future = new Date(now.getTime() + win.days * 86_400_000);
  const past = new Date(now.getTime() - win.days * 86_400_000);

  const going = active.filter((i) => i.maturity_date && new Date(i.maturity_date) >= now && new Date(i.maturity_date) <= future)
    .sort((a, b) => (a.maturity_date! < b.maturity_date! ? -1 : 1));

  const recentlyMatured = all.filter((i) => {
    if (i.status !== "Matured") return false;
    const d = i.matured_date ?? i.maturity_date;
    if (!d) return false;
    const dt = new Date(d);
    return dt >= past && dt <= now;
  }).sort((a, b) => ((a.matured_date ?? a.maturity_date)! < (b.matured_date ?? b.maturity_date)! ? 1 : -1));

  const base = tab === "active" ? active : tab === "going" ? going : tab === "matured" ? recentlyMatured : all;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((i) =>
      [i.fd_number, i.institution, i.folio_number, i.isin, i.symbol, String(i.amount), i.date]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [base, search]);

  const totalActive = active.reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Investments</h1>
          <p className="text-sm text-muted-foreground">FDs, Mutual Funds, Stocks, Gold, PPF, NPS — all tracked here.</p>
        </div>
        <AddOrEditInvestmentButton />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Active</p><p className="text-2xl font-semibold">{active.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Capital deployed</p><p className="text-2xl font-semibold text-primary">{inr(totalActive)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Maturing ≤ {win.label}</p><p className="text-2xl font-semibold text-amber-500">{going.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Total records</p><p className="text-2xl font-semibold">{all.length}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search FD number, institution, folio, ISIN, symbol, amount…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="going">Going to Mature</TabsTrigger>
          <TabsTrigger value="matured">Recently Matured</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        {(tab === "going" || tab === "matured") && (
          <div className="flex flex-wrap gap-2 my-3">
            {WINDOWS.map((w, idx) => (
              <button
                key={w.label}
                onClick={() => setWinIdx(idx)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs border transition-colors",
                  winIdx === idx ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent",
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
        )}

        <TabsContent value={tab} className="mt-3">
          <Card>
            <CardHeader><CardTitle className="text-base">
              {tab === "active" && "Active investments"}
              {tab === "going" && `Maturing within ${win.label}`}
              {tab === "matured" && `Matured within last ${win.label}`}
              {tab === "all" && "All investments"}
              <span className="text-sm text-muted-foreground ml-2">({filtered.length})</span>
            </CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Member</TableHead>
                    <TableHead>Institution / ID</TableHead><TableHead className="text-right">Amount</TableHead>
                    <TableHead>Maturity</TableHead>
                    {tab === "going" && <TableHead>Days left</TableHead>}
                    <TableHead>Status</TableHead><TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {filtered.map((i) => {
                      const matDate = i.maturity_date ? new Date(i.maturity_date) : null;
                      const daysLeft = matDate ? daysBetween(matDate, now) : null;
                      const urgency = daysLeft == null ? "" : daysLeft <= 7 ? "bg-destructive text-destructive-foreground" : daysLeft <= 30 ? "bg-amber-500 text-white" : "bg-muted";
                      const idHint = i.fd_number ?? i.folio_number ?? i.isin ?? i.symbol ?? "";
                      return (
                        <TableRow key={i.id}>
                          <TableCell>{fmtDate(i.date)}</TableCell>
                          <TableCell><Badge variant="secondary">{i.investment_type}</Badge></TableCell>
                          <TableCell>{memberName(i.member_id)}</TableCell>
                          <TableCell>
                            <div>{i.institution ?? "—"}</div>
                            {idHint && <div className="text-[11px] text-muted-foreground font-mono">{idHint}</div>}
                          </TableCell>
                          <TableCell className="text-right font-mono">{inr(i.amount)}</TableCell>
                          <TableCell className="text-xs">
                            {i.maturity_date ? fmtDate(i.maturity_date) : "—"}
                            {i.expected_maturity_amount ? <div className="text-muted-foreground">{inr(i.expected_maturity_amount)}</div> : null}
                          </TableCell>
                          {tab === "going" && (
                            <TableCell>
                              {daysLeft != null && (
                                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", urgency)}>{daysLeft}d</span>
                              )}
                            </TableCell>
                          )}
                          <TableCell><Badge variant={i.status === "Active" ? "default" : "secondary"}>{i.status}</Badge></TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {i.status === "Active" && <MarkMaturedButton inv={i} accounts={accts.data ?? []} />}
                              <AddOrEditInvestmentButton editing={i} />
                              <ConfirmDeleteRow table="investments" id={i.id} amount={Number(i.amount)} label="investment" onDeleted={() => qc.invalidateQueries({ queryKey: ["investments"] })} />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!filtered.length && (
                      <TableRow>
                        <TableCell colSpan={tab === "going" ? 9 : 8} className="text-center text-muted-foreground py-8">
                          No investments here.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

type InvRow = {
  id: string; date: string; member_id: string | null; investment_type: string;
  institution: string | null; amount: number; source_of_funds: string;
  linked_maturity_id: string | null; fresh_topup_amount: number | null;
  bank_account_id: string | null; maturity_date: string | null;
  expected_maturity_amount: number | null; status: string; notes: string | null;
  matured_date: string | null;
  fd_number: string | null; branch_name: string | null; compounding_type: string | null;
  fd_type: string | null; auto_renewal: string | null; nomination_details: string | null;
  tenure_months: number | null;
  isin: string | null; folio_number: string | null; fund_type: string | null;
  units: number | null; nav_at_purchase: number | null;
  symbol: string | null; exchange: string | null;
  weight_grams: number | null; purity: string | null;
};

const INV_LABELS: Record<string, string> = {
  date: "Date", investment_type: "Type", institution: "Institution",
  amount: "Amount", maturity_date: "Maturity date", expected_maturity_amount: "Expected maturity",
  fd_number: "FD number", branch_name: "Branch", compounding_type: "Compounding",
  fd_type: "FD type", auto_renewal: "Auto renewal", tenure_months: "Tenure (months)",
  folio_number: "Folio", isin: "ISIN", fund_type: "Fund type",
  units: "Units", nav_at_purchase: "NAV / Price", symbol: "Symbol", exchange: "Exchange",
  weight_grams: "Weight (g)", purity: "Purity", notes: "Notes",
};

function AddOrEditInvestmentButton({ editing, trigger }: { editing?: InvRow; trigger?: ReactNode }) {
  const members = useMembers();
  const accts = useBankAccounts();
  const invs = useInvestments();
  const qc = useQueryClient();
  const isEdit = !!editing;
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [date, setDate] = useState(editing?.date ?? today());
  const [memberId, setMemberId] = useState(editing?.member_id ?? "");
  const [type, setType] = useState<string>(editing?.investment_type ?? "FD");
  const [institution, setInstitution] = useState(editing?.institution ?? "");
  const [amount, setAmount] = useState(String(editing?.amount ?? ""));
  const [source, setSource] = useState<string>(editing?.source_of_funds ?? "Fresh Income");
  const [linkedMat, setLinkedMat] = useState(editing?.linked_maturity_id ?? "");
  const [freshTop, setFreshTop] = useState(String(editing?.fresh_topup_amount ?? "0"));
  const [bankId, setBankId] = useState(editing?.bank_account_id ?? "");
  const [maturityDate, setMaturityDate] = useState(editing?.maturity_date ?? "");
  const [expected, setExpected] = useState(String(editing?.expected_maturity_amount ?? ""));
  const [notes, setNotes] = useState(editing?.notes ?? "");

  // FD/RD specific
  const [fdNumber, setFdNumber] = useState(editing?.fd_number ?? "");
  const [branchName, setBranchName] = useState(editing?.branch_name ?? "");
  const [compounding, setCompounding] = useState<string>(editing?.compounding_type ?? "Quarterly");
  const [fdType, setFdType] = useState<string>(editing?.fd_type ?? "Cumulative");
  const [autoRenewal, setAutoRenewal] = useState<string>(editing?.auto_renewal ?? "No");
  const [nominationDetails, setNominationDetails] = useState(editing?.nomination_details ?? "");
  const [tenureMonths, setTenureMonths] = useState<string>(String(editing?.tenure_months ?? ""));
  const [tenureTouched, setTenureTouched] = useState(false);

  // MF
  const [folioNumber, setFolioNumber] = useState(editing?.folio_number ?? "");
  const [isin, setIsin] = useState(editing?.isin ?? "");
  const [fundType, setFundType] = useState<string>(editing?.fund_type ?? "Equity");
  const [nav, setNav] = useState(String(editing?.nav_at_purchase ?? ""));
  const [units, setUnits] = useState(String(editing?.units ?? ""));

  // Stock
  const [symbol, setSymbol] = useState(editing?.symbol ?? "");
  const [exchange, setExchange] = useState<string>(editing?.exchange ?? "NSE");

  // Gold
  const [weight, setWeight] = useState(String(editing?.weight_grams ?? ""));
  const [purity, setPurity] = useState<string>(editing?.purity ?? "24K");

  // Auto-calc tenure from dates
  useEffect(() => {
    if (tenureTouched) return;
    if (date && maturityDate) {
      const d1 = new Date(date), d2 = new Date(maturityDate);
      const months = Math.max(0, Math.round((d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth())));
      setTenureMonths(String(months));
    }
  }, [date, maturityDate, tenureTouched]);

  const isFdLike = type === "FD" || type === "RD";
  const isMF = type === "Mutual Fund";
  const isStock = type === "Stock";
  const isGold = type === "Gold";

  function payload(): Partial<InvRow> {
    const base: Partial<InvRow> = {
      date, member_id: memberId || null, investment_type: type, institution: institution || null,
      amount: Number(amount) || 0, source_of_funds: source,
      linked_maturity_id: source !== "Fresh Income" && linkedMat ? linkedMat : null,
      fresh_topup_amount: source === "Partial Reinvestment" ? Number(freshTop) || 0 : 0,
      bank_account_id: bankId || null, maturity_date: maturityDate || null,
      expected_maturity_amount: expected ? Number(expected) : null,
      status: editing?.status ?? "Active", notes: notes || null,
      // Reset all instrument-specific fields, then set relevant ones
      fd_number: null, branch_name: null, compounding_type: null, fd_type: null,
      auto_renewal: null, nomination_details: null, tenure_months: null,
      folio_number: null, isin: null, fund_type: null, units: null, nav_at_purchase: null,
      symbol: null, exchange: null, weight_grams: null, purity: null,
    };
    if (isFdLike) {
      Object.assign(base, {
        fd_number: fdNumber || null, branch_name: branchName || null,
        compounding_type: compounding, fd_type: fdType, auto_renewal: autoRenewal,
        nomination_details: nominationDetails || null,
        tenure_months: tenureMonths ? Number(tenureMonths) : null,
      });
    }
    if (isMF) {
      Object.assign(base, {
        folio_number: folioNumber || null, isin: isin || null, fund_type: fundType,
        units: units ? Number(units) : null, nav_at_purchase: nav ? Number(nav) : null,
      });
    }
    if (isStock) {
      Object.assign(base, {
        symbol: symbol || null, exchange, isin: isin || null,
        units: units ? Number(units) : null, nav_at_purchase: nav ? Number(nav) : null,
      });
    }
    if (isGold) {
      Object.assign(base, {
        weight_grams: weight ? Number(weight) : null, purity,
        nav_at_purchase: nav ? Number(nav) : null,
      });
    }
    return base;
  }

  async function doInsert() {
    if (!amount) { toast.error("Amount required"); return; }
    if (isFdLike && !fdNumber) { toast.error("FD Number is required for FDs"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("investments") as any).insert({ user_id: user.id, ...payload() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["investments"] });
    toast.success("Investment added");
    setOpen(false);
  }

  async function doUpdate() {
    setBusy(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("investments") as any).update(payload()).eq("id", editing!.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["investments"] });
    toast.success("Updated");
    setConfirmOpen(false); setOpen(false);
  }

  function onSave() { if (!isEdit) return doInsert(); setConfirmOpen(true); }

  const changes = isEdit
    ? diffFields(editing as unknown as Record<string, unknown>, payload() as unknown as Record<string, unknown>, INV_LABELS)
    : [];

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger ?? (
            isEdit ? (
              <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
            ) : (
              <Button><Plus className="h-4 w-4 mr-1" />Add investment</Button>
            )
          )}
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Investment" : "Add investment"}</DialogTitle>
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

            {/* FD / RD specific */}
            {isFdLike && (
              <>
                <div className="col-span-2 mt-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">FD details</div>
                <Field label="FD Number *"><Input value={fdNumber} onChange={(e) => setFdNumber(e.target.value)} placeholder="Unique searchable ID" /></Field>
                <Field label="Branch Name"><Input value={branchName} onChange={(e) => setBranchName(e.target.value)} /></Field>
                <Field label="Compounding Type">
                  <Select value={compounding} onValueChange={setCompounding}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{COMPOUND.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="FD Type">
                  <Select value={fdType} onValueChange={setFdType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FD_TYPES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Auto Renewal">
                  <Select value={autoRenewal} onValueChange={setAutoRenewal}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{RENEWAL.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Tenure (months) — auto from dates">
                  <Input type="number" value={tenureMonths} onChange={(e) => { setTenureMonths(e.target.value); setTenureTouched(true); }} />
                </Field>
                <Field label="Nomination Details" full><Input value={nominationDetails} onChange={(e) => setNominationDetails(e.target.value)} /></Field>
              </>
            )}

            {/* Mutual Fund */}
            {isMF && (
              <>
                <div className="col-span-2 mt-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">MF details</div>
                <Field label="Folio Number"><Input value={folioNumber} onChange={(e) => setFolioNumber(e.target.value)} /></Field>
                <Field label="ISIN"><Input value={isin} onChange={(e) => setIsin(e.target.value)} /></Field>
                <Field label="Fund Type">
                  <Select value={fundType} onValueChange={setFundType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FUND_TYPES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="NAV at Purchase"><Input type="number" step="0.0001" value={nav} onChange={(e) => setNav(e.target.value)} /></Field>
                <Field label="Units"><Input type="number" step="0.0001" value={units} onChange={(e) => setUnits(e.target.value)} /></Field>
              </>
            )}

            {/* Stock */}
            {isStock && (
              <>
                <div className="col-span-2 mt-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stock details</div>
                <Field label="Symbol"><Input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="e.g. RELIANCE" /></Field>
                <Field label="Exchange">
                  <Select value={exchange} onValueChange={setExchange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{EXCHANGES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="ISIN"><Input value={isin} onChange={(e) => setIsin(e.target.value)} /></Field>
                <Field label="Quantity"><Input type="number" value={units} onChange={(e) => setUnits(e.target.value)} /></Field>
                <Field label="Price per share (₹)" full><Input type="number" step="0.01" value={nav} onChange={(e) => setNav(e.target.value)} /></Field>
              </>
            )}

            {/* Gold */}
            {isGold && (
              <>
                <div className="col-span-2 mt-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Gold details</div>
                <Field label="Weight (grams)"><Input type="number" step="0.001" value={weight} onChange={(e) => setWeight(e.target.value)} /></Field>
                <Field label="Purity">
                  <Select value={purity} onValueChange={setPurity}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PURITY.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Price per gram (₹)" full><Input type="number" step="0.01" value={nav} onChange={(e) => setNav(e.target.value)} /></Field>
              </>
            )}

            <Field label="Notes" full><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={onSave} disabled={busy}>{busy ? "Saving…" : (isEdit ? "Review changes" : "Confirm & save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {isEdit && (
        <ConfirmChangesDialog open={confirmOpen} onOpenChange={setConfirmOpen} changes={changes} onConfirm={doUpdate} busy={busy} />
      )}
    </>
  );
}

function MarkMaturedButton({ inv, accounts }: { inv: InvRow; accounts: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [actual, setActual] = useState("");
  const [tds, setTds] = useState("0");
  const [bank, setBank] = useState(accounts[0]?.id ?? "");

  async function go() {
    if (!actual || !bank) { toast.error("Amount and account required"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const net = Math.max(0, Number(actual) - (Number(tds) || 0));
    const { error: e1 } = await supabase.from("incomes").insert({
      user_id: user.id, date: today(), member_id: inv.member_id,
      income_type: inv.investment_type === "FD" ? "FD Maturity" : "Investment Maturity",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      amount: Number(actual), gross_amount: Number(actual), tds: Number(tds) || 0, net_amount: net,
      bank_account_id: bank, linked_investment_id: inv.id,
      tds_section: "194A", tds_section_confirmed: false,
      notes: `Maturity of ${inv.investment_type} ${inv.institution ?? ""}`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    if (e1) { toast.error(e1.message); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("investments") as any).update({ status: "Matured", matured_date: today() }).eq("id", inv.id);
    qc.invalidateQueries({ queryKey: ["investments"] });
    qc.invalidateQueries({ queryKey: ["incomes"] });
    toast.success("Marked matured");
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
              <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter><Button onClick={go}>Confirm</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
