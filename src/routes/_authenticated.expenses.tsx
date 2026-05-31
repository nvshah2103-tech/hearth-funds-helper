import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useExpenses } from "@/lib/expense-hooks";
import { useBankAccounts, useMembers } from "@/lib/data-hooks";
import { inr, fmtDate, fyList } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Wallet, Receipt, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/expenses")({ component: ExpensesPage });

const PIE_COLORS = ["#3b82f6", "#a855f7", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#8b5cf6", "#84cc16", "#f97316", "#14b8a6", "#64748b"];

function ExpensesPage() {
  const exps = useExpenses();
  const accts = useBankAccounts();
  const members = useMembers();
  const fys = fyList();
  const [fyIdx, setFyIdx] = useState(0);
  const fy = fys[fyIdx];
  const [catFilter, setCatFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  const acctName = (id: string | null) => id ? (accts.data?.find((a) => a.id === id)?.name ?? "—") : "Cash";
  const memberName = (id: string | null) => members.data?.find((m) => m.id === id)?.name ?? "—";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (exps.data ?? []).filter((e) => {
      if (e.date < fy.start || e.date > fy.end) return false;
      if (catFilter && e.category !== catFilter) return false;
      if (q) {
        const hay = `${e.paid_to_name ?? ""} ${e.category} ${e.note ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [exps.data, fy, catFilter, search]);

  // Month-over-month
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = lastMonthDate.toISOString().slice(0, 7);

  const thisMonthExp = (exps.data ?? []).filter((e) => e.date.startsWith(thisMonth));
  const lastMonthExp = (exps.data ?? []).filter((e) => e.date.startsWith(lastMonth));
  const thisTotal = thisMonthExp.reduce((s, e) => s + Number(e.amount), 0);
  const lastTotal = lastMonthExp.reduce((s, e) => s + Number(e.amount), 0);
  const change = lastTotal > 0 ? ((thisTotal - lastTotal) / lastTotal) * 100 : 0;

  // Category breakdown
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of filtered) m.set(e.category, (m.get(e.category) ?? 0) + Number(e.amount));
    return Array.from(m.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const topCat = byCat[0];
  const categories = Array.from(new Set((exps.data ?? []).map((e) => e.category))).sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Expenses</h1>
          <p className="text-sm text-muted-foreground">Daily spending log across cash and accounts.</p>
        </div>
        <Select value={fyIdx.toString()} onValueChange={(v) => setFyIdx(Number(v))}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{fys.map((f, i) => <SelectItem key={i} value={i.toString()}>{f.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">This month</p>
              <p className="text-2xl font-semibold font-mono">{inr(thisTotal)}</p>
            </div>
            <Receipt className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">vs last month</p>
              <p className={cn("text-2xl font-semibold font-mono", change >= 0 ? "text-destructive" : "text-success")}>
                {change >= 0 ? "↑" : "↓"} {Math.abs(change).toFixed(0)}%
              </p>
              <p className="text-xs text-muted-foreground">Last: {inr(lastTotal)}</p>
            </div>
            {change >= 0 ? <TrendingUp className="h-8 w-8 text-destructive" /> : <TrendingDown className="h-8 w-8 text-success" />}
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Top category (FY)</p>
              <p className="text-lg font-semibold truncate">{topCat?.name ?? "—"}</p>
              <p className="text-sm font-mono">{topCat ? inr(topCat.value) : "—"}</p>
            </div>
            <Wallet className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent></Card>
      </div>

      {/* Donut + Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">By category</CardTitle></CardHeader>
          <CardContent>
            {byCat.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={byCat} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {byCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => inr(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-base">Filter</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Search description, paid-to, note…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCatFilter("")}
                className={cn("px-3 py-1 rounded-full text-xs border", !catFilter ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent")}
              >All</button>
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCatFilter(c === catFilter ? "" : c)}
                  className={cn("px-3 py-1 rounded-full text-xs border", catFilter === c ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent")}
                >{c}</button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Records ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No expenses yet"
              description="Tap the + button in the bottom-right to log your first expense."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Paid To</TableHead>
                  <TableHead>Category</TableHead><TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Account</TableHead><TableHead>Member</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{fmtDate(e.date)}</TableCell>
                      <TableCell>{e.paid_to_name ?? "—"}</TableCell>
                      <TableCell><Badge variant="secondary">{e.category}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.payment_method ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono text-destructive">{inr(e.amount)}</TableCell>
                      <TableCell className="text-xs">{acctName(e.paid_from_account_id)}</TableCell>
                      <TableCell className="text-xs">{memberName(e.member_id)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{e.note ?? ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
