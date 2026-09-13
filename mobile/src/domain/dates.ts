const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeDateInput(value: string) {
  const compact = value.trim().replace(/\s+/g, "");
  let year: number;
  let month: number;
  let day: number;

  if (/^\d{8}$/.test(compact)) {
    year = Number(compact.slice(0, 4));
    month = Number(compact.slice(4, 6));
    day = Number(compact.slice(6, 8));
  } else {
    const separated = compact
      .replace(/年/g, "-")
      .replace(/月/g, "-")
      .replace(/日/g, "")
      .replace(/[/.]/g, "-");
    const matched = separated.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!matched)
      throw new Error(
        "日期支持 2026-09-13、2026年9月13日、2026/9/13 或 20260913",
      );
    year = Number(matched[1]);
    month = Number(matched[2]);
    day = Number(matched[3]);
  }

  const normalized = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${normalized}T00:00:00Z`);
  if (
    year < 1900 ||
    year > 2199 ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== normalized
  )
    throw new Error("日期无效（支持 1900—2199 年）");
  return normalized;
}

export function validDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) throw new Error("日期格式无效");
  const normalized = normalizeDateInput(value);
  if (normalized !== value) throw new Error("日期格式无效");
  return value;
}

export function today() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function addDays(value: string, amount: number) {
  const date = new Date(`${validDate(value)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function monthDay(year: number, month: number, day: number) {
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate()),
    ),
  )
    .toISOString()
    .slice(0, 10);
}

export function cycleRange(value: string, payday: number) {
  const normalized = validDate(value);
  if (!Number.isInteger(payday) || payday < 1 || payday > 31)
    throw new Error("工资日应为 1—31");
  const date = new Date(`${normalized}T00:00:00Z`);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const anchor = monthDay(year, month, payday);
  return normalized >= anchor
    ? { start: anchor, end: monthDay(year, month + 1, payday) }
    : { start: monthDay(year, month - 1, payday), end: anchor };
}

export function budgetPeriodRange(
  value: string,
  basis: "SALARY" | "CALENDAR_MONTH",
  payday: number,
) {
  if (basis === "SALARY") return cycleRange(value, payday);
  const normalized = validDate(value);
  const date = new Date(`${normalized}T00:00:00Z`);
  return {
    start: monthDay(date.getUTCFullYear(), date.getUTCMonth(), 1),
    end: monthDay(date.getUTCFullYear(), date.getUTCMonth() + 1, 1),
  };
}
