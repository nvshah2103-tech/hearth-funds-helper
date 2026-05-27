export function inr(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
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

/** Indian financial year for a given date (April–March). Returns { start, end, label }. */
export function fyFor(d: Date = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth(); // 0=Jan
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
