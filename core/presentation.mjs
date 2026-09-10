// Presentation only: accounting continues to use integer cents.
export function budgetColor(used, total) {
  const amount = BigInt(total),
    actual = BigInt(used);
  if (amount <= 0n) return actual > 0n ? "hsl(0 85% 42%)" : "hsl(140 30% 38%)";
  const ratio = Number((actual * 10000n) / amount) / 10000;
  if (ratio >= 1) return `hsl(0 85% ${Math.max(25, 48 - (ratio - 1) * 18)}%)`;
  return `hsl(${Math.round(130 * (1 - Math.max(0, ratio)))} 65% 38%)`;
}
