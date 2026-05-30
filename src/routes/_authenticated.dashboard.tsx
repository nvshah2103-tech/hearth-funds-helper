import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank, Receipt, Calendar,
  AlertTriangle, ArrowUpRight, PlusCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { inr, inrCompact, fmtDate, fyList, fyFor, greeting } from "@/lib/format";
import { AmountDisplay } from "@/components/ui/amount-display";
import { MemberAvatar } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: DashboardPage });

type KPIs = {
  total_bank_balance: number; total_active_investments: number;
  net_worth: number; net_worth_last_month: number; net_worth_change: number; net_worth_change_pct: number;
  current_month_income: number; current_month_deployed: number; current_month_surplus: number;
  fy_tds_salary: number; fy_tds_fd: number; fy_tds_business: number; fy_tds_total: number;
  active_investment_count: number;
  next_maturity_name: string | null; next_maturity_date: string | null; next_maturity_amount: number | null;
};

const PIE_COLORS = ["#a4c9ff", "#ddb7ff", "#67e8f9", "#fabd34", "#4ade80", "#ffb4ab", "#fb923c"];

function useRpc<T>(name: string, args: Record<string, unknown>, enabled = true) {
  return useQuery({
    queryKey: [name, args],
    enabled,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)(name, args);
      if (error) throw error;
      return data as T;
    },
  });
}

function DashboardPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const fys = fyList(5);
  const [fyKey, setFyKey] = useState(fyFor().label);
  const fy = fys.find((f) => f.label === fyKey) ?? fys[0];
  const enabled = !!userId;
  const args = { p_user_id: userId, p_fy_start: fy.start, p_fy_end: fy.end };

  const kpis = useRpc<KPIs>("get_dashboard_kpis", args, enabled);
  const cashflow = useRpc<Array<{ month_label: string; total_income: number; total_deployed: number }>>(
    "get_monthly_cashflow", { p_user_id: userId, p_months: 12 }, enabled);
  const allocation = useRpc<Array<{ investment_type: string; total_amount: number; percentage_of_total: number }>>(
    "get_investment_allocation", { p_user_id: userId }, enabled);
  const timeline = useRpc<Array<{ month_date: string; bank_total: number; investment_total: number }>>(
    "get_net_worth_timeline", { p_user_id: userId }, enabled);
  const events = useRpc<Array<{ event_type: string; event_name: string; event_date: string; amount: number; days_until: number; is_overdue: boolean; urgency: "red" | "amber" | "grey" }>>(
    "get_upcoming_events", { p_user_id: userId, p_days_ahead: 90 }, enabled);
  const members = useRpc<Array<{ member_id: string; member_name: string; member_type: string; total_income_fy: number; total_invested_fy: number; total_tds_fy: number }>>(
    "get_member_summaries", args, enabled);

  const k = kpis.data;
  const isEmpty = k && k.net_worth === 0 && k.active_investment_count === 0 && k.current_month_income === 0;

  const timelineData = useMemo(() => (timeline.data ?? []).map((t) => ({
    month: t.month_date, net: Number(t.bank_total) + Number(t.investment_total),
  })), [timeline.data]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{greeting()}{user?.email ? `, ${user.email.split("@")[0]}` : ""}.</h1>
          <p className="text-sm text-muted-foreground">Here's your family's financial snapshot.</p>
        </div>
        <Select value={fyKey} onValueChange={setFyKey}>
          <SelectTrigger className="w-[160px] bg-card border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            {fys.map((f) => <SelectItem key={f.label} value={f.label}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          loading={kpis.isLoading} icon={Wallet} label="Total Family Net Worth"
          value={inr(k?.net_worth)}
          sub={k && k.net_worth_change !== 0 ? (
            <span className={cn("inline-flex items-center gap-1 text-xs",
              k.net_worth_change >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-destructive)]")}>
              {k.net_worth_change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {inr(Math.abs(k.net_worth_change))} ({k.net_worth_change_pct.toFixed(1)}%)
            </span>
          ) : <span className="text-xs text-muted-foreground">Bank + Active investments</span>}
        />
        <KpiCard
          loading={kpis.isLoading} icon={ArrowUpRight} label="This Month Cash Flow"
          value={<AmountDisplay amount={k?.current_month_surplus} type={(k?.current_month_surplus ?? 0) >= 0 ? "credit" : "debit"} />}
          sub={<span className="text-xs text-muted-foreground">
            In <span className="text-[var(--color-success)]">{inr(k?.current_month_income)}</span> ·
            Out <span className="text-[var(--color-destructive)]">{inr(k?.current_month_deployed)}</span>
          </span>}
        />
        <KpiCard
          loading={kpis.isLoading} icon={Receipt} label={`TDS · ${fy.label}`}
          value={<AmountDisplay amount={k?.fy_tds_total} type="tds" />}
          sub={<span className="text-xs text-muted-foreground">
            Salary {inrCompact(k?.fy_tds_salary)} · FD {inrCompact(k?.fy_tds_fd)} · Biz {inrCompact(k?.fy_tds_business)}
          </span>}
        />
        <KpiCard
          loading={kpis.isLoading} icon={PiggyBank} label="Active Investments"
          value={`${k?.active_investment_count ?? 0} · ${inr(k?.total_active_investments)}`}
          sub={k?.next_maturity_name ? (
            <span className="text-xs text-muted-foreground">
              Next: {k.next_maturity_name} · {fmtDate(k.next_maturity_date)} · {inr(k.next_maturity_amount)}
            </span>
          ) : <span className="text-xs text-muted-foreground">No upcoming maturity</span>}
        />
      </div>

      {isEmpty ? (
        <EmptyState
          icon={PlusCircle}
          title="Your dashboard is waiting"
          description="Add bank accounts, record income, and log investments — your numbers and charts will come alive here."
          actionLabel="Add a bank account"
          onAction={() => (window.location.href = "/bank-accounts")}
        />
      ) : (
        <>
          {/* Charts row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Monthly Cash Flow · 12 months</CardTitle></CardHeader>
              <CardContent className="h-72">
                {cashflow.isLoading ? <Skeleton className="h-full w-full" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={cashflow.data ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month_label" stroke="var(--muted-foreground)" fontSize={11} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => inrCompact(v)} />
                      <Tooltip content={<DarkTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="total_income" name="Income" fill="#4ade80" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="total_deployed" name="Deployed" fill="#a4c9ff" radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="total_income" stroke="#4ade80" strokeWidth={0} dot={false} legendType="none" />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Investment Allocation</CardTitle></CardHeader>
              <CardContent className="h-72">
                {allocation.isLoading ? <Skeleton className="h-full w-full" /> : (allocation.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">No active investments yet.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={allocation.data} dataKey="total_amount" nameKey="investment_type" innerRadius={50} outerRadius={85} paddingAngle={2}>
                          {(allocation.data ?? []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<DarkTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col justify-center gap-2 text-sm">
                      {(allocation.data ?? []).map((a, i) => (
                        <div key={a.investment_type} className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="flex-1 truncate">{a.investment_type}</span>
                          <span className="text-muted-foreground text-xs">{a.percentage_of_total}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Charts row 2 + events */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Net Worth Timeline</CardTitle></CardHeader>
              <CardContent className="h-72">
                {timeline.isLoading ? <Skeleton className="h-full w-full" /> : timelineData.length < 2 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">Add a few more months of data to see your trajectory.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timelineData}>
                      <defs>
                        <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a4c9ff" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#a4c9ff" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11}
                        tickFormatter={(v) => new Date(v).toLocaleString("en-IN", { month: "short", year: "2-digit" })} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => inrCompact(v)} />
                      <Tooltip content={<DarkTooltip />} />
                      <Area type="monotone" dataKey="net" stroke="#a4c9ff" strokeWidth={2} fill="url(#nwGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" />Upcoming · 90 days</CardTitle></CardHeader>
              <CardContent className="space-y-2 max-h-72 overflow-y-auto">
                {events.isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
                ) : (events.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No upcoming events.</p>
                ) : (
                  (events.data ?? []).map((e, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-md px-3 py-2 border-l-2 flex items-center justify-between gap-2",
                        e.urgency === "red" && "bg-red-500/10 border-red-500",
                        e.urgency === "amber" && "bg-amber-500/10 border-amber-500",
                        e.urgency === "grey" && "bg-muted/30 border-border",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{e.event_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {fmtDate(e.event_date)} · {e.is_overdue ? "Overdue" : `${e.days_until}d`}
                        </p>
                      </div>
                      <AmountDisplay amount={e.amount} type="neutral" className="text-sm" />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Members */}
          <Card>
            <CardHeader><CardTitle className="text-base">Per-member · {fy.label}</CardTitle></CardHeader>
            <CardContent>
              {members.isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
                </div>
              ) : (members.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No family members added yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(members.data ?? []).map((m, i) => (
                    <div key={m.member_id} className="rounded-lg border border-border bg-muted/20 p-4 flex gap-3">
                      <MemberAvatar name={m.member_name} index={i} size="lg" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{m.member_name}</p>
                        <p className="text-[11px] text-muted-foreground capitalize">{m.member_type}</p>
                        <div className="mt-2 grid grid-cols-3 gap-1 text-[11px]">
                          <div><div className="text-muted-foreground">Income</div><div className="text-[var(--color-success)]">{inrCompact(m.total_income_fy)}</div></div>
                          <div><div className="text-muted-foreground">Invested</div><div className="text-[var(--color-investment)]">{inrCompact(m.total_invested_fy)}</div></div>
                          <div><div className="text-muted-foreground">TDS</div><div className="text-[var(--color-tds)]">{inrCompact(m.total_tds_fy)}</div></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {kpis.error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <span>Couldn't load dashboard: {(kpis.error as Error).message}</span>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => kpis.refetch()}>Retry</Button>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  loading, icon: Icon, label, value, sub,
}: {
  loading?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-5 pb-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        {loading ? <Skeleton className="h-7 w-32" /> : (
          <div className="text-2xl font-semibold font-mono tabular-nums">{value}</div>
        )}
        <div>{loading ? <Skeleton className="h-3 w-40" /> : sub}</div>
      </CardContent>
    </Card>
  );
}

function DarkTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      {label && <div className="font-medium mb-1">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono">{inr(p.value)}</span>
        </div>
      ))}
    </div>
  );
}
