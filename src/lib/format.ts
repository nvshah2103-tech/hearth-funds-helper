export function inr(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/** Compact INR for charts: ₹1.2L / ₹45K / ₹3.4Cr */
export function inrCompact(n: number | null | undefined): string {
  const v = Math.abs(Number(n ?? 0));
  const sign = (n ?? 0) < 0 ? "-" : "";
  if (v >= 1e7) return `${sign}₹${(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `${sign}₹${(v / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `${sign}₹${(v / 1e3).toFixed(0)}K`;
  return `${sign}₹${v.toFixed(0)}`;
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "—";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${dt.getFullYear()}`;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function fyFor(d: Date = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth();
  const startYear = m >= 3 ? y : y - 1;
  return {
    start: `${startYear}-04-01`,
    end: `${startYear + 1}-03-31`,
    label: `FY ${startYear}-${String(startYear + 1).slice(2)}`,
    startYear,
  };
}

export function fyList(yearsBack = 5) {
  const cur = fyFor().startYear;
  return Array.from({ length: yearsBack + 1 }, (_, i) => {
    const sy = cur - i;
    return {
      start: `${sy}-04-01`,
      end: `${sy + 1}-03-31`,
      label: `FY ${sy}-${String(sy + 1).slice(2)}`,
      startYear: sy,
    };
  });
}

export function monthLabel(d: string | Date): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString("en-IN", { month: "short", year: "numeric" });
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
