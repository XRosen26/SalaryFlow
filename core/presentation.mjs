// Presentation only: accounting continues to use integer cents.
export function budgetColor(used, total) {
  const amount = BigInt(total),
    actual = BigInt(used);
  if (amount <= 0n) return actual > 0n ? "hsl(0 85% 42%)" : "hsl(140 30% 38%)";
  const ratio = Number((actual * 10000n) / amount) / 10000;
  if (ratio >= 1) return `hsl(0 85% ${Math.max(25, 48 - (ratio - 1) * 18)}%)`;
  return `hsl(${Math.round(130 * (1 - Math.max(0, ratio)))} 65% 38%)`;
}

export function spendablePresentation(
  remaining,
  total,
  spendingBalance,
  hasSpendingAccount = true,
) {
  const budget = BigInt(total);
  const left = BigInt(remaining);
  const cash = BigInt(spendingBalance);
  if (budget <= 0n)
    return {
      key: "NO_BUDGET",
      label: "尚未设置预算",
      ratio: 0,
      color: "hsl(140 18% 38%)",
    };
  if (left < 0n) {
    const overspent = Number((-left * 10000n) / budget) / 10000;
    return {
      key: "OVER_BUDGET",
      label: "本期预算已超支",
      ratio: 0,
      color: `hsl(0 85% ${Math.max(25, 44 - overspent * 18)}%)`,
    };
  }
  if (left === 0n)
    return {
      key: "BUDGET_USED",
      label: "本期预算已用完",
      ratio: 0,
      color: "hsl(0 78% 43%)",
    };
  if (!hasSpendingAccount)
    return {
      key: "NO_ACCOUNT",
      label: "请设置主要消费账户",
      ratio: 0,
      color: "hsl(24 72% 40%)",
    };
  if (cash <= 0n)
    return {
      key: "NO_FUNDS",
      label: "主要消费账户余额不足",
      ratio: 0,
      color: "hsl(0 75% 40%)",
    };

  const budgetLeft = left < budget ? left : budget;
  const covered = cash < left ? cash : left;
  const budgetRatio = Number((budgetLeft * 10000n) / budget) / 10000;
  const coverageRatio = Number((covered * 10000n) / left) / 10000;
  const ratio = Math.max(0, Math.min(1, budgetRatio, coverageRatio));
  const color = `hsl(${Math.round(130 * ratio)} 65% 36%)`;
  if (ratio >= 0.5)
    return { key: "SAFE", label: "当前可安心支出", ratio, color };
  if (ratio >= 0.3)
    return { key: "WATCH", label: "留意支出节奏", ratio, color };
  if (ratio >= 0.15) return { key: "LOW", label: "可用空间不多", ratio, color };
  return { key: "LIMIT", label: "快到支出上限", ratio, color };
}
// The master switch must allow amounts before a local card/account switch can
// reveal them. Existing ledgers used hide_amounts, so keep that as the fallback.
export function amountVisible(settings, scope = "global", key = "") {
  const visibility = settings?.amount_visibility;
  const master =
    typeof visibility?.master === "boolean"
      ? visibility.master
      : !settings?.hide_amounts;
  if (!master) return false;
  if (scope === "overview") return visibility?.overview?.[key] !== false;
  if (scope === "account") return visibility?.accounts?.[key] !== false;
  if (scope === "accountSummary") return visibility?.account_summary !== false;
  return true;
}
