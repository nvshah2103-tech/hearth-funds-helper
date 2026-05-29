import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useBankAccounts, useIncomes, useInvestments, useTransfers, useCCBills,
  useBusinessIncomes, useEmiPayments, useEmis, useMembers, useCreditCards,
  computeBalances,
} from "@/lib/data-hooks";
import { useAuth } from "@/lib/auth-context";
import { inr, fmtDate, fyFor, fyList, monthLabel } from "@/lib/format";
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank, Receipt, Calendar,
  Landmark, CreditCard, FileText, RefreshCw, ChevronRight, AlertCircle, CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

const CHART_COLORS = [
  "hsl(155 60% 45%)", "hsl(250 60% 55%)", "hsl(200 70% 50%)",
  "hsl(45 90% 55%)", "hsl(280 55% 55%)", "hsl(15 75% 55%)",
  "hsl(180 50% 45%)", "hsl(330 60% 55%)",
];

function greet() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function ymKey(d: string | Date) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const accts = useBankAccounts();
  const members = useMembers();
  const incomes = useIncomes();
  const invs = useInvestments();
  const trs = useTransfers();
  const ccb = useCCBills();
  const bi = useBusinessIncomes();
  const ep = useEmiPayments();
  const emis = useEmis();
  const cards = useCreditCards();

  const fys = useMemo(() => fyList(5), []);
  const [fyStartYear, setFyStartYear] = useState(fyFor().startYear);
  const fy = useMemo(() => {
    const sy = fyStartYear;
    return { start: `${sy}-04-01`, end: `${sy + 1}-03-31`, label: `FY ${sy}-${String(sy + 1).slice(2)}`, startYear: sy };
  }, [fyStartYear]);

  const loading = accts.isLoading || incomes.isLoading || invs.isLoading || trs.isLoading
    || ccb.isLoading || bi.isLoading || ep.isLoading || emis.isLoading || members.isLoading;

  const balances = useMemo(() => computeBalances(
    accts.data ?? [], incomes.data ?? [], invs.data ?? [], trs.data ?? [],
    ccb.data ?? [], bi.data ?? [], ep.data ?? [],
  ), [accts.data, incomes.data, invs.data, trs.data, ccb.data, bi.data, ep.data]);

  // ── KPIs ──
  const totalBank = Object.values(balances).reduce((s, v) => s + v, 0);
  const activeInvs = (invs.data ?? []).filter((i) => i.status === "Active");
  const totalInvested = activeInvs.reduce((s, i) => s + Number(i.amount), 0);
  const netWorth = totalBank + totalInvested;

  // Net worth last month for trend
  const lastMonthEnd = useMemo(() => {
    const d = new Date(); d.setDate(0); return d.toISOString().slice(0, 10);
  }, []);
  const netWorthLastMonth = useMemo(() => netWorthAt(lastMonthEnd, accts.data ?? [], incomes.data ?? [], invs.data ?? [], trs.data ?? [], ccb.data ?? [], bi.data ?? [], ep.data ?? []),
    [lastMonthEnd, accts.data, incomes.data, invs.data, trs.data, ccb.data, bi.data, ep.data]);
  const trendDelta = netWorth - netWorthLastMonth;
  const trendPct = netWorthLastMonth !== 0 ? (trendDelta / Math.abs(netWorthLastMonth)) * 100 : 0;

  const mostRecentDate = useMemo(() => {
    const dates: string[] = [];
    (incomes.data ?? []).forEach((i) => dates.push(i.date));
    (invs.data ?? []).forEach((i) => dates.push(i.date));
    (trs.data ?? []).forEach((i) => dates.push(i.date));
    (bi.data ?? []).forEach((i) => dates.push(i.date));
    (ep.data ?? []).forEach((i) => dates.push(i.paid_date));
    return dates.sort().pop() ?? null;
  }, [incomes.data, invs.data, trs.data, bi.data, ep.data]);

  // This month cash flow
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthIn = sumInRange(incomes.data ?? [], "date", monthStart, "9999", "net_amount")
    + sumInRange(bi.data ?? [], "date", monthStart, "9999", "net_received");
  const monthDeployed = sumInRange(invs.data ?? [], "date", monthStart, "9999", "amount")
    + sumInRange(ccb.data ?? [], "payment_date", monthStart, "9999", "payment_amount")
    + sumInRange(ep.data ?? [], "paid_date", monthStart, "9999", "amount");
  const monthSurplus = monthIn - monthDeployed;

  // TDS this FY
  const fyIncomes = (incomes.data ?? []).filter((i) => i.date >= fy.start && i.date <= fy.end);
  const fyBI = (bi.data ?? []).filter((b) => b.date >= fy.start && b.date <= fy.end);
  const salaryTDS = fyIncomes.filter((i) => /salary/i.test(i.income_type)).reduce((s, i) => s + Number(i.tds), 0);
  const fdTDS = fyIncomes.filter((i) => /fd|interest|maturity|investment/i.test(i.income_type)).reduce((s, i) => s + Number(i.tds), 0);
  const businessTDS = fyBI.reduce((s, b) => s + Number(b.tds), 0);
  const otherTDS = fyIncomes.filter((i) => !/salary|fd|interest|maturity|investment/i.test(i.income_type)).reduce((s, i) => s + Number(i.tds), 0);
  const totalTDS = salaryTDS + fdTDS + businessTDS + otherTDS;

  // Active investments + next maturity
  const todayISO = now.toISOString().slice(0, 10);
  const in90 = new Date(now); in90.setDate(in90.getDate() + 90);
  const in90ISO = in90.toISOString().slice(0, 10);
  const upcomingMaturities = activeInvs
    .filter((i) => i.maturity_date && i.maturity_date >= todayISO && i.maturity_date <= in90ISO)
    .sort((a, b) => (a.maturity_date! < b.maturity_date! ? -1 : 1));
  const nextMaturity = upcomingMaturities[0];

  // ── Chart 1: Monthly cash flow (12mo rolling) ──
  const monthlyFlow = useMemo(() => {
    const map = new Map<string, { month: string; in: number; inv: number; cc: number; emi: number }>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = ymKey(d);
      map.set(k, { month: d.toLocaleString("en-IN", { month: "short" }), in: 0, inv: 0, cc: 0, emi: 0 });
    }
    (incomes.data ?? []).forEach((i) => { const e = map.get(ymKey(i.date)); if (e) e.in += Number(i.net_amount); });
    (bi.data ?? []).forEach((b) => { const e = map.get(ymKey(b.date)); if (e) e.in += Number(b.net_received); });
    (invs.data ?? []).forEach((i) => { const e = map.get(ymKey(i.date)); if (e) e.inv += Number(i.amount); });
    (ccb.data ?? []).forEach((c) => { if (!c.payment_date) return; const e = map.get(ymKey(c.payment_date)); if (e) e.cc += Number(c.payment_amount); });
    (ep.data ?? []).forEach((p) => { const e = map.get(ymKey(p.paid_date)); if (e) e.emi += Number(p.amount); });
    return Array.from(map.entries()).map(([k, v]) => ({
      key: k, month: v.month, In: v.in, Deployed: v.inv + v.cc + v.emi,
      Net: v.in - (v.inv + v.cc + v.emi), inv: v.inv, cc: v.cc, emi: v.emi,
    }));
  }, [incomes.data, bi.data, invs.data, ccb.data, ep.data, now]);

  // ── Chart 2: Net worth timeline ──
  const netWorthTimeline = useMemo(() => {
    if (!accts.data?.length) return [];
    const allDates: string[] = [];
    (incomes.data ?? []).forEach((i) => allDates.push(i.date));
    (invs.data ?? []).forEach((i) => allDates.push(i.date));
    (trs.data ?? []).forEach((i) => allDates.push(i.date));
    (bi.data ?? []).forEach((i) => allDates.push(i.date));
    (ep.data ?? []).forEach((i) => allDates.push(i.paid_date));
    if (allDates.length < 2) return [];
    allDates.sort();
    const firstDate = new Date(allDates[0]);
    const points: { month: string; net: number; bank: number; inv: number }[] = [];
    const cursor = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    while (cursor <= end) {
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).toISOString().slice(0, 10);
      const bank = netWorthAt(monthEnd, accts.data, incomes.data ?? [], invs.data ?? [], trs.data ?? [], ccb.data ?? [], bi.data ?? [], ep.data ?? [], "bank-only");
      const inv = (invs.data ?? []).filter((i) => i.date <= monthEnd && i.status === "Active").reduce((s, i) => s + Number(i.amount), 0);
      points.push({ month: cursor.toLocaleString("en-IN", { month: "short", year: "2-digit" }), bank, inv, net: bank + inv });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return points;
  }, [accts.data, incomes.data, invs.data, trs.data, ccb.data, bi.data, ep.data, now]);

  // ── Chart 3: Allocation donut ──
  const allocation = useMemo(() => {
    const map = new Map<string, number>();
    activeInvs.forEach((i) => map.set(i.investment_type, (map.get(i.investment_type) ?? 0) + Number(i.amount)));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [activeInvs]);

  // ── Chart 4: Income sources stacked (FY) ──
  const incomeSourcesFY = useMemo(() => {
    const months: string[] = [];
    const start = new Date(fy.start);
    const end = now > new Date(fy.end) ? new Date(fy.end) : now;
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      months.push(ymKey(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    const memberMap = new Map((members.data ?? []).map((m) => [m.id, m]));
    const rows = months.map((k) => {
      const [y, m] = k.split("-").map(Number);
      const label = new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "short" });
      const row: Record<string, number | string> = { month: label };
      (incomes.data ?? []).filter((i) => ymKey(i.date) === k).forEach((i) => {
        const mem = i.member_id ? memberMap.get(i.member_id)?.name ?? "Other" : "Other";
        let key = "Other";
        if (/salary/i.test(i.income_type)) key = `Salary ${mem}`;
        else if (/dividend|interest/i.test(i.income_type)) key = "Dividends & Interest";
        else if (/maturity|fd/i.test(i.income_type)) key = "FD & Maturities";
        else if (/capital/i.test(i.income_type)) key = "Capital Gains";
        else key = i.income_type;
        row[key] = ((row[key] as number) ?? 0) + Number(i.net_amount);
      });
      (bi.data ?? []).filter((b) => ymKey(b.date) === k).forEach((b) => {
        row["Business Income"] = ((row["Business Income"] as number) ?? 0) + Number(b.net_received);
      });
      return row;
    });
    const keys = new Set<string>();
    rows.forEach((r) => Object.keys(r).forEach((k) => { if (k !== "month") keys.add(k); }));
    return { rows, keys: Array.from(keys) };
  }, [incomes.data, bi.data, members.data, fy, now]);

  // ── Upcoming events (90 days) ──
  type Event = { id: string; type: string; icon: string; title: string; date: string; amount: number; action?: () => void; actionLabel?: string };
  const upcomingEvents = useMemo(() => {
    const events: Event[] = [];
    upcomingMaturities.forEach((m) => events.push({
      id: `mat-${m.id}`, type: "fd", icon: "🏦",
      title: `FD Maturing — ${m.institution ?? m.investment_type}`,
      date: m.maturity_date!, amount: Number(m.expected_maturity_amount ?? m.amount),
      actionLabel: "Plan Reinvestment",
      action: () => navigate({ to: "/investments" }),
    }));
    // Credit card next due — estimate as billing_month + 20 days for unpaid bills
    (ccb.data ?? []).filter((c) => !c.payment_date).forEach((c) => {
      const due = new Date(c.billing_month); due.setDate(due.getDate() + 20);
      const dueISO = due.toISOString().slice(0, 10);
      if (dueISO <= in90ISO) {
        const card = (cards.data ?? []).find((cc) => cc.id === c.card_id);
        events.push({
          id: `cc-${c.id}`, type: "cc", icon: "💳",
          title: `${card?.name ?? "Credit Card"} Bill Due`,
          date: dueISO, amount: Number(c.total_bill),
          actionLabel: "Mark as Paid",
          action: () => navigate({ to: "/credit-cards" }),
        });
      }
    });
    // EMIs — next due based on due_day in current/next month
    (emis.data ?? []).filter((e) => e.status === "Active").forEach((e) => {
      const candidates = [
        new Date(now.getFullYear(), now.getMonth(), e.due_day),
        new Date(now.getFullYear(), now.getMonth() + 1, e.due_day),
        new Date(now.getFullYear(), now.getMonth() + 2, e.due_day),
      ];
      candidates.forEach((d) => {
        const iso = d.toISOString().slice(0, 10);
        if (iso >= todayISO && iso <= in90ISO) {
          events.push({
            id: `emi-${e.id}-${iso}`, type: "emi", icon: "🏠",
            title: `${e.name} EMI`, date: iso, amount: Number(e.emi_amount),
            actionLabel: "Mark as Paid",
            action: () => navigate({ to: "/emis" }),
          });
        }
      });
    });
    // Advance tax
    const yr = now.getFullYear();
    const taxDates: { d: string; q: string }[] = [
      { d: `${yr}-06-15`, q: "Q1" }, { d: `${yr}-09-15`, q: "Q2" },
      { d: `${yr}-12-15`, q: "Q3" }, { d: `${yr + 1}-03-15`, q: "Q4" },
    ];
    taxDates.forEach((t) => {
      if (t.d >= todayISO && t.d <= in90ISO) {
        events.push({
          id: `tax-${t.d}`, type: "tax", icon: "📋",
          title: `Advance Tax ${t.q} Due`, date: t.d, amount: 0,
          actionLabel: "View",
          action: () => navigate({ to: "/reports" }),
        });
      }
    });
    return events.sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [upcomingMaturities, ccb.data, cards.data, emis.data, navigate, now, todayISO, in90ISO]);

  // Stale accounts
  const staleAccounts = useMemo(() => {
    const lastByAccount = new Map<string, string>();
    [
      ...(incomes.data ?? []).map((i) => ({ a: i.bank_account_id, d: i.date })),
      ...(invs.data ?? []).map((i) => ({ a: i.bank_account_id, d: i.date })),
      ...(trs.data ?? []).flatMap((t) => [{ a: t.from_account_id, d: t.date }, { a: t.to_account_id, d: t.date }]),
      ...(ep.data ?? []).map((p) => ({ a: p.bank_account_id, d: p.paid_date })),
    ].forEach(({ a, d }) => { if (a && (!lastByAccount.get(a) || lastByAccount.get(a)! < d)) lastByAccount.set(a, d); });
    const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 35);
    const cutoffISO = cutoff.toISOString().slice(0, 10);
    return (accts.data ?? []).filter((a) => (lastByAccount.get(a.id) ?? "0000") < cutoffISO)
      .map((a) => ({ ...a, lastDate: lastByAccount.get(a.id) ?? null }));
  }, [accts.data, incomes.data, invs.data, trs.data, ep.data, now]);

  // Per-member summaries
  const memberSummaries = useMemo(() => {
    return (members.data ?? []).map((m) => {
      const memIncomes = fyIncomes.filter((i) => i.member_id === m.id);
      const memBI = fyBI.filter((b) => b.member_id === m.id);
      const memInvs = (invs.data ?? []).filter((i) => i.member_id === m.id && i.date >= fy.start && i.date <= fy.end);
      const memAcctIds = new Set((accts.data ?? []).filter(() => true).map((a) => a.id)); // accounts aren't per-member in schema; use all
      void memAcctIds;
      const totalIncome = memIncomes.reduce((s, i) => s + Number(i.net_amount), 0)
        + memBI.reduce((s, b) => s + Number(b.net_received), 0);
      const tds = memIncomes.reduce((s, i) => s + Number(i.tds), 0) + memBI.reduce((s, b) => s + Number(b.tds), 0);
      const invested = memInvs.reduce((s, i) => s + Number(i.amount), 0);
      return { ...m, totalIncome, tds, invested };
    });
  }, [members.data, fyIncomes, fyBI, invs.data, accts.data, fy]);

  // Empty state check
  const totalTxCount = (incomes.data?.length ?? 0) + (invs.data?.length ?? 0) + (trs.data?.length ?? 0)
    + (bi.data?.length ?? 0) + (ep.data?.length ?? 0);
  const isEmpty = !loading && totalTxCount < 5;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-72" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{greet()}, Family</h1>
          <p className="text-sm text-muted-foreground">
            {user?.email} · {mostRecentDate ? `Latest activity ${fmtDate(mostRecentDate)}` : "No activity yet"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => {
            accts.refetch(); incomes.refetch(); invs.refetch(); trs.refetch();
            ccb.refetch(); bi.refetch(); ep.refetch(); emis.refetch();
          }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Select value={String(fyStartYear)} onValueChange={(v) => setFyStartYear(Number(v))}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {fys.map((f) => <SelectItem key={f.startYear} value={String(f.startYear)}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition cursor-pointer" onClick={() => navigate({ to: "/passbook" })}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Family Net Worth</p>
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <p className="text-3xl font-semibold mt-2">{inr(netWorth)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              As of {mostRecentDate ? fmtDate(mostRecentDate) : fmtDate(now)}
            </p>
            {netWorthLastMonth !== 0 && (
              <div className={`flex items-center gap-1 mt-2 text-sm ${trendDelta >= 0 ? "text-success" : "text-destructive"}`}>
                {trendDelta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span>{inr(Math.abs(trendDelta))} ({trendPct.toFixed(1)}%) vs last month</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition cursor-pointer" onClick={() => navigate({ to: "/passbook" })}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">This Month Cash Flow</p>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <p className={`text-3xl font-semibold mt-2 ${monthSurplus >= 0 ? "text-success" : "text-destructive"}`}>
              {inr(monthSurplus)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Net Surplus</p>
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
              <div><span className="text-muted-foreground">In:</span> <span className="font-medium">{inr(monthIn)}</span></div>
              <div><span className="text-muted-foreground">Out:</span> <span className="font-medium">{inr(monthDeployed)}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition cursor-pointer" onClick={() => navigate({ to: "/reports" })}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">TDS Deducted ({fy.label})</p>
              <Receipt className="h-4 w-4 text-primary" />
            </div>
            <p className="text-3xl font-semibold mt-2">{inr(totalTDS)}</p>
            <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
              <div>Salary {inr(salaryTDS)} · FD {inr(fdTDS)} · Business {inr(businessTDS)}</div>
            </div>
            <p className="text-xs text-primary mt-2 inline-flex items-center gap-1">View TDS register <ChevronRight className="h-3 w-3" /></p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition cursor-pointer" onClick={() => navigate({ to: "/investments" })}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Active Investments</p>
              <PiggyBank className="h-4 w-4 text-primary" />
            </div>
            <p className="text-3xl font-semibold mt-2">{activeInvs.length}</p>
            <p className="text-xs text-muted-foreground mt-1">{inr(totalInvested)} deployed</p>
            <p className="text-xs mt-2">
              {nextMaturity
                ? <>Next: <span className="font-medium">{nextMaturity.institution ?? nextMaturity.investment_type}</span> on {fmtDate(nextMaturity.maturity_date)} — {inr(Number(nextMaturity.expected_maturity_amount ?? nextMaturity.amount))}</>
                : <span className="text-muted-foreground">No maturities in next 90 days</span>}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Empty state */}
      {isEmpty ? (
        <Card>
          <CardHeader><CardTitle>Get started</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Complete these steps and your dashboard will come alive with charts and insights.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Account created</li>
              <li className="flex items-center gap-2"><div className="h-4 w-4 rounded border" /> <Link to="/bank-accounts" className="text-primary underline">Add your bank accounts</Link></li>
              <li className="flex items-center gap-2"><div className="h-4 w-4 rounded border" /> <Link to="/income" className="text-primary underline">Record your first income entry</Link></li>
              <li className="flex items-center gap-2"><div className="h-4 w-4 rounded border" /> <Link to="/investments" className="text-primary underline">Add your active FDs or investments</Link></li>
              <li className="flex items-center gap-2"><div className="h-4 w-4 rounded border" /> <Link to="/bank-accounts" className="text-primary underline">Import a bank statement</Link></li>
            </ul>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Monthly Cash Flow (12 months)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthlyFlow}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 100000 ? `${(v/100000).toFixed(1)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number, name: string) => [inr(v), name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="In" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Deployed" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Net Worth Timeline</CardTitle></CardHeader>
              <CardContent>
                {netWorthTimeline.length < 2 ? (
                  <div className="h-[260px] flex items-center justify-center text-center text-sm text-muted-foreground px-6">
                    Your net worth timeline will appear here as you add more data over time. Keep recording!
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={netWorthTimeline}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 100000 ? `${(v/100000).toFixed(1)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, fontSize: 12 }}
                        formatter={(v: number, n: string) => [inr(v), n === "net" ? "Total" : n === "bank" ? "Bank" : "Investments"]}
                      />
                      <Line type="monotone" dataKey="net" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Investment Allocation</CardTitle></CardHeader>
              <CardContent>
                {allocation.length === 0 ? (
                  <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">No active investments yet.</div>
                ) : (
                  <div className="relative">
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={allocation} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
                          {allocation.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => inr(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: "-30px" }}>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-lg font-semibold">{inr(totalInvested)}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Income Sources — {fy.label}</CardTitle></CardHeader>
              <CardContent>
                {incomeSourcesFY.rows.length === 0 || incomeSourcesFY.keys.length === 0 ? (
                  <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">No income recorded this FY.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={incomeSourcesFY.rows}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 100000 ? `${(v/100000).toFixed(1)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number) => inr(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {incomeSourcesFY.keys.map((k, i) => (
                        <Bar key={k} dataKey={k} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Upcoming Events */}
          <Card>
            <CardHeader><CardTitle className="text-base">Coming Up — Next 90 Days</CardTitle></CardHeader>
            <CardContent>
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nothing due in the next 90 days ✓</p>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.map((e) => {
                    const days = Math.ceil((new Date(e.date).getTime() - now.getTime()) / 86400000);
                    const bg = days <= 3 ? "bg-destructive/10 border-destructive/30"
                      : days <= 7 ? "bg-warning/10 border-warning/30"
                      : "bg-card border-border";
                    return (
                      <div key={e.id} className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${bg}`}>
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="text-xl">{e.icon}</span>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{e.title}</p>
                            <p className="text-xs text-muted-foreground">{fmtDate(e.date)} · {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `in ${days} days`}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {e.amount > 0 && <p className="font-medium text-sm">{inr(e.amount)}</p>}
                          {e.action && (
                            <Button size="sm" variant="outline" className="mt-1 h-7 text-xs" onClick={e.action}>
                              {e.actionLabel}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {staleAccounts.length > 0 && (
                <div className="mt-4 p-3 rounded-lg border border-warning/30 bg-warning/10 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-warning mt-0.5" />
                  <div className="flex-1 text-sm">
                    <p className="font-medium">{staleAccounts.length} account{staleAccounts.length > 1 ? "s" : ""} may need updating</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {staleAccounts.slice(0, 3).map((a) => `${a.name} (${a.lastDate ? fmtDate(a.lastDate) : "never"})`).join(", ")}
                    </p>
                    <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => navigate({ to: "/bank-accounts" })}>
                      Import Statements
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Per-Member Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {memberSummaries.map((m, i) => (
              <Card key={m.id} className="hover:shadow-md hover:-translate-y-0.5 transition">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-full flex items-center justify-center font-semibold text-white"
                         style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}>
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.is_business ? "Business" : "Salaried"}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <Row label="Income this FY" value={inr(m.totalIncome)} />
                    <Row label="Invested this FY" value={inr(m.invested)} />
                    <Row label="TDS this FY" value={inr(m.tds)} />
                    <Row label="Est. tax liability" value="—" />
                  </div>
                  <Button variant="ghost" size="sm" className="mt-3 w-full justify-between" onClick={() => navigate({ to: "/reports" })}>
                    View Full Profile <ChevronRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function sumInRange<T extends Record<string, unknown>>(arr: T[], dateKey: keyof T, from: string, to: string, valueKey: keyof T): number {
  return arr.filter((r) => {
    const d = r[dateKey] as string | null;
    return d != null && d >= from && d <= to;
  }).reduce((s, r) => s + Number(r[valueKey] ?? 0), 0);
}

/** Compute net worth as of a given date (inclusive). */
function netWorthAt(
  date: string,
  accounts: { id: string; opening_balance: number }[],
  incomes: { date: string; bank_account_id: string | null; net_amount: number }[],
  invs: { date: string; bank_account_id: string | null; amount: number; status: string }[],
  trs: { date: string; from_account_id: string; to_account_id: string; amount: number }[],
  ccb: { payment_date: string | null; bank_account_id: string | null; payment_amount: number }[],
  bi: { date: string; bank_account_id: string | null; net_received: number }[],
  ep: { paid_date: string; bank_account_id: string | null; amount: number }[],
  mode: "full" | "bank-only" = "full",
): number {
  const bal: Record<string, number> = {};
  for (const a of accounts) bal[a.id] = Number(a.opening_balance);
  for (const i of incomes) if (i.date <= date && i.bank_account_id) bal[i.bank_account_id] = (bal[i.bank_account_id] ?? 0) + Number(i.net_amount);
  for (const b of bi) if (b.date <= date && b.bank_account_id) bal[b.bank_account_id] = (bal[b.bank_account_id] ?? 0) + Number(b.net_received);
  for (const inv of invs) if (inv.date <= date && inv.bank_account_id) bal[inv.bank_account_id] = (bal[inv.bank_account_id] ?? 0) - Number(inv.amount);
  for (const t of trs) if (t.date <= date) {
    bal[t.from_account_id] = (bal[t.from_account_id] ?? 0) - Number(t.amount);
    bal[t.to_account_id] = (bal[t.to_account_id] ?? 0) + Number(t.amount);
  }
  for (const c of ccb) if (c.payment_date && c.payment_date <= date && c.bank_account_id) bal[c.bank_account_id] = (bal[c.bank_account_id] ?? 0) - Number(c.payment_amount);
  for (const e of ep) if (e.paid_date <= date && e.bank_account_id) bal[e.bank_account_id] = (bal[e.bank_account_id] ?? 0) - Number(e.amount);
  const bankTotal = Object.values(bal).reduce((s, v) => s + v, 0);
  if (mode === "bank-only") return bankTotal;
  const invTotal = invs.filter((i) => i.date <= date && i.status === "Active").reduce((s, i) => s + Number(i.amount), 0);
  return bankTotal + invTotal;
}

// Suppress unused import warnings for things kept for future
void monthLabel;
void Landmark; void CreditCard; void FileText; void Calendar;
