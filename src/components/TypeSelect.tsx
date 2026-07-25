import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCustomTypes, type CustomTypeKind } from "@/lib/custom-types";
import { Plus } from "lucide-react";

/** Select whose list is [base defaults] + user's custom types, with inline "+ Add new". */
export function TypeSelect({
  value, onChange, base, kind, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  base: readonly string[] | string[];
  kind: CustomTypeKind;
  placeholder?: string;
}) {
  const custom = useCustomTypes(kind);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [newVal, setNewVal] = useState("");

  function commit() {
    const t = newVal.trim();
    if (!t) return;
    custom.add(t);
    onChange(t);
    setNewVal("");
    setDlgOpen(false);
  }

  return (
    <>
      <Select
        value={value}
        onValueChange={(v) => {
          if (v === "__new__") { setDlgOpen(true); return; }
          onChange(v);
        }}
      >
        <SelectTrigger><SelectValue placeholder={placeholder ?? "Select"} /></SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {base.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectGroup>
          {custom.list.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase tracking-wide">Your custom types</SelectLabel>
              {custom.list.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectGroup>
          )}
          <SelectItem value="__new__" className="text-primary font-medium">
            + Add new type…
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-4 w-4" />Add new type</DialogTitle>
            <DialogDescription>Saved for you — appears in this dropdown next time.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={newVal}
            onChange={(e) => setNewVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commit()}
            placeholder="e.g. Consultancy, Freelance Payout"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgOpen(false)}>Cancel</Button>
            <Button onClick={commit} disabled={!newVal.trim()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
