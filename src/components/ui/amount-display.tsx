import { cn } from "@/lib/utils";
import { inr } from "@/lib/format";

export type AmountType = "credit" | "debit" | "investment" | "tds" | "neutral";

const COLOR: Record<AmountType, string> = {
  credit: "text-[var(--color-success)]",
  debit: "text-[var(--color-destructive)]",
  investment: "text-[var(--color-investment)]",
  tds: "text-[var(--color-tds)]",
  neutral: "text-foreground",
};

export function AmountDisplay({
  amount, type = "neutral", className,
}: { amount: number | null | undefined; type?: AmountType; className?: string }) {
  return <span className={cn("font-mono tabular-nums", COLOR[type], className)}>{inr(amount)}</span>;
}
