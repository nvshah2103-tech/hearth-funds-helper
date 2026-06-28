import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useMembers, useBankAccounts, useIncomes, useInvestments,
  useTransfers, useCCBills, useBusinessIncomes, useEmiPayments,
} from "@/lib/data-hooks";
import { inr, fmtDate, fyFor } from "@/lib/format";
import { downloadCSV } from "@/lib/csv";
import { Download, Filter, Search, ChevronDown, Upload } from "lucide-react";
import { ImportPdfDialog } from "@/components/ImportPdfDialog";

export const Route = createFileRoute("/_authenticated/passbook")({ component: PassbookPage });

type Direction = "credit" | "debit" | "transfer";
type Source = "M";
type Category =
  | "Salary" | "FD Maturity" | "Investment" | "CC Payment" | "EMI"
  | "Internal Transfer" | "Broker Payout" | "Dividend" | "Business Income"
  | "UPI" | "ATM" | "Other";

type Row = {
  id: string;
  date: string;
  description: string;
  counterparty?: string;
  bankAccountId: string | null;
  bankAccountName: string;
  memberId: string | null;
  memberName: string;
  category: Category;
  direction: Direction;
  amount: number; // signed: +credit, -debit, 0 for transfer line
  // For internal transfers we still need a counterpart account id
  transferToId?: string;
  transferToName?: string;
  source: Source;
};

const ALL_CATEGORIES: Category[] = [
  "Salary", "FD Maturity", "Investment", "CC Payment", "EMI",
  "Internal Transfer", "Broker Payout", "Dividend", "Business Income",
  "UPI", "ATM", "Other",
];

const CAT_COLOR: Record<Category, string> = {
  "Salary": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  "FD Maturity": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  "Dividend": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  "Business Income": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  "Investment": "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  "CC Payment": "bg-red-500/10 text-red-700 dark:text-red-400",
  "EMI": "bg-red-500/10 text-red-700 dark:text-red-400",
  "Internal Transfer": "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  "Broker Payout": "bg-slate-500/10 text-slate-700 dark:text-slate-400",
  "UPI": "bg-slate-500/10 text-slate-700 dark:text-slate-400",
  "ATM": "bg-slate-500/10 text-slate-700 dark:text-slate-400",
  "Other": "bg-slate-500/10 text-slate-700 dark:text-slate-400",
};

type RangeKey = "today" | "week" | "month" | "lastMonth" | "thisFY" | "lastFY" | "all" | "custom";

