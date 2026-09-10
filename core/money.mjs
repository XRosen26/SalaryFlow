export const MAX_MONEY = 9_000_000_000_000n;
export function minor(value, { signed = false, zero = false } = {}) {
  const s = String(value ?? "").trim();
  if (!(signed ? /^-?\d+$/ : /^\d+$/).test(s))
    throw new Error("金额必须是整数分");
  const n = BigInt(s);
  if (
    (!zero && n === 0n) ||
    (!signed && n < 0n) ||
    n > MAX_MONEY ||
    n < -MAX_MONEY
  )
    throw new Error("金额超出允许范围");
  return n;
}
export function parseMoney(value, options = {}) {
  const s = String(value ?? "").trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(s))
    throw new Error("请输入最多两位小数的金额");
  const negative = s.startsWith("-");
  const [whole, fraction = ""] = (negative ? s.slice(1) : s).split(".");
  return minor(
    (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"))) *
      (negative ? -1n : 1n),
    options,
  ).toString();
}
export function decimal(value) {
  const n = BigInt(value ?? 0),
    a = n < 0n ? -n : n;
  return `${n < 0n ? "-" : ""}${a / 100n}.${String(a % 100n).padStart(2, "0")}`;
}
export function rate(numerator, denominator) {
  const n = BigInt(numerator),
    d = BigInt(denominator);
  if (d <= 0n) return null;
  const sign = n < 0n ? "-" : "",
    a = n < 0n ? -n : n;
  const rounded = (a * 1000n + d / 2n) / d;
  return `${sign}${rounded / 10n}.${rounded % 10n}`;
}
export function budgetState(actual, budget) {
  const a = BigInt(actual),
    b = BigInt(budget);
  if (a < 0n) return "退款净额";
  if (b === 0n) return a ? "未设预算支出" : "未设预算";
  if (a > b) return "超出预算";
  if (a === b) return "预算已用完";
  return a * 100n >= b * 80n ? "接近预算" : "正常";
}
