import assert from "node:assert/strict";
import test from "node:test";

import { calendarPeriodOptions } from "../core/dates.mjs";
import { spendablePresentation } from "../core/presentation.mjs";

test("安心支出状态同时受预算余额和消费账户覆盖约束", () => {
  assert.equal(spendablePresentation(800000n, 1000000n, 1000000n).key, "SAFE");
  assert.equal(spendablePresentation(800000n, 1000000n, 0n).key, "NO_FUNDS");
  assert.equal(spendablePresentation(800000n, 1000000n, 200000n).key, "LOW");
  assert.equal(spendablePresentation(400000n, 1000000n, 1000000n).key, "WATCH");
  assert.equal(spendablePresentation(100000n, 1000000n, 1000000n).key, "LIMIT");
  assert.equal(
    spendablePresentation(-10000n, 1000000n, 1000000n).key,
    "OVER_BUDGET",
  );
});

test("快捷日历周期从当前周期倒序列到首次记账周期", () => {
  const weeks = calendarPeriodOptions("week", "2025-12-28", "2026-09-15");
  assert.equal(weeks[0].label, "本周");
  assert.equal(weeks[1].label, "上周");
  assert.ok(weeks.at(-1).start <= "2025-12-28");
  assert.ok(weeks.at(-1).end > "2025-12-28");

  const months = calendarPeriodOptions("month", "2026-05-21", "2026-09-15");
  assert.deepEqual(
    months.map((item) => item.label),
    ["本月", "上月", "2026年7月", "2026年6月", "2026年5月"],
  );
  assert.equal(months.at(-1).start, "2026-05-01");

  const years = calendarPeriodOptions("year", "2024-08-09", "2026-09-15");
  assert.deepEqual(
    years.map((item) => item.label),
    ["今年", "去年", "2024年"],
  );
});