function PassbookPage() {
  const members = useMembers();
  const accts = useBankAccounts();
  const inc = useIncomes(); const inv = useInvestments(); const tr = useTransfers();
  const cc = useCCBills(); const bi = useBusinessIncomes(); const ep = useEmiPayments();

  // ---- Build all rows ----
  const rows = useMemo<Row[]>(() => {
    const memberName = (id: string | null) => members.data?.find((m) => m.id === id)?.name ?? "—";
    const acctName = (id: string | null) => accts.data?.find((a) => a.id === id)?.name ?? "—";
    const out: Row[] = [];

    for (const x of inc.data ?? []) {
      const cat: Category = x.income_type?.toLowerCase().includes("salary") ? "Salary"
        : x.income_type?.toLowerCase().includes("fd") || x.income_type?.toLowerCase().includes("maturity") ? "FD Maturity"
        : x.income_type?.toLowerCase().includes("dividend") ? "Dividend"
        : "Other";
      out.push({
        id: `inc-${x.id}`, date: x.date,
        description: `Income · ${x.income_type}${x.notes ? " · " + x.notes : ""}`,
        bankAccountId: x.bank_account_id, bankAccountName: acctName(x.bank_account_id),
        memberId: x.member_id, memberName: memberName(x.member_id),
        category: cat, direction: "credit", amount: Number(x.net_amount), source: "M",
      });
    }
    for (const x of bi.data ?? []) {
      out.push({
        id: `bi-${x.id}`, date: x.date,
        description: `Business · ${x.client_name}`,
        counterparty: x.client_name,
        bankAccountId: x.bank_account_id, bankAccountName: acctName(x.bank_account_id),
        memberId: x.member_id, memberName: memberName(x.member_id),
        category: "Business Income", direction: "credit", amount: Number(x.net_received), source: "M",
      });
    }
    for (const x of inv.data ?? []) {
      out.push({
        id: `inv-${x.id}`, date: x.date,
        description: `Investment · ${x.investment_type}${x.institution ? " · " + x.institution : ""}`,
        counterparty: x.institution ?? undefined,
        bankAccountId: x.bank_account_id, bankAccountName: acctName(x.bank_account_id),
        memberId: x.member_id, memberName: memberName(x.member_id),
        category: "Investment", direction: "debit", amount: -Number(x.amount), source: "M",
      });
    }
    for (const x of tr.data ?? []) {
      out.push({
        id: `tr-${x.id}`, date: x.date,
        description: `${acctName(x.from_account_id)} → ${acctName(x.to_account_id)}${x.reason ? " · " + x.reason : ""}`,
        bankAccountId: x.from_account_id, bankAccountName: acctName(x.from_account_id),
        transferToId: x.to_account_id, transferToName: acctName(x.to_account_id),
        memberId: null, memberName: "—",
        category: "Internal Transfer", direction: "transfer", amount: Number(x.amount), source: "M",
      });
    }
    for (const x of cc.data ?? []) {
      if (x.bank_account_id && x.payment_amount) {
        out.push({
          id: `cc-${x.id}`, date: x.payment_date ?? x.billing_month,
          description: `Credit card payment`,
          bankAccountId: x.bank_account_id, bankAccountName: acctName(x.bank_account_id),
          memberId: null, memberName: "—",
          category: "CC Payment", direction: "debit", amount: -Number(x.payment_amount), source: "M",
        });
      }
    }
    for (const x of ep.data ?? []) {
      out.push({
        id: `emi-${x.id}`, date: x.paid_date,
        description: `EMI payment`,
        bankAccountId: x.bank_account_id, bankAccountName: acctName(x.bank_account_id),
        memberId: null, memberName: "—",
        category: "EMI", direction: "debit", amount: -Number(x.amount), source: "M",
      });
    }
    out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return out;
  }, [members.data, accts.data, inc.data, inv.data, tr.data, cc.data, bi.data, ep.data]);

  // ---- Filter state ----
  const [selAccts, setSelAccts] = useState<Set<string>>(new Set());
  const [selMembers, setSelMembers] = useState<Set<string>>(new Set());
  const [selCats, setSelCats] = useState<Set<Category>>(new Set());
  const [rangeKey, setRangeKey] = useState<RangeKey>("thisFY");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [dir, setDir] = useState<"all" | "credit" | "debit">("all");
  const [search, setSearch] = useState("");
  const [amtMin, setAmtMin] = useState<string>("");
  const [amtMax, setAmtMax] = useState<string>("");
  const [hideTransfers, setHideTransfers] = useState(true);
  const [hideBroker, setHideBroker] = useState(true);
  const [minThreshold, setMinThreshold] = useState<string>("");

  const range = useMemo(() => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    if (rangeKey === "today") return { from: iso(t), to: iso(t) };
    if (rangeKey === "week") { const f = new Date(t); f.setDate(t.getDate() - 6); return { from: iso(f), to: iso(t) }; }
    if (rangeKey === "month") { const f = new Date(t.getFullYear(), t.getMonth(), 1); return { from: iso(f), to: iso(t) }; }
    if (rangeKey === "lastMonth") {
      const f = new Date(t.getFullYear(), t.getMonth() - 1, 1);
      const to = new Date(t.getFullYear(), t.getMonth(), 0);
      return { from: iso(f), to: iso(to) };
    }
    if (rangeKey === "thisFY") { const fy = fyFor(); return { from: fy.start, to: fy.end }; }
    if (rangeKey === "lastFY") {
      const fy = fyFor(); const sy = fy.startYear - 1;
      return { from: `${sy}-04-01`, to: `${sy + 1}-03-31` };
    }
    if (rangeKey === "custom") return { from: customFrom || "0000-01-01", to: customTo || "9999-12-31" };
    return { from: "0000-01-01", to: "9999-12-31" };
  }, [rangeKey, customFrom, customTo]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = amtMin ? Number(amtMin) : null;
    const max = amtMax ? Number(amtMax) : null;
    const thr = minThreshold ? Number(minThreshold) : null;
    return rows.filter((r) => {
      if (r.date < range.from || r.date > range.to) return false;
      if (selAccts.size && !(r.bankAccountId && selAccts.has(r.bankAccountId))
          && !(r.transferToId && selAccts.has(r.transferToId))) return false;
      if (selMembers.size && !(r.memberId && selMembers.has(r.memberId))) return false;
      if (selCats.size && !selCats.has(r.category)) return false;
      if (hideTransfers && r.category === "Internal Transfer") return false;
      if (hideBroker && r.category === "Broker Payout") return false;
      const abs = Math.abs(r.amount);
      if (thr != null && abs < thr) return false;
      if (min != null && abs < min) return false;
      if (max != null && abs > max) return false;
      if (dir === "credit" && r.direction !== "credit") return false;
      if (dir === "debit" && r.direction !== "debit") return false;
      if (q) {
        const hay = (r.description + " " + (r.counterparty ?? "") + " " + r.bankAccountName + " " + r.memberName).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, range, selAccts, selMembers, selCats, hideTransfers, hideBroker, minThreshold, amtMin, amtMax, dir, search]);

  // ---- Aggregate running balance across ALL accounts, computed on the full timeline,
  //      then projected onto the filtered rows so the column always reflects truth. ----
  const aggregateById = useMemo(() => {
    const openingTotal = (accts.data ?? []).reduce((s, a) => s + Number(a.opening_balance), 0);
    let running = openingTotal;
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.category === "Internal Transfer") {
        // net zero across accounts → aggregate unchanged
      } else {
        running += r.amount; // amount is signed
      }
      map.set(r.id, running);
    }
    return map;
  }, [rows, accts.data]);

  // Per-account running balance for filtered view (computed per-row from full history up to that point)
  const perAcctById = useMemo(() => {
    const opening = new Map<string, number>();
    for (const a of accts.data ?? []) opening.set(a.id, Number(a.opening_balance));
    const running = new Map<string, number>(opening);
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.category === "Internal Transfer" && r.transferToId && r.bankAccountId) {
        running.set(r.bankAccountId, (running.get(r.bankAccountId) ?? 0) - r.amount);
        running.set(r.transferToId, (running.get(r.transferToId) ?? 0) + r.amount);
        map.set(r.id, running.get(r.bankAccountId) ?? 0);
      } else if (r.bankAccountId) {
        running.set(r.bankAccountId, (running.get(r.bankAccountId) ?? 0) + r.amount);
        map.set(r.id, running.get(r.bankAccountId) ?? 0);
      }
    }
    return map;
  }, [rows, accts.data]);

  // ---- Summary ----
  const summary = useMemo(() => {
    let credits = 0, debits = 0;
    for (const r of filtered) {
      if (r.direction === "credit") credits += r.amount;
      else if (r.direction === "debit") debits += Math.abs(r.amount);
    }
    return { credits, debits, net: credits - debits, count: filtered.length };
  }, [filtered]);

  const aggregateNow = useMemo(() => {
    // current aggregate across all bank accounts, regardless of filter
    if (!rows.length) return (accts.data ?? []).reduce((s, a) => s + Number(a.opening_balance), 0);
    return aggregateById.get(rows[rows.length - 1].id) ?? 0;
  }, [rows, aggregateById, accts.data]);

  function toggleSet<T>(set: Set<T>, value: T, setter: (s: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    setter(next);
  }

  function exportCSV() {
    const rowsCSV = filtered.map((r) => ({
      Date: r.date,
      Description: r.description,
      Counterparty: r.counterparty ?? "",
      Bank: r.bankAccountName,
      Member: r.memberName,
      Category: r.category,
      Credit: r.direction === "credit" ? r.amount : "",
      Debit: r.direction === "debit" ? Math.abs(r.amount) : "",
      Transfer: r.category === "Internal Transfer" ? r.amount : "",
      "Account Balance": perAcctById.get(r.id) ?? "",
      "Aggregate Balance": aggregateById.get(r.id) ?? "",
      Source: r.source,
    }));
    downloadCSV(`passbook-${range.from}-to-${range.to}.csv`, rowsCSV);
  }

  function clearFilters() {
    setSelAccts(new Set()); setSelMembers(new Set()); setSelCats(new Set());
    setRangeKey("thisFY"); setCustomFrom(""); setCustomTo("");
    setDir("all"); setSearch(""); setAmtMin(""); setAmtMax("");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Passbook</h1>
          <p className="text-sm text-muted-foreground">Every transaction across every account in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1" />Import PDF
          </Button>
          <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
          <Button size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />Export CSV</Button>
        </div>
      </div>
      <ImportPdfDialog open={importOpen} onOpenChange={setImportOpen} />

      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Aggregate balance (all accounts)</p>
          <p className="text-xl font-mono font-semibold text-primary">{inr(aggregateNow)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Credits (filter)</p>
          <p className="text-xl font-mono text-[hsl(142,76%,36%)]">{inr(summary.credits)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Debits (filter)</p>
          <p className="text-xl font-mono text-destructive">{inr(summary.debits)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Net (filter)</p>
          <p className={`text-xl font-mono ${summary.net >= 0 ? "text-[hsl(142,76%,36%)]" : "text-destructive"}`}>{inr(summary.net)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Transactions</p>
          <p className="text-xl font-mono">{summary.count}</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Filter className="h-4 w-4" />Filters</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-3">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Description, member, bank…" className="pl-8" />
              </div>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Date range</Label>
              <Select value={rangeKey} onValueChange={(v) => setRangeKey(v as RangeKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="lastMonth">Last Month</SelectItem>
                  <SelectItem value="thisFY">This FY</SelectItem>
                  <SelectItem value="lastFY">Last FY</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="custom">Custom…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {rangeKey === "custom" && (
              <>
                <div className="md:col-span-2"><Label className="text-xs">From</Label>
                  <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} /></div>
                <div className="md:col-span-2"><Label className="text-xs">To</Label>
                  <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} /></div>
              </>
            )}
            <div className="md:col-span-2">
              <Label className="text-xs">Direction</Label>
              <Select value={dir} onValueChange={(v) => setDir(v as "all" | "credit" | "debit")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="credit">Credits only</SelectItem>
                  <SelectItem value="debit">Debits only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3 grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Min ₹</Label><Input type="number" inputMode="numeric" value={amtMin} onChange={(e) => setAmtMin(e.target.value)} /></div>
              <div><Label className="text-xs">Max ₹</Label><Input type="number" inputMode="numeric" value={amtMax} onChange={(e) => setAmtMax(e.target.value)} /></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MultiPicker
              label="Bank accounts"
              options={(accts.data ?? []).map((a) => ({ id: a.id, label: `${a.name}${a.bank_name ? " · " + a.bank_name : ""}` }))}
              selected={selAccts} onChange={setSelAccts}
            />
            <MultiPicker
              label="Members"
              options={(members.data ?? []).map((m) => ({ id: m.id, label: m.name }))}
              selected={selMembers} onChange={setSelMembers}
            />
            <MultiPicker
              label="Categories"
              options={ALL_CATEGORIES.map((c) => ({ id: c, label: c }))}
              selected={selCats as Set<string>}
              onChange={(s) => setSelCats(s as Set<Category>)}
            />
          </div>

          <div className="flex flex-wrap gap-6 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={hideTransfers} onCheckedChange={setHideTransfers} />
              Hide internal transfers
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={hideBroker} onCheckedChange={setHideBroker} />
              Hide broker payouts already counted
            </label>
            <label className="flex items-center gap-2 text-sm">
              Hide transactions below ₹
              <Input value={minThreshold} onChange={(e) => setMinThreshold(e.target.value)} type="number" inputMode="numeric" className="h-8 w-24" placeholder="0" />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Transaction list */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Account Bal.</TableHead>
                  <TableHead className="text-right">Aggregate Bal.</TableHead>
                  <TableHead className="text-center w-[60px]">Src</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const isTransfer = r.category === "Internal Transfer";
                  const isBroker = r.category === "Broker Payout";
                  const muted = isTransfer || isBroker;
                  return (
                    <TableRow key={r.id} className={muted ? "opacity-70" : ""}>
                      <TableCell className="font-mono text-xs">{fmtDate(r.date)}</TableCell>
                      <TableCell className="max-w-[320px]">
                        <div className="truncate" title={r.description}>{r.description}</div>
                        {r.counterparty && <div className="text-xs text-muted-foreground truncate">{r.counterparty}</div>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {isTransfer ? `${r.bankAccountName} → ${r.transferToName}` : r.bankAccountName}
                      </TableCell>
                      <TableCell className="text-xs">{r.memberName}</TableCell>
                      <TableCell><Badge variant="secondary" className={CAT_COLOR[r.category]}>{r.category}</Badge></TableCell>
                      <TableCell className="text-right font-mono text-[hsl(142,76%,36%)]">
                        {r.direction === "credit" ? inr(r.amount) : ""}
                      </TableCell>
                      <TableCell className="text-right font-mono text-destructive">
                        {r.direction === "debit" ? inr(Math.abs(r.amount)) : ""}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{inr(perAcctById.get(r.id) ?? 0)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{inr(aggregateById.get(r.id) ?? 0)}</TableCell>
                      <TableCell className="text-center"><span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted">{r.source}</span></TableCell>
                    </TableRow>
                  );
                })}
                {!filtered.length && (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-10">
                    No transactions match the current filters.
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MultiPicker({
  label, options, selected, onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
}) {
  const allIds = options.map((o) => o.id);
  const allSelected = selected.size === 0 || selected.size === allIds.length;
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between font-normal">
            <span className="truncate">
              {selected.size === 0 ? `All ${label.toLowerCase()}` : `${selected.size} selected`}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <div className="flex justify-between pb-2 border-b mb-2">
            <Button variant="ghost" size="sm" onClick={() => onChange(new Set(allIds))}>Select all</Button>
            <Button variant="ghost" size="sm" onClick={() => onChange(new Set())}>Clear</Button>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {options.map((o) => {
              const checked = allSelected || selected.has(o.id);
              return (
                <label key={o.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent cursor-pointer text-sm">
                  <Checkbox
                    checked={selected.has(o.id)}
                    onCheckedChange={() => {
                      const next = new Set(selected);
                      if (next.has(o.id)) next.delete(o.id); else next.add(o.id);
                      onChange(next);
                    }}
                  />
                  <span className="truncate">{o.label}</span>
                  {!selected.size && <span className="text-xs text-muted-foreground ml-auto">incl.</span>}
                  {selected.size > 0 && !checked && <span className="text-xs text-muted-foreground ml-auto">excl.</span>}
                </label>
              );
            })}
            {!options.length && <div className="text-sm text-muted-foreground p-2">No options.</div>}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
