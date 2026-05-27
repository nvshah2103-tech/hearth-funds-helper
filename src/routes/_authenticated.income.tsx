import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIncomes, useMembers, useBankAccounts } from "@/lib/data-hooks";
import { inr, fmtDate, fyList } from "@/lib/format";
import { AddIncomeButton, DeleteRow } from "@/components/forms/IncomeForm";
import { downloadCSV } from "@/lib/csv";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/income")({ component: IncomePage });

function IncomePage() {
  const incs = useIncomes();
  const members = useMembers();
  const accts = useBankAccounts();
  const qc = useQueryClient();
  const fys = fyList();
  const [fyIdx, setFyIdx] = useState(0);
  const fy = fys[fyIdx];

  const memberName = (id: string | null) => members.data?.find((m) => m.id === id)?.name ?? "—";
  const acctName = (id: string | null) => accts.data?.find((a) => a.id === id)?.name ?? "—";

  const filtered = (incs.data ?? []).filter((i) => i.date >= fy.start && i.date <= fy.end);
  const totalNet = filtered.reduce((s, i) => s + Number(i.net_amount), 0);
  const totalTds = filtered.reduce((s, i) => s + Number(i.tds), 0);

  function exportCsv() {
    downloadCSV(`income-${fy.label}.csv`, filtered.map((i) => ({
      Date: fmtDate(i.date), Member: memberName(i.member_id), Type: i.income_type,
      Amount: Number(i.amount), TDS: Number(i.tds), Net: Number(i.net_amount),
      Account: acctName(i.bank_account_id), Notes: i.notes ?? "",
    })));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Income</h1>
          <p className="text-sm text-muted-foreground">Track salary, business, maturities, dividends and interest.</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={fyIdx.toString()} onValueChange={(v) => setFyIdx(Number(v))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{fys.map((f, i) => <SelectItem key={i} value={i.toString()}>{f.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />Export</Button>
          <AddIncomeButton />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">{fy.label} Total Net</p><p className="text-2xl font-semibold text-success">{inr(totalNet)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">{fy.label} Total TDS</p><p className="text-2xl font-semibold">{inr(totalTds)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Entries</p><p className="text-2xl font-semibold">{filtered.length}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Records</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Member</TableHead><TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead><TableHead className="text-right">TDS</TableHead>
                <TableHead className="text-right">Net</TableHead><TableHead>Account</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{fmtDate(i.date)}</TableCell>
                    <TableCell>{memberName(i.member_id)}</TableCell>
                    <TableCell>{i.income_type}</TableCell>
                    <TableCell className="text-right font-mono">{inr(i.amount)}</TableCell>
                    <TableCell className="text-right font-mono">{inr(i.tds)}</TableCell>
                    <TableCell className="text-right font-mono text-success">{inr(i.net_amount)}</TableCell>
                    <TableCell>{acctName(i.bank_account_id)}</TableCell>
                    <TableCell className="text-right"><DeleteRow table="incomes" id={i.id} onDeleted={() => qc.invalidateQueries({ queryKey: ["incomes"] })} /></TableCell>
                  </TableRow>
                ))}
                {!filtered.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No income recorded for {fy.label} yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
