import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useExpenses, useExpenseCategories, DEFAULT_CATEGORIES } from "@/lib/expense-hooks";
import { useBankAccounts, useMembers } from "@/lib/data-hooks";
import { inr, fmtDate, fyList, today } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Wallet, Receipt, TrendingDown, TrendingUp, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ConfirmDeleteRow, ConfirmChangesDialog, diffFields } from "@/components/forms/_shared";

export const Route = createFileRoute("/_authenticated/expenses")({ component: ExpensesPage });

const PIE_COLORS = ["#3b82f6", "#a855f7", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#8b5cf6", "#84cc16", "#f97316", "#14b8a6", "#64748b"];

function ExpensesPage() {
  const exps = useExpenses();
  const accts = useBankAccounts();
  const members = useMembers();
  const qc = useQueryClient();
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

  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = lastMonthDate.toISOString().slice(0, 7);

  const thisMonthExp = (exps.data ?? []).filter((e) => e.date.startsWith(thisMonth));
  const lastMonthExp = (exps.data ?? []).filter((e) => e.date.startsWith(lastMonth));
  const thisTotal = thisMonthExp.reduce((s, e) => s + Number(e.amount), 0);
  const lastTotal = lastMonthExp.reduce((s, e) => s + Number(e.amount), 0);
  const change = lastTotal > 0 ? ((thisTotal - lastTotal) / lastTotal) * 100 : 0;

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
              description="Tap the + button at the bottom-center to log your first expense."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Paid To</TableHead>
                  <TableHead>Category</TableHead><TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Account</TableHead><TableHead>Member</TableHead>
                  <TableHead>Note</TableHead><TableHead></TableHead>
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
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <EditExpenseButton expense={e} />
                          <ConfirmDeleteRow table="expenses" id={e.id} amount={Number(e.amount)} label="expense" onDeleted={() => qc.invalidateQueries({ queryKey: ["expenses"] })} />
                        </div>
                      </TableCell>
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

const EXP_LABELS = {
  date: "Date", amount: "Amount", category: "Category",
  paid_to_name: "Paid to", payment_method: "Method",
  paid_from_account_id: "Account", note: "Note", member_id: "Member",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EditExpenseButton({ expense, trigger }: { expense: any; trigger?: ReactNode }) {
  const qc = useQueryClient();
  const cats = useExpenseCategories();
  const accts = useBankAccounts();
  const members = useMembers();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [date, setDate] = useState(expense.date ?? today());
  const [amount, setAmount] = useState(String(expense.amount ?? ""));
  const [category, setCategory] = useState(expense.category ?? "");
  const [paidFrom, setPaidFrom] = useState<string>(expense.paid_from_account_id ?? "cash");
  const [paymentMethod, setPaymentMethod] = useState<string>(expense.payment_method ?? "");
  const [paidTo, setPaidTo] = useState(expense.paid_to_name ?? "");
  const [note, setNote] = useState(expense.note ?? "");
  const [memberId, setMemberId] = useState<string>(expense.member_id ?? "");

  useEffect(() => {
    if (!open) {
      setDate(expense.date); setAmount(String(expense.amount));
      setCategory(expense.category); setPaidFrom(expense.paid_from_account_id ?? "cash");
      setPaymentMethod(expense.payment_method ?? ""); setPaidTo(expense.paid_to_name ?? "");
      setNote(expense.note ?? ""); setMemberId(expense.member_id ?? "");
    }
  }, [open, expense]);

  const allCats = (cats.data ?? []).map((c) => c.name).length ? (cats.data ?? []).map((c) => c.name) : [...DEFAULT_CATEGORIES];

  function payload() {
    return {
      date, amount: Number(amount) || 0, category,
      paid_from_account_id: paidFrom === "cash" ? null : paidFrom,
      payment_method: paymentMethod || null,
      paid_to_name: paidTo || null,
      note: note || null,
      member_id: memberId || null,
    };
  }

  async function doUpdate() {
    setBusy(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("expenses") as any).update(payload()).eq("id", expense.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["expenses"] });
    toast.success("Updated");
    setConfirmOpen(false); setOpen(false);
  }

  const changes = diffFields(
    {
      date: expense.date, amount: Number(expense.amount), category: expense.category,
      paid_to_name: expense.paid_to_name, payment_method: expense.payment_method,
      paid_from_account_id: expense.paid_from_account_id, note: expense.note,
      member_id: expense.member_id,
    },
    {
      date, amount: Number(amount) || 0, category,
      paid_to_name: paidTo || null, payment_method: paymentMethod || null,
      paid_from_account_id: paidFrom === "cash" ? null : paidFrom,
      note: note || null, member_id: memberId || null,
    },
    EXP_LABELS,
  );

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger ?? <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>}
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>Update this expense record.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><Label className="text-xs">Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="col-span-2">
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{allCats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Paid From</Label>
              <Select value={paidFrom} onValueChange={setPaidFrom}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  {(accts.data ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Method</Label>
              <Select value={paymentMethod || "none"} onValueChange={(v) => setPaymentMethod(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {["UPI", "Cash", "Debit Card", "NEFT/IMPS", "Cheque", "Other"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Paid To</Label><Input value={paidTo} onChange={(e) => setPaidTo(e.target.value)} /></div>
            <div><Label className="text-xs">Member</Label>
              <Select value={memberId || "none"} onValueChange={(v) => setMemberId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {(members.data ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label className="text-xs">Note</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={busy}>Review changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmChangesDialog open={confirmOpen} onOpenChange={setConfirmOpen} changes={changes} onConfirm={doUpdate} busy={busy} />
    </>
  );
}
