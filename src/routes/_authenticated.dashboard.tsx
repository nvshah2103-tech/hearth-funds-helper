import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useBankAccounts, useIncomes, useInvestments, useTransfers, useCCBills,
  useBusinessIncomes, useEmiPayments, useEmis, computeBalances,
} from "@/lib/data-hooks";
import { inr, fmtDate, fyFor } from "@/lib/format";
import { TrendingUp, PiggyBank, CreditCard, Landmark, Wallet, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const accts = useBankAccounts();
  const incomes = useIncomes();
  const invs = useInvestments();
  const trs = useTransfers();
  const ccb = useCCBills();
  const bi = useBusinessIncomes();
  const ep = useEmiPayments();
  const emis = useEmis();

  const balances = useMemo(() => computeBalances(
    accts.data ?? [], incomes.data ?? [], invs.data ?? [], trs.data ?? [],
    ccb.data ?? [], bi.data ?? [], ep.data ?? [],
  ), [accts.data, incomes.data, invs.data, trs.data, ccb.data, bi.data, ep.data]);

  const totalBank = Object.values(balances).reduce((s, v) => s + v, 0);
  const activeInvs = (invs.data ?? []).filter((i) => i.status === "Active");
  const totalInvested = activeInvs.reduce((s, i) => s + Number(i.amount), 0);
  const netWorth = totalBank + totalInvested;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthIncome = (incomes.data ?? []).filter((i) => i.date >= monthStart).reduce((s, i) => s + Number(i.net_amount), 0)
    + (bi.data ?? []).filter((b) => b.date >= monthStart).reduce((s, b) => s + Number(b.net_received), 0);
  const monthInvested = (invs.data ?? []).filter((i) => i.date >= monthStart).reduce((s, i) => s + Number(i.amount), 0);
  const monthCC = (ccb.data ?? []).filter((c) => c.billing_month >= monthStart).reduce((s, c) => s + Number(c.total_bill), 0);
  const emiDueMonth = (emis.data ?? []).filter((e) => e.status === "Active").reduce((s, e) => s + Number(e.emi_amount), 0);

  const fy = fyFor();
  const tdsYTD = (incomes.data ?? []).filter((i) => i.date >= fy.start && i.date <= fy.end).reduce((s, i) => s + Number(i.tds), 0)
    + (bi.data ?? []).filter((b) => b.date >= fy.start && b.date <= fy.end).reduce((s, b) => s + Number(b.tds), 0);

  const in90 = new Date(now); in90.setDate(in90.getDate() + 90);
  const upcomingMats = activeInvs.filter((i) => i.maturity_date && i.maturity_date >= now.toISOString().slice(0, 10) && i.maturity_date <= in90.toISOString().slice(0, 10))
    .sort((a, b) => (a.maturity_date! < b.maturity_date! ? -1 : 1));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Snapshot of your family's finances — {fy.label}.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={Wallet} label="Net Worth" value={inr(netWorth)} hint={`Bank ${inr(totalBank)} + Invested ${inr(totalInvested)}`} />
        <Kpi icon={TrendingUp} label="This Month — Income" value={inr(monthIncome)} accent="success" />
        <Kpi icon={PiggyBank} label="This Month — Invested" value={inr(monthInvested)} />
        <Kpi icon={CreditCard} label="This Month — CC Bills" value={inr(monthCC)} accent="warning" />
        <Kpi icon={Landmark} label="EMI Due (Monthly)" value={inr(emiDueMonth)} />
        <Kpi icon={AlertCircle} label={`TDS YTD (${fy.label})`} value={inr(tdsYTD)} />
        <Kpi icon={PiggyBank} label="Active Investments" value={`${activeInvs.length}`} hint={`${inr(totalInvested)} deployed`} />
        <Kpi icon={Landmark} label="Active Loans" value={`${(emis.data ?? []).filter((e) => e.status === "Active").length}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Bank balances</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(accts.data ?? []).map((a) => (
                <Link key={a.id} to="/bank-accounts/$id" params={{ id: a.id }} className="flex justify-between py-2 border-b last:border-0 hover:bg-accent rounded px-2">
                  <span>
                    <span className="font-medium">{a.name}</span>
                    {a.bank_name && <span className="text-muted-foreground text-sm ml-2">{a.bank_name}</span>}
                  </span>
                  <span className="font-mono">{inr(balances[a.id] ?? 0)}</span>
                </Link>
              ))}
              {!accts.data?.length && <p className="text-sm text-muted-foreground">No accounts yet.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Upcoming maturities (next 90 days)</CardTitle></CardHeader>
          <CardContent>
            {upcomingMats.length === 0 && <p className="text-sm text-muted-foreground">Nothing maturing soon.</p>}
            <div className="space-y-2">
              {upcomingMats.map((m) => (
                <div key={m.id} className="flex justify-between py-2 border-b last:border-0">
                  <span>
                    <span className="font-medium">{m.investment_type}</span>
                    {m.institution && <span className="text-muted-foreground text-sm ml-2">{m.institution}</span>}
                  </span>
                  <span className="text-sm">{fmtDate(m.maturity_date)} · {inr(m.expected_maturity_amount ?? m.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint, accent }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint?: string;
  accent?: "success" | "warning";
}) {
  const accentClass = accent === "success" ? "text-success" : accent === "warning" ? "text-warning" : "text-primary";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={`text-2xl font-semibold mt-1 ${accentClass}`}>{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
          <Icon className={`h-5 w-5 ${accentClass}`} />
        </div>
      </CardContent>
    </Card>
  );
}
