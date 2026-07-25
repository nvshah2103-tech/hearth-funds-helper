import { useMemo } from "react";
import { inr } from "@/lib/format";

/** GitHub-style 365-day calendar heatmap of net-surplus per day.
 *  data: { date: YYYY-MM-DD, value: number } — value = income − expense */
export function CalendarHeatmap({
  data, monthsBack = 12,
}: {
  data: { date: string; value: number }[];
  monthsBack?: number;
}) {
  const { grid, months, maxAbs } = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setMonth(start.getMonth() - monthsBack);
    // snap start to Sunday
    start.setDate(start.getDate() - start.getDay());

    const map = new Map<string, number>();
    for (const d of data) map.set(d.date, (map.get(d.date) ?? 0) + d.value);

    const days: { date: Date; value: number }[] = [];
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      days.push({ date: new Date(d), value: map.get(key) ?? 0 });
    }

    const weeks: typeof days[] = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

    const months: { label: string; weekIndex: number }[] = [];
    let prevMonth = -1;
    weeks.forEach((w, i) => {
      const m = w[0].date.getMonth();
      if (m !== prevMonth) {
        months.push({ label: w[0].date.toLocaleString("en-IN", { month: "short" }), weekIndex: i });
        prevMonth = m;
      }
    });

    const maxAbs = Math.max(1, ...days.map((d) => Math.abs(d.value)));
    return { grid: weeks, months, maxAbs };
  }, [data, monthsBack]);

  const cell = 12;
  const gap = 3;
  const width = grid.length * (cell + gap) + 30;
  const height = 7 * (cell + gap) + 24;

  function color(v: number) {
    if (v === 0) return "hsl(var(--muted) / 0.4)";
    const t = Math.min(1, Math.abs(v) / maxAbs);
    if (v > 0) {
      // green scale
      const l = 90 - 45 * t;
      return `hsl(150 60% ${l}%)`;
    }
    // red scale
    const l = 90 - 45 * t;
    return `hsl(0 70% ${l}%)`;
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} className="text-muted-foreground">
        {months.map((m) => (
          <text
            key={m.weekIndex}
            x={30 + m.weekIndex * (cell + gap)}
            y={10}
            fontSize={9}
            fill="currentColor"
          >
            {m.label}
          </text>
        ))}
        {["Mon", "Wed", "Fri"].map((d, i) => (
          <text key={d} x={0} y={24 + (i * 2 + 1) * (cell + gap)} fontSize={9} fill="currentColor">
            {d}
          </text>
        ))}
        {grid.map((week, wi) =>
          week.map((day, di) => (
            <rect
              key={`${wi}-${di}`}
              x={30 + wi * (cell + gap)}
              y={16 + di * (cell + gap)}
              width={cell}
              height={cell}
              rx={2}
              fill={color(day.value)}
            >
              <title>
                {day.date.toDateString()} · {day.value > 0 ? "Net +" : day.value < 0 ? "Net −" : ""}
                {day.value !== 0 ? inr(Math.abs(day.value)) : "No activity"}
              </title>
            </rect>
          )),
        )}
      </svg>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-2">
        <span>Less</span>
        <div className="flex gap-0.5">
          {[0.15, 0.35, 0.6, 0.9].map((t) => (
            <span key={t} className="w-3 h-3 rounded-sm" style={{ background: `hsl(150 60% ${90 - 45 * t}%)` }} />
          ))}
        </div>
        <span>Surplus</span>
        <div className="flex gap-0.5 ml-3">
          {[0.15, 0.35, 0.6, 0.9].map((t) => (
            <span key={t} className="w-3 h-3 rounded-sm" style={{ background: `hsl(0 70% ${90 - 45 * t}%)` }} />
          ))}
        </div>
        <span>Deficit</span>
      </div>
    </div>
  );
}
