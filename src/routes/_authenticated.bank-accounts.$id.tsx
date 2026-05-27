import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBankAccounts, useIncomes, useInvestments, useTransfers, useCCBills, useBusinessIncomes, useEmiPayments } from "@/lib/data-hooks";
import { inr, fmtDate } from "@/lib/format";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/bank-accounts/$id")({ component: AccountLedger });

type Entry = { date: string; description: string; credit?: number; debit?: number };

function AccountLedger() {
  const { id } = Route.useParams();
  const accts = useBankAccounts();
  const inc = useIncomes(); const inv = useInvestments(); const tr = useTransfers();
  const cc = useCCBills(); const bi = useBusinessIncomes(); const ep = useEmiPayments();

  const account = accts.data?.find((a) => a.id === id);

  const entries = useMemo<Entry[]>(() => {
    const e: Entry[] = [];
    for (const x of inc.data ?? []) if (x.bank_account_id === id) e.push({ date: x.date, description: `Income · ${x.income_type}`, credit: Number(x.net_amount) });
    for (const x of bi.data ?? []) if (x.bank_account_id === id) e.push({ date: x.date, description: `Business · ${x.client_name}`, credit: Number(x.net_received) });
    for (const x of inv.data ?? []) if (x.bank_account_id === id) e.push({ date: x.date, description: `Investment · ${x.investment_type} ${x.institution ?? ""}`, debit: Number(x.amount) });
    for (const x of tr.data ?? []) {
      if (x.from_account_id === id) e.push({ date: x.date, description: `Transfer out · ${x.reason ?? ""}`, debit: Number(x.amount) });
      if (x.to_account_id === id) e.push({ date: x.date, description: `Transfer in · ${x.reason ?? ""}`, credit: Number(x.amount) });
    }
    for (const x of cc.data ?? []) if (x.bank_account_id === id && x.payment_amount) e.push({ date: x.payment_date ?? x.billing_month, description: `Credit card payment`, debit: Number(x.payment_amount) });
    for (const x of ep.data ?? []) if (x.bank_account_id === id) e.push({ date: x.paid_date, description: `EMI payment`, debit: Number(x.amount) });
    e.sort((a, b) => (a.date < b.date ? -1 : 1));
    return e;
  }, [id, inc.data, inv.data, tr.data, cc.data, bi.data, ep.data]);

  const opening = Number(account?.opening_balance ?? 0);
  let running = opening;
  const withRunning = entries.map((e) => {
    running += (e.credit ?? 0) - (e.debit ?? 0);
    return { ...e, balance: running };
  });

  if (!account) return <div className="text-muted-foreground">Account not found. <Link to="/bank-accounts" className="text-primary underline">Back</Link></div>;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild><Link to="/bank-accounts"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link></Button>
      <div>
        <h1 className="text-2xl font-semibold">{account.name}</h1>
        <p className="text-sm text-muted-foreground">{account.bank_name ?? ""} · {account.account_type}</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Opening</p><p className="text-xl font-mono">{inr(opening)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Current</p><p className="text-xl font-mono font-semibold text-primary">{inr(running)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Entries</p><p className="text-xl font-mono">{entries.length}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Transaction history</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Description</TableHead>
              <TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              <TableRow><TableCell colSpan={4} className="text-muted-foreground">Opening balance</TableCell><TableCell className="text-right font-mono">{inr(opening)}</TableCell></TableRow>
              {withRunning.map((e, i) => (
                <TableRow key={i}>
                  <TableCell>{fmtDate(e.date)}</TableCell>
                  <TableCell>{e.description}</TableCell>
                  <TableCell className="text-right font-mono text-success">{e.credit ? inr(e.credit) : ""}</TableCell>
                  <TableCell className="text-right font-mono text-destructive">{e.debit ? inr(e.debit) : ""}</TableCell>
                  <TableCell className="text-right font-mono">{inr(e.balance)}</TableCell>
                </TableRow>
              ))}
              {!withRunning.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No activity yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Badge variant="secondary">Tip: Inter-account transfers are not counted as income or expense.</Badge>
    </div>
  );
}
