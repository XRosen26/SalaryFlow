import { addDays, date } from "./dates.mjs";
export function trendData(days, start, end, today, unit = "auto") {
  date(start);
  date(end);
  date(today);
  const cap = end < addDays(today, 1) ? end : addDays(today, 1);
  if (start >= cap) return { rows: [], unit: "day", end: cap };
  const count = Math.round((new Date(cap) - new Date(start)) / 86400000);
  const mode =
    unit === "auto"
      ? count > 180
        ? "month"
        : count > 62
          ? "week"
          : "day"
      : unit;
  const byDate = new Map(days.map((d) => [d.date, d])),
    groups = new Map();
  let i = 0;
  for (let d = start; d < cap; d = addDays(d, 1), i++) {
    const key =
      mode === "month"
        ? d.slice(0, 7)
        : mode === "week"
          ? String(Math.floor(i / 7))
          : d;
    if (!groups.has(key))
      groups.set(key, { date: d, end: d, income: 0n, expense: 0n });
    const g = groups.get(key),
      v = byDate.get(d);
    g.end = d;
    g.income += BigInt(v?.income || 0);
    g.expense += BigInt(v?.expense || 0);
  }
  return { rows: [...groups.values()], unit: mode, end: cap };
}
export function pieData(rows, limit = 7) {
  const positive = rows
    .filter((r) => BigInt(r.amount) > 0n)
    .sort((a, b) =>
      BigInt(a.amount) > BigInt(b.amount)
        ? -1
        : BigInt(a.amount) < BigInt(b.amount)
          ? 1
          : 0,
    );
  const total = positive.reduce((n, r) => n + BigInt(r.amount), 0n);
  const result = positive.slice(0, limit);
  if (positive.length > limit)
    result.push({
      id: "__rest",
      name: null,
      amount: String(
        positive.slice(limit).reduce((n, r) => n + BigInt(r.amount), 0n),
      ),
    });
  return {
    total,
    rows: result.map((r) => ({
      ...r,
      percent: total ? Number((BigInt(r.amount) * 10000n) / total) / 100 : 0,
      share: total
        ? Number((BigInt(r.amount) * 1000000000n) / total) / 1000000000
        : 0,
    })),
  };
}
