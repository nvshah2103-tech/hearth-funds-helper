import { useEffect, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useMembers, useBankAccounts, useInvestments } from "@/lib/data-hooks";
import { today } from "@/lib/format";
import { TDS_SECTIONS, TDS_QUICK_OPTIONS, getTDSSection, getTDSSectionByCode } from "@/lib/tds-constants";
import { ConfirmChangesDialog, ConfirmDeleteRow, diffFields } from "./_shared";

const TYPES = ["Salary", "Business Income", "FD Maturity", "Investment Maturity", "Dividend", "Interest", "Rental", "Other"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IncomeRow = any;

export { ConfirmDeleteRow };

/** Backward-compat: re-export DeleteRow but now using typed-amount confirmation */
export function DeleteRow({ table, id, amount, onDeleted }: { table: string; id: string; amount?: number | string; onDeleted: () => void }) {
  return <ConfirmDeleteRow table={table} id={id} amount={amount ?? 0} onDeleted={onDeleted} />;
}

export function Field({ label, full, children }: { label: string; full?: boolean; children: ReactNode }) {
  return (
    <div className={`space-y-1 ${full ? "col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

/** Shared TDS section picker — used by Income and Business forms, and by FAB IncomeQuick. */
export function TDSSectionPicker({
  section, setSection, confirmed, setConfirmed,
}: {
  section: string;
  setSection: (v: string) => void;
  confirmed: boolean;
  setConfirmed: (v: boolean) => void;
}) {
  const [showQuick, setShowQuick] = useState(false);
  return (
    <div className="space-y-2">
      <Select
        value={section}
        onValueChange={(v) => {
          setSection(v);
          setConfirmed(true);
          setShowQuick(v === "NOT_SURE");
        }}
      >
        <SelectTrigger><SelectValue placeholder="TDS Section" /></SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Common</SelectLabel>
            {TDS_SECTIONS.filter((s) => s.code !== "NOT_SURE").map((s) => (
              <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Other</SelectLabel>
            <SelectItem value="NOT_SURE">Not Sure</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      {(showQuick || section === "NOT_SURE") && (
        <div className="rounded-md border border-dashed p-2 space-y-2 bg-muted/30">
          <p className="text-xs text-muted-foreground">What kind of income is this?</p>
          <div className="flex flex-wrap gap-1.5">
            {TDS_QUICK_OPTIONS.map((q) => (
              <button
                key={q.code}
                type="button"
                onClick={() => { setSection(q.code); setConfirmed(false); setShowQuick(false); }}
                className="px-2.5 py-1 rounded-full text-xs border hover:bg-accent"
              >
                {q.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowQuick(false)}
              className="px-2.5 py-1 rounded-full text-xs border hover:bg-accent text-muted-foreground"
            >
              Something else
            </button>
          </div>
        </div>
      )}
      {!confirmed && section && section !== "NOT_SURE" && (
        <p className="text-[11px] text-amber-500">● Auto-set via guided picker — verify before filing.</p>
      )}
    </div>
  );
}

const INCOME_LABELS = {
  date: "Date", member_id: "Member", income_type: "Income type",
  gross_amount: "Gross amount", tds: "TDS amount", net_amount: "Net amount",
  bank_account_id: "Account", tds_section: "TDS section", tds_rate: "TDS rate %",
  linked_investment_id: "Linked investment", notes: "Notes",
} as const;

export function AddIncomeButton({ defaultType, editing, trigger }: { defaultType?: string; editing?: IncomeRow; trigger?: ReactNode }) {
  const members = useMembers();
  const accts = useBankAccounts();
  const invs = useInvestments();
  const qc = useQueryClient();
  const isEdit = !!editing;
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(editing?.date ?? today());
  const [memberId, setMemberId] = useState<string>(editing?.member_id ?? "");
  const [incomeType, setIncomeType] = useState<string>(editing?.income_type ?? defaultType ?? "Salary");
  const [grossAmount, setGrossAmount] = useState<string>(String(editing?.gross_amount ?? editing?.amount ?? ""));
  const [tds, setTds] = useState<string>(String(editing?.tds ?? "0"));
  const [tdsTouched, setTdsTouched] = useState(false);
  const [tdsSection, setTdsSection] = useState<string>(editing?.tds_section ?? getTDSSection(editing?.income_type ?? defaultType ?? "Salary"));
  const [tdsConfirmed, setTdsConfirmed] = useState<boolean>(editing?.tds_section_confirmed ?? false);
  const [tdsRate, setTdsRate] = useState<string>(
    editing?.tds_rate != null ? String(editing.tds_rate) : String(getTDSSectionByCode(editing?.tds_section ?? getTDSSection(defaultType ?? "Salary"))?.rate ?? 0),
  );
  const [bankId, setBankId] = useState<string>(editing?.bank_account_id ?? "");
  const [linkedInv, setLinkedInv] = useState<string>(editing?.linked_investment_id ?? "");
  const [notes, setNotes] = useState<string>(editing?.notes ?? "");
  const [netManual, setNetManual] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // When income type changes (non-edit fresh entry): auto-set section + rate.
  useEffect(() => {
    if (isEdit) return;
    const code = getTDSSection(incomeType);
    setTdsSection(code);
    setTdsConfirmed(true);
    const s = getTDSSectionByCode(code);
    if (s) setTdsRate(String(s.rate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomeType]);

  // When TDS section changes, auto-fill rate (unless user typed something different)
  useEffect(() => {
    const s = getTDSSectionByCode(tdsSection);
    if (s) setTdsRate(String(s.rate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tdsSection]);

  // Auto compute TDS from gross × rate unless user has manually edited TDS
  useEffect(() => {
    if (tdsTouched) return;
    const g = Number(grossAmount) || 0;
    const r = Number(tdsRate) || 0;
    const calc = +(g * r / 100).toFixed(2);
    setTds(String(calc));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grossAmount, tdsRate]);

  const net = netManual !== ""
    ? Number(netManual)
    : Math.max(0, (Number(grossAmount) || 0) - (Number(tds) || 0));

  const showLinked = incomeType === "FD Maturity" || incomeType === "Investment Maturity";

  function reset() {
    setDate(today()); setMemberId(""); setGrossAmount(""); setTds("0"); setNotes("");
    setLinkedInv(""); setTdsTouched(false); setNetManual("");
  }

  function payload() {
    return {
      date,
      member_id: memberId || null,
      income_type: incomeType,
      gross_amount: Number(grossAmount) || 0,
      amount: Number(grossAmount) || 0, // keep legacy column in sync
      tds: Number(tds) || 0,
      tds_section: tdsSection || null,
      tds_rate: tdsRate ? Number(tdsRate) : null,
      tds_section_confirmed: tdsConfirmed,
      net_amount: net,
      bank_account_id: bankId,
      linked_investment_id: showLinked && linkedInv ? linkedInv : null,
      notes: notes || null,
    };
  }

  async function doInsert() {
    if (!grossAmount || !bankId) { toast.error("Amount and account are required"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    const { error } = await supabase.from("incomes").insert({ user_id: user.id, ...payload() });
    if (error) { toast.error(error.message); setBusy(false); return; }
    if (showLinked && linkedInv) {
      await supabase.from("investments").update({ status: "Matured", matured_date: today() }).eq("id", linkedInv);
      qc.invalidateQueries({ queryKey: ["investments"] });
    }
    qc.invalidateQueries({ queryKey: ["incomes"] });
    toast.success("Income added");
    setOpen(false); reset(); setBusy(false);
  }

  async function doUpdate() {
    setBusy(true);
    const { error } = await supabase.from("incomes").update(payload()).eq("id", editing.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["incomes"] });
    toast.success("Updated");
    setConfirmOpen(false); setOpen(false);
  }

  function onSave() {
    if (!isEdit) return doInsert();
    setConfirmOpen(true);
  }

  const changes = isEdit
    ? diffFields(
        {
          date: editing.date, member_id: editing.member_id, income_type: editing.income_type,
          gross_amount: Number(editing.gross_amount ?? editing.amount),
          tds: Number(editing.tds), net_amount: Number(editing.net_amount),
          bank_account_id: editing.bank_account_id, tds_section: editing.tds_section,
          tds_rate: editing.tds_rate, notes: editing.notes,
        },
        {
          date, member_id: memberId || null, income_type: incomeType,
          gross_amount: Number(grossAmount) || 0, tds: Number(tds) || 0, net_amount: net,
          bank_account_id: bankId, tds_section: tdsSection, tds_rate: tdsRate ? Number(tdsRate) : null, notes,
        },
        INCOME_LABELS,
      )
    : [];

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger ?? (
            isEdit ? (
              <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
            ) : (
              <Button><Plus className="h-4 w-4 mr-1" />Add income</Button>
            )
          )}
        </DialogTrigger>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Income" : "Add income"}</DialogTitle>
            <DialogDescription>Money received into a bank account.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Member">
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{(members.data ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Income type">
              <Select value={incomeType} onValueChange={setIncomeType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Gross amount (₹)">
              <Input type="number" value={grossAmount} onChange={(e) => setGrossAmount(e.target.value)} />
            </Field>
            <Field label="TDS Section" full>
              <TDSSectionPicker
                section={tdsSection}
                setSection={setTdsSection}
                confirmed={tdsConfirmed}
                setConfirmed={setTdsConfirmed}
              />
            </Field>
            <Field label="TDS Rate %">
              <Input type="number" step="0.01" value={tdsRate} onChange={(e) => { setTdsRate(e.target.value); setTdsTouched(false); }} />
            </Field>
            <Field label="TDS Amount (₹)">
              <Input type="number" value={tds} onChange={(e) => { setTds(e.target.value); setTdsTouched(true); }} />
            </Field>
            <Field label="Net received (₹)" full>
              <Input type="number" value={netManual !== "" ? netManual : net} onChange={(e) => setNetManual(e.target.value)} />
            </Field>
            <Field label="Received in" full>
              <Select value={bankId} onValueChange={setBankId}>
                <SelectTrigger><SelectValue placeholder="Bank account" /></SelectTrigger>
                <SelectContent>{(accts.data ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            {showLinked && (
              <Field label="Linked maturity (optional)" full>
                <Select value={linkedInv} onValueChange={setLinkedInv}>
                  <SelectTrigger><SelectValue placeholder="Pick the matured investment" /></SelectTrigger>
                  <SelectContent>
                    {(invs.data ?? []).filter((i) => i.status === "Active").map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.investment_type} · {i.institution ?? ""} · ₹{i.amount}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="Notes / Reference" full><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={onSave} disabled={busy}>{busy ? "Saving…" : (isEdit ? "Review changes" : "Confirm & save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {isEdit && (
        <ConfirmChangesDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          changes={changes}
          onConfirm={doUpdate}
          busy={busy}
        />
      )}
    </>
  );
}
