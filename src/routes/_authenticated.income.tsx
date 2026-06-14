import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIncomes, useMembers, useBankAccounts } from "@/lib/data-hooks";
import { inr, fmtDate, fyList } from "@/lib/format";
import { AddIncomeButton, ConfirmDeleteRow } from "@/components/forms/IncomeForm";
import { downloadCSV } from "@/lib/csv";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/income")({ component: IncomePage });

function IncomePage() {
  const incs = useIncomes();
  const members = useMembers();
  const accts = useBankAccounts();
  const qc = useQueryClient();
  const fys = fyList();
  const [fyIdx, setFyIdx] = useState(0);
  const fy = fys[fyIdx];
  const [unconfirmedOnly, setUnconfirmedOnly] = useState(false);

  const memberName = (id: string | null) => members.data?.find((m) => m.id === id)?.name ?? "—";
  const acctName = (id: string | null) => accts.data?.find((a) => a.id === id)?.name ?? "—";

  const inWindow = (incs.data ?? []).filter((i) => i.date >= fy.start && i.date <= fy.end);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unconfirmedCount = inWindow.filter((i: any) => !i.tds_section_confirmed && Number(i.tds) > 0).length;
  const filtered = useMemo(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => inWindow.filter((i: any) => unconfirmedOnly ? (!i.tds_section_confirmed && Number(i.tds) > 0) : true),
    [inWindow, unconfirmedOnly],
  );
  const totalNet = filtered.reduce((s, i) => s + Number(i.net_amount), 0);
  const totalTds = filtered.reduce((s, i) => s + Number(i.tds), 0);

  function exportCsv() {
    downloadCSV(`income-${fy.label}.csv`, filtered.map((i) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Date: fmtDate(i.date), Member: memberName(i.member_id), Type: i.income_type,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Gross: Number((i as any).gross_amount ?? i.amount), TDS: Number(i.tds),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Section: (i as any).tds_section ?? "", Rate: (i as any).tds_rate ?? "",
      Net: Number(i.net_amount), Account: acctName(i.bank_account_id), Notes: i.notes ?? "",
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">{fy.label} Total Net</p><p className="text-2xl font-semibold text-success">{inr(totalNet)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">{fy.label} Total TDS</p><p className="text-2xl font-semibold">{inr(totalTds)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Entries</p><p className="text-2xl font-semibold">{filtered.length}</p></CardContent></Card>
        <Card
          onClick={() => setUnconfirmedOnly((v) => !v)}
          className={cn("cursor-pointer transition-colors", unconfirmedOnly && "border-amber-500")}
        >
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Unconfirmed TDS sections</p>
            <p className="text-2xl font-semibold text-amber-500">{unconfirmedCount}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{unconfirmedOnly ? "Showing only unconfirmed" : "Click to filter"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Records</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Member</TableHead><TableHead>Type</TableHead>
                <TableHead>TDS Section</TableHead><TableHead className="text-right">Rate %</TableHead>
                <TableHead className="text-right">Gross</TableHead><TableHead className="text-right">TDS</TableHead>
                <TableHead className="text-right">Net</TableHead><TableHead>Account</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((i) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const r = i as any;
                  const gross = Number(r.gross_amount ?? r.amount);
                  const unconfirmed = !r.tds_section_confirmed && Number(r.tds) > 0;
                  return (
                    <TableRow key={i.id}>
                      <TableCell>{fmtDate(i.date)}</TableCell>
                      <TableCell>{memberName(i.member_id)}</TableCell>
                      <TableCell>{i.income_type}</TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1.5">
                          {unconfirmed && <span title="Section not confirmed" className="h-2 w-2 rounded-full bg-amber-500 inline-block" />}
                          {r.tds_section ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{r.tds_rate != null ? Number(r.tds_rate).toFixed(2) : "—"}</TableCell>
                      <TableCell className="text-right font-mono">{inr(gross)}</TableCell>
                      <TableCell className="text-right font-mono">{inr(i.tds)}</TableCell>
                      <TableCell className="text-right font-mono text-success">{inr(i.net_amount)}</TableCell>
                      <TableCell>{acctName(i.bank_account_id)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <AddIncomeButton editing={i} />
                          <ConfirmDeleteRow table="incomes" id={i.id} amount={gross} label="income" onDeleted={() => qc.invalidateQueries({ queryKey: ["incomes"] })} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!filtered.length && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No income recorded for {fy.label} yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
