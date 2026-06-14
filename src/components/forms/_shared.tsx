import { useState, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export type FieldChange = { field: string; from: unknown; to: unknown };

export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  labels: Partial<Record<keyof T, string>> = {},
): FieldChange[] {
  const out: FieldChange[] = [];
  for (const k of Object.keys(after) as (keyof T)[]) {
    const b = before[k];
    const a = after[k];
    const bn = b === undefined || b === null || b === "" ? null : b;
    const an = a === undefined || a === null || a === "" ? null : a;
    if (JSON.stringify(bn) !== JSON.stringify(an)) {
      out.push({ field: (labels[k] as string) ?? String(k), from: bn ?? "—", to: an ?? "—" });
    }
  }
  return out;
}

export function ConfirmChangesDialog({
  open, onOpenChange, changes, onConfirm, busy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  changes: FieldChange[];
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Changes</DialogTitle>
          <DialogDescription>Review what's changing before saving.</DialogDescription>
        </DialogHeader>
        {changes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No changes detected.</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto py-2">
            {changes.map((c, i) => (
              <div key={i} className="text-sm border-b pb-2">
                <div className="font-medium">{c.field}</div>
                <div className="font-mono text-xs">
                  <span className="text-muted-foreground line-through">{String(c.from)}</span>
                  <span className="mx-2">→</span>
                  <span className="text-success">{String(c.to)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onConfirm} disabled={busy || changes.length === 0}>
            {busy ? "Saving…" : "Confirm & Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDeleteRow({
  table, id, amount, label, onDeleted, trigger,
}: {
  table: string;
  id: string;
  amount: number | string;
  label?: string;
  onDeleted: () => void;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const target = String(Math.round(Number(amount)));
  const canDelete = typed.trim() === target;

  async function go() {
    setBusy(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from as any)(table).delete().eq("id", id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    setOpen(false);
    setTyped("");
    onDeleted();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setTyped(""); }}>
      <div onClick={(e) => { e.stopPropagation(); setOpen(true); }} className="inline-flex">
        {trigger ?? (
          <Button variant="ghost" size="icon" type="button">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete {label ?? "record"}?</DialogTitle>
          <DialogDescription>
            This cannot be undone. Type <span className="font-mono font-semibold">{target}</span> to confirm.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={`Type ${target}`}
          inputMode="numeric"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={go} disabled={!canDelete || busy}>
            {busy ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
