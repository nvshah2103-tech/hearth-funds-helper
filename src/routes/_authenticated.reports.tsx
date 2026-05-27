import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIncomes, useInvestments, useBankAccounts, useTransfers, useCCBills, useBusinessIncomes, useEmiPayments, useMembers, useCreditCards, computeBalances } from "@/lib/data-hooks";
import { inr, fmtDate, fyList, monthLabel } from "@/lib/format";
import { downloadCSV } from "@/lib/csv";
import { Download, Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({ component: ReportsPage });

function ReportsPage() {
  const incs = useIncomes(); const invs = useInvestments(); const accts = useBankAccounts();
  const trs = useTransfers(); const ccb = useCCBills(); const bis = useBusinessIncomes();
  const ep = useEmiPayments(); const members = useMembers(); const cards = useCreditCards();
  const fys = fyList(); const [fyIdx, setFyIdx] = useState(0); const fy = fys[fyIdx];
  const [memberFilter, setMemberFilter] = useState("all");

  const memberName = (id: string | null) => members.data?.find((m) => m.id === id)?.name ?? "—";
  const acctName = (id: string | null) => accts.data?.find((a) => a.id === id)?.name ?? "—";
  const cardName = (id: string) => cards.data?.find((c) => c.id === id)?.name ?? "—";

  const incFy = (incs.data ?? []).filter((i) => i.date >= fy.start && i.date <= fy.end);
  const biFy = (bis.data ?? []).filter((b) => b.date >= fy.start && b.date <= fy.end);
  const invFy = (invs.data ?? []).filter((i) => i.date >= fy.start && i.date <= fy.end);

  const balances = useMemo(() => computeBalances(
    accts.data ?? [], incs.data ?? [], invs.data ?? [], trs.data ?? [], ccb.data ?? [], bis.data ?? [], ep.data ?? [],
  ), [accts.data, incs.data, invs.data, trs.data, ccb.data, bis.data, ep.data]);

  // Fresh vs Reinvested
  const fresh = invFy.filter((i) => i.source_of_funds === "Fresh Income").reduce((s, i) => s + Number(i.amount), 0);
  const partialFresh = invFy.filter((i) => i.source_of_funds === "Partial Reinvestment").reduce((s, i) => s + (Number(i.fresh_topup_amount) || 0), 0);
  const reinv = invFy.filter((i) => i.source_of_funds !== "Fresh Income").reduce((s, i) => s + Number(i.amount), 0) - partialFresh;

  // Monthly cash flow
  const months: Record<string, { in: number; out: number }> = {};
  function bucket(d: string) { return d.slice(0, 7); }
  for (const i of incFy) months[bucket(i.date)] = { ...(months[bucket(i.date)] ?? { in: 0, out: 0 }), in: (months[bucket(i.date)]?.in ?? 0) + Number(i.net_amount) };
  for (const b of biFy) months[bucket(b.date)] = { ...(months[bucket(b.date)] ?? { in: 0, out: 0 }), in: (months[bucket(b.date)]?.in ?? 0) + Number(b.net_received) };
  for (const v of invFy) months[bucket(v.date)] = { ...(months[bucket(v.date)] ?? { in: 0, out: 0 }), out: (months[bucket(v.date)]?.out ?? 0) + Number(v.amount) };
  for (const c of (ccb.data ?? []).filter((c) => c.billing_month >= fy.start && c.billing_month <= fy.end))
    months[bucket(c.billing_month)] = { ...(months[bucket(c.billing_month)] ?? { in: 0, out: 0 }), out: (months[bucket(c.billing_month)]?.out ?? 0) + Number(c.total_bill) };
  for (const e of (ep.data ?? []).filter((p) => p.paid_date >= fy.start && p.paid_date <= fy.end))
    months[bucket(e.paid_date)] = { ...(months[bucket(e.paid_date)] ?? { in: 0, out: 0 }), out: (months[bucket(e.paid_date)]?.out ?? 0) + Number(e.amount) };
  const monthRows = Object.entries(months).sort(([a], [b]) => a < b ? -1 : 1);

  // Member-wise filter
  const filterMember = <T extends { member_id: string | null }>(rows: T[]) =>
    memberFilter === "all" ? rows : rows.filter((r) => r.member_id === memberFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2 no-print">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground">Click Print to save any report as PDF (use "Save as PDF" in the print dialog).</p>
        </div>
        <div className="flex gap-2">
          <Select value={fyIdx.toString()} onValueChange={(v) => setFyIdx(Number(v))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{fys.map((f, i) => <SelectItem key={i} value={i.toString()}>{f.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={memberFilter} onValueChange={setMemberFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All members</SelectItem>
              {(members.data ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Print / PDF</Button>
        </div>
      </div>

      <Tabs defaultValue="income">
        <TabsList className="flex-wrap h-auto no-print">
          <TabsTrigger value="income">Annual Income</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          <TabsTrigger value="fresh">Fresh vs Reinvested</TabsTrigger>
          <TabsTrigger value="tds">TDS Summary</TabsTrigger>
          <TabsTrigger value="bank">Bank Summary</TabsTrigger>
          <TabsTrigger value="cc">Credit Card Summary</TabsTrigger>
          <TabsTrigger value="cf">Cash Flow</TabsTrigger>
          <TabsTrigger value="member">Member Snapshot</TabsTrigger>
        </TabsList>

        <TabsContent value="income">
          <Card><CardHeader>
            <div className="flex justify-between items-start">
              <div><CardTitle>Annual Income Statement — {fy.label}</CardTitle><CardDescription>Salary, business, dividends, interest, maturities.</CardDescription></div>
              <Button size="sm" variant="outline" onClick={() => downloadCSV(`income-${fy.label}.csv`, filterMember(incFy).map((i) => ({
                Date: fmtDate(i.date), Member: memberName(i.member_id), Type: i.income_type, Amount: i.amount, TDS: i.tds, Net: i.net_amount,
              })))}><Download className="h-4 w-4 mr-1" />CSV</Button>
            </div>
          </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Member</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">TDS</TableHead><TableHead className="text-right">Net</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filterMember(incFy).map((i) => (
                    <TableRow key={i.id}><TableCell>{fmtDate(i.date)}</TableCell><TableCell>{memberName(i.member_id)}</TableCell><TableCell>{i.income_type}</TableCell><TableCell className="text-right font-mono">{inr(i.amount)}</TableCell><TableCell className="text-right font-mono">{inr(i.tds)}</TableCell><TableCell className="text-right font-mono">{inr(i.net_amount)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="portfolio">
          <Card><CardHeader><CardTitle>Investment Portfolio</CardTitle><CardDescription>All active investments grouped by type.</CardDescription></CardHeader>
            <CardContent>
              {Array.from(new Set((invs.data ?? []).filter((i) => i.status === "Active").map((i) => i.investment_type))).map((type) => {
                const rows = (invs.data ?? []).filter((i) => i.status === "Active" && i.investment_type === type);
                const total = rows.reduce((s, i) => s + Number(i.amount), 0);
                return (
                  <div key={type} className="mb-4">
                    <h3 className="font-semibold mb-2">{type} — {inr(total)}</h3>
                    <Table>
                      <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Member</TableHead><TableHead>Institution</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Maturity</TableHead><TableHead className="text-right">Expected</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {rows.map((i) => (
                          <TableRow key={i.id}><TableCell>{fmtDate(i.date)}</TableCell><TableCell>{memberName(i.member_id)}</TableCell><TableCell>{i.institution ?? "—"}</TableCell><TableCell className="text-right font-mono">{inr(i.amount)}</TableCell><TableCell>{i.maturity_date ? fmtDate(i.maturity_date) : "—"}</TableCell><TableCell className="text-right font-mono">{i.expected_maturity_amount ? inr(i.expected_maturity_amount) : "—"}</TableCell></TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fresh">
          <Card><CardHeader><CardTitle>Fresh vs Reinvested Capital — {fy.label}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Fresh money</p><p className="text-2xl font-semibold text-success">{inr(fresh + partialFresh)}</p></CardContent></Card>
                <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Rolled over</p><p className="text-2xl font-semibold">{inr(reinv)}</p></CardContent></Card>
                <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Total invested</p><p className="text-2xl font-semibold text-primary">{inr(fresh + reinv + partialFresh)}</p></CardContent></Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tds">
          <Card><CardHeader><CardTitle>TDS Summary — {fy.label}</CardTitle><CardDescription>By member and source. Useful for ITR filing.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Source</TableHead><TableHead className="text-right">TDS</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(() => {
                    const map: Record<string, number> = {};
                    for (const i of incFy) { const k = `${memberName(i.member_id)}|${i.income_type}`; map[k] = (map[k] ?? 0) + Number(i.tds); }
                    for (const b of biFy) { const k = `${memberName(b.member_id)}|Business`; map[k] = (map[k] ?? 0) + Number(b.tds); }
                    const rows = Object.entries(map).filter(([, v]) => v > 0);
                    return rows.length ? rows.map(([k, v]) => {
                      const [m, src] = k.split("|");
                      return <TableRow key={k}><TableCell>{m}</TableCell><TableCell>{src}</TableCell><TableCell className="text-right font-mono">{inr(v)}</TableCell></TableRow>;
                    }) : <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No TDS recorded.</TableCell></TableRow>;
                  })()}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bank">
          <Card><CardHeader><CardTitle>Bank Account Summary</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Bank</TableHead><TableHead className="text-right">Current Balance</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(accts.data ?? []).map((a) => <TableRow key={a.id}><TableCell>{a.name}</TableCell><TableCell>{a.bank_name ?? "—"}</TableCell><TableCell className="text-right font-mono">{inr(balances[a.id] ?? 0)}</TableCell></TableRow>)}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cc">
          <Card><CardHeader><CardTitle>Credit Card Summary</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Card</TableHead><TableHead className="text-right">Bill</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Outstanding</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(ccb.data ?? []).map((b) => <TableRow key={b.id}><TableCell>{monthLabel(b.billing_month)}</TableCell><TableCell>{cardName(b.card_id)}</TableCell><TableCell className="text-right font-mono">{inr(b.total_bill)}</TableCell><TableCell className="text-right font-mono">{inr(b.payment_amount)}</TableCell><TableCell className="text-right font-mono">{inr(Number(b.total_bill) - Number(b.payment_amount))}</TableCell></TableRow>)}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cf">
          <Card><CardHeader><CardTitle>Cash Flow — {fy.label}</CardTitle><CardDescription>Money in vs money deployed each month.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Month</TableHead><TableHead className="text-right">Money In</TableHead><TableHead className="text-right">Deployed</TableHead><TableHead className="text-right">Net</TableHead></TableRow></TableHeader>
                <TableBody>
                  {monthRows.map(([m, v]) => <TableRow key={m}><TableCell>{monthLabel(m + "-01")}</TableCell><TableCell className="text-right font-mono text-success">{inr(v.in)}</TableCell><TableCell className="text-right font-mono">{inr(v.out)}</TableCell><TableCell className={`text-right font-mono ${v.in - v.out >= 0 ? "text-success" : "text-destructive"}`}>{inr(v.in - v.out)}</TableCell></TableRow>)}
                  {!monthRows.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No activity in {fy.label}.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="member">
          <Card><CardHeader><CardTitle>Member-wise Snapshot</CardTitle><CardDescription>Filtered by {memberFilter === "all" ? "everyone" : memberName(memberFilter)} for {fy.label}.</CardDescription></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row k="Income (net)" v={inr(filterMember(incFy).reduce((s, i) => s + Number(i.net_amount), 0))} />
              <Row k="Business net" v={inr(biFy.filter((b) => memberFilter === "all" || b.member_id === memberFilter).reduce((s, b) => s + Number(b.net_received), 0))} />
              <Row k="Total TDS" v={inr(filterMember(incFy).reduce((s, i) => s + Number(i.tds), 0) + biFy.filter((b) => memberFilter === "all" || b.member_id === memberFilter).reduce((s, b) => s + Number(b.tds), 0))} />
              <Row k="Invested" v={inr(filterMember(invFy).reduce((s, i) => s + Number(i.amount), 0))} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between border-b py-2"><span className="text-muted-foreground">{k}</span><span className="font-mono font-semibold">{v}</span></div>;
}
