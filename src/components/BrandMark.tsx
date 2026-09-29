import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-primary text-primary-foreground shadow-sm",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 36 36" className="h-full w-full" fill="none">
        <path d="M8 11.5 18 6l10 5.5v13L18 30 8 24.5v-13Z" fill="currentColor" opacity=".18" />
        <path d="M11 13.5h14M11 18h14M11 22.5h8" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
        <path d="M24.5 21v5M22 23.5h5" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
      </svg>
    </div>
  );
}