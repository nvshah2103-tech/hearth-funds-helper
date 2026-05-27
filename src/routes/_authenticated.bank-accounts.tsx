import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBankAccounts, useIncomes, useInvestments, useTransfers, useCCBills, useBusinessIncomes, useEmiPayments, computeBalances } from "@/lib/data-hooks";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/bank-accounts")({ component: BankAccountsPage });

function BankAccountsPage() {
  const accts = useBankAccounts();
  const inc = useIncomes(); const inv = useInvestments(); const tr = useTransfers();
  const cc = useCCBills(); const bi = useBusinessIncomes(); const ep = useEmiPayments();

  const balances = useMemo(() => computeBalances(
    accts.data ?? [], inc.data ?? [], inv.data ?? [], tr.data ?? [], cc.data ?? [], bi.data ?? [], ep.data ?? [],
  ), [accts.data, inc.data, inv.data, tr.data, cc.data, bi.data, ep.data]);

  const total = Object.values(balances).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Bank Accounts</h1>
        <p className="text-sm text-muted-foreground">Click an account to view its full ledger.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Current balances</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Account</TableHead><TableHead>Bank</TableHead><TableHead>Type</TableHead>
              <TableHead className="text-right">Opening</TableHead><TableHead className="text-right">Current</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(accts.data ?? []).map((a) => (
                <TableRow key={a.id} className="cursor-pointer hover:bg-accent">
                  <TableCell>
                    <Link to="/bank-accounts/$id" params={{ id: a.id }} className="font-medium text-primary hover:underline">{a.name}</Link>
                  </TableCell>
                  <TableCell>{a.bank_name ?? "—"}</TableCell>
                  <TableCell>{a.account_type}</TableCell>
                  <TableCell className="text-right font-mono">{inr(a.opening_balance)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{inr(balances[a.id] ?? 0)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={4} className="text-right font-semibold">Total</TableCell>
                <TableCell className="text-right font-mono font-semibold text-primary">{inr(total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
