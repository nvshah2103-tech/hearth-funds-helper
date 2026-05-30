import { cn } from "@/lib/utils";

const MAP: Record<string, string> = {
  Active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Matured: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  Withdrawn: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  Pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Matched: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Review: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Unmatched: "bg-red-500/15 text-red-300 border-red-500/30",
  Confirmed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Draft: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const cls = MAP[status] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", cls, className)}>
      {status}
    </span>
  );
}

const CAT: Record<string, string> = {
  "Salary": "bg-emerald-500/15 text-emerald-300",
  "FD Maturity": "bg-sky-500/15 text-sky-300",
  "Investment": "bg-violet-500/15 text-violet-300",
  "CC Payment": "bg-red-500/15 text-red-300",
  "EMI": "bg-orange-500/15 text-orange-300",
  "Internal Transfer": "bg-slate-500/15 text-slate-300",
  "Business Income": "bg-teal-500/15 text-teal-300",
  "Dividend": "bg-cyan-500/15 text-cyan-300",
  "Broker Payout": "bg-slate-500/15 text-slate-300",
  "UPI": "bg-slate-500/15 text-slate-300",
  "ATM": "bg-slate-500/15 text-slate-300",
};

export function CategoryBadge({ category, className }: { category: string; className?: string }) {
  const cls = CAT[category] ?? "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", cls, className)}>
      {category}
    </span>
  );
}

const AVATAR_COLORS = [
  "bg-sky-500/20 text-sky-300",
  "bg-violet-500/20 text-violet-300",
  "bg-teal-500/20 text-teal-300",
  "bg-amber-500/20 text-amber-300",
  "bg-rose-500/20 text-rose-300",
  "bg-emerald-500/20 text-emerald-300",
];

const SIZES = { sm: "h-7 w-7 text-xs", md: "h-9 w-9 text-sm", lg: "h-12 w-12 text-base" };

export function MemberAvatar({
  name, index = 0, size = "md", className,
}: { name: string; index?: number; size?: "sm" | "md" | "lg"; className?: string }) {
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  return (
    <div className={cn("inline-flex items-center justify-center rounded-full font-semibold", SIZES[size], color, className)}>
      {initial}
    </div>
  );
}
