export function date(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("日期格式应为 YYYY-MM-DD");
  const d = new Date(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(d.getTime()) ||
    d.toISOString().slice(0, 10) !== value ||
    value < "1900-01-01" ||
    value > "2199-12-31"
  )
    throw new Error("日期无效（支持1900—2199年）");
  return value;
}
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function addDays(s, n) {
  const d = new Date(`${date(s)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function monthDay(y, m, day) {
  return new Date(
    Date.UTC(y, m, Math.min(day, new Date(Date.UTC(y, m + 1, 0)).getUTCDate())),
  )
    .toISOString()
    .slice(0, 10);
}
export function shiftMonths(s, n) {
  const d = new Date(`${date(s)}T00:00:00Z`);
  return monthDay(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate());
}
export function cycleRange(s, payday) {
  date(s);
  if (!Number.isInteger(payday) || payday < 1 || payday > 31)
    throw new Error("工资日应为1—31");
  const d = new Date(`${s}T00:00:00Z`),
    y = d.getUTCFullYear(),
    m = d.getUTCMonth(),
    anchor = monthDay(y, m, payday);
  return s >= anchor
    ? { start: anchor, end: monthDay(y, m + 1, payday) }
    : { start: monthDay(y, m - 1, payday), end: anchor };
}
export function budgetPeriodRange(s, basis = "SALARY", payday = 10) {
  date(s);
  if (basis === "SALARY") return cycleRange(s, payday);
  if (basis === "CALENDAR_MONTH") {
    const d = new Date(s + "T00:00:00Z"),
      y = d.getUTCFullYear(),
      m = d.getUTCMonth();
    return { start: monthDay(y, m, 1), end: monthDay(y, m + 1, 1) };
  }
  throw new Error("预算周期口径无效");
}
export function timeRange(mode, anchor = today(), custom = {}) {
  date(anchor);
  const d = new Date(`${anchor}T00:00:00Z`),
    y = d.getUTCFullYear(),
    m = d.getUTCMonth();
  if (mode === "custom") {
    const start = date(custom.start),
      end = addDays(date(custom.end), 1);
    if (start >= end) throw new Error("开始日期不能晚于结束日期");
    return { start, end };
  }
  if (mode === "week") {
    const start = addDays(anchor, -((d.getUTCDay() + 6) % 7));
    return { start, end: addDays(start, 7) };
  }
  if (mode === "month")
    return { start: monthDay(y, m, 1), end: monthDay(y, m + 1, 1) };
  if (mode === "quarter")
    return {
      start: monthDay(y, Math.floor(m / 3) * 3, 1),
      end: monthDay(y, Math.floor(m / 3) * 3 + 3, 1),
    };
  if (mode === "year")
    return { start: monthDay(y, 0, 1), end: monthDay(y + 1, 0, 1) };
  if (mode === "today") return { start: anchor, end: addDays(anchor, 1) };
  if (/^days(3|7|30|90)$/.test(mode))
    return {
      start: addDays(anchor, 1 - Number(mode.slice(4))),
      end: addDays(anchor, 1),
    };
  if (/^months(3|6|12)$/.test(mode))
    return {
      start: shiftMonths(addDays(anchor, 1), -Number(mode.slice(6))),
      end: addDays(anchor, 1),
    };
  throw new Error("未知时间范围");
}
