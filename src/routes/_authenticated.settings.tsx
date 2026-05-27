import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useMembers, useBankAccounts, useCreditCards } from "@/lib/data-hooks";
import { inr } from "@/lib/format";
import { Field } from "@/components/forms/IncomeForm";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

function SettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Edit your family setup. Changes are saved instantly.</p>
      </div>
      <MembersSection />
      <AccountsSection />
      <CardsSection />
    </div>
  );
}

function MembersSection() {
  const m = useMembers(); const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [biz, setBiz] = useState(false);
  async function add() {
    const { data: { user } } = await supabase.auth.getUser(); if (!user || !name) return;
    const { error } = await supabase.from("members").insert({ user_id: user.id, name, is_business: biz });
    if (error) toast.error(error.message); else { toast.success("Added"); qc.invalidateQueries({ queryKey: ["members"] }); setOpen(false); setName(""); setBiz(false); }
  }
  async function del(id: string) {
    if (!confirm("Delete this member?")) return;
    const { error } = await supabase.from("members").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["members"] }); }
  }
  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <div><CardTitle>Family members</CardTitle><CardDescription>Used in dropdowns across the app.</CardDescription></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add member</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={biz} onCheckedChange={(v) => setBiz(!!v)} />Has business income</label>
            </div>
            <DialogFooter><Button onClick={add}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Business</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {(m.data ?? []).map((x) => (
              <TableRow key={x.id}><TableCell>{x.name}</TableCell><TableCell>{x.is_business ? "Yes" : "—"}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => del(x.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AccountsSection() {
  const a = useBankAccounts(); const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", bank: "", type: "Savings", opening: "0" });
  async function add() {
    const { data: { user } } = await supabase.auth.getUser(); if (!user || !f.name) return;
    const { error } = await supabase.from("bank_accounts").insert({
      user_id: user.id, name: f.name, bank_name: f.bank || null, account_type: f.type, opening_balance: Number(f.opening) || 0,
    });
    if (error) toast.error(error.message); else { toast.success("Added"); qc.invalidateQueries({ queryKey: ["bank_accounts"] }); setOpen(false); setF({ name: "", bank: "", type: "Savings", opening: "0" }); }
  }
  async function updOpening(id: string, val: string) {
    const { error } = await supabase.from("bank_accounts").update({ opening_balance: Number(val) || 0 }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["bank_accounts"] }); }
  }
  async function del(id: string) {
    if (!confirm("Delete account? Linked records will also be removed.")) return;
    const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["bank_accounts"] }); }
  }
  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <div><CardTitle>Bank accounts</CardTitle><CardDescription>Edit opening balances anytime.</CardDescription></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add account</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Label" full><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
              <Field label="Bank"><Input value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} /></Field>
              <Field label="Type">
                <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Savings">Savings</SelectItem><SelectItem value="Current">Current</SelectItem><SelectItem value="Joint">Joint</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Opening (₹)" full><Input type="number" value={f.opening} onChange={(e) => setF({ ...f, opening: e.target.value })} /></Field>
            </div>
            <DialogFooter><Button onClick={add}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Bank</TableHead><TableHead>Type</TableHead><TableHead>Opening</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {(a.data ?? []).map((x) => (
              <TableRow key={x.id}>
                <TableCell>{x.name}</TableCell><TableCell>{x.bank_name ?? "—"}</TableCell><TableCell>{x.account_type}</TableCell>
                <TableCell><Input type="number" defaultValue={x.opening_balance} className="w-32" onBlur={(e) => { if (Number(e.target.value) !== Number(x.opening_balance)) updOpening(x.id, e.target.value); }} /></TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => del(x.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground mt-2">Total opening: <span className="font-mono">{inr((a.data ?? []).reduce((s, x) => s + Number(x.opening_balance), 0))}</span></p>
      </CardContent>
    </Card>
  );
}

function CardsSection() {
  const c = useCreditCards(); const m = useMembers(); const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", bank: "", member: "" });
  async function add() {
    const { data: { user } } = await supabase.auth.getUser(); if (!user || !f.name) return;
    const { error } = await supabase.from("credit_cards").insert({
      user_id: user.id, name: f.name, bank_name: f.bank || null, member_id: f.member || null,
    });
    if (error) toast.error(error.message); else { toast.success("Added"); qc.invalidateQueries({ queryKey: ["credit_cards"] }); setOpen(false); setF({ name: "", bank: "", member: "" }); }
  }
  async function del(id: string) {
    if (!confirm("Delete card?")) return;
    const { error } = await supabase.from("credit_cards").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["credit_cards"] }); }
  }
  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <div><CardTitle>Credit cards</CardTitle></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add card</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Label" full><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
              <Field label="Issuing bank" full><Input value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} /></Field>
              <Field label="Owner" full>
                <Select value={f.member} onValueChange={(v) => setF({ ...f, member: v })}>
                  <SelectTrigger><SelectValue placeholder="Member" /></SelectTrigger>
                  <SelectContent>{(m.data ?? []).map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <DialogFooter><Button onClick={add}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Card</TableHead><TableHead>Bank</TableHead><TableHead>Owner</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {(c.data ?? []).map((x) => (
              <TableRow key={x.id}><TableCell>{x.name}</TableCell><TableCell>{x.bank_name ?? "—"}</TableCell><TableCell>{m.data?.find((y) => y.id === x.member_id)?.name ?? "—"}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => del(x.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
