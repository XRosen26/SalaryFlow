const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validDate(value: string) {
  if (!DATE_PATTERN.test(value)) throw new Error('日期格式应为 YYYY-MM-DD');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || value < '1900-01-01' || value > '2199-12-31') {
    throw new Error('日期无效（支持 1900—2199 年）');
  }
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
  return new Date(Date.UTC(year, month, Math.min(day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate()))).toISOString().slice(0, 10);
}

export function cycleRange(value: string, payday: number) {
  validDate(value);
  if (!Number.isInteger(payday) || payday < 1 || payday > 31) throw new Error('工资日应为 1—31');
  const date = new Date(`${value}T00:00:00Z`);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const anchor = monthDay(year, month, payday);
  return value >= anchor
    ? { start: anchor, end: monthDay(year, month + 1, payday) }
    : { start: monthDay(year, month - 1, payday), end: anchor };
}

export function budgetPeriodRange(value: string, basis: 'SALARY' | 'CALENDAR_MONTH', payday: number) {
  if (basis === 'SALARY') return cycleRange(value, payday);
  validDate(value);
  const date = new Date(`${value}T00:00:00Z`);
  return { start: monthDay(date.getUTCFullYear(), date.getUTCMonth(), 1), end: monthDay(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) };
}
