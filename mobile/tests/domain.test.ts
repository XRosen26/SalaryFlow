import assert from "node:assert/strict";
import test from "node:test";

import {
  budgetPeriodRange,
  cycleRange,
  normalizeDateInput,
  validDate,
} from "../src/domain/dates";
import { budgetTone, parseMoneyExpression } from "../src/domain/money";

test("金额算式保持精确并只在最后舍入到分", () => {
  assert.equal(parseMoneyExpression("12.5+8+6*2"), 3250n);
  assert.equal(parseMoneyExpression("10/3"), 333n);
  assert.equal(parseMoneyExpression("(10+2)*3"), 3600n);
});

test("金额算式拒绝除零、负结果和任意代码", () => {
  assert.throws(() => parseMoneyExpression("1/0"), /除数不能为零/);
  assert.throws(() => parseMoneyExpression("1-2"), /金额超出允许范围/);
  assert.throws(() => parseMoneyExpression("process.exit()"), /只能包含/);
});

test("日期输入支持常见中文、分隔符和紧凑格式", () => {
  assert.equal(normalizeDateInput("2026年9月13日"), "2026-09-13");
  assert.equal(normalizeDateInput("2026-9-3"), "2026-09-03");
  assert.equal(normalizeDateInput("2026/09/13"), "2026-09-13");
  assert.equal(normalizeDateInput("20260913"), "2026-09-13");
  assert.throws(() => normalizeDateInput("2026-02-30"), /日期无效/);
  assert.throws(() => normalizeDateInput("09-13-2026"), /日期支持/);
  assert.equal(validDate("2026-09-13"), "2026-09-13");
  assert.throws(() => validDate("2026年9月13日"), /日期格式无效/);
});

test("工资日位于短月时使用当月最后一天", () => {
  assert.deepEqual(cycleRange("2026-02-28", 31), {
    start: "2026-02-28",
    end: "2026-03-31",
  });
  assert.deepEqual(cycleRange("2026-02-27", 31), {
    start: "2026-01-31",
    end: "2026-02-28",
  });
});

test("自然月和工资周期使用半开区间", () => {
  assert.deepEqual(budgetPeriodRange("2026-09-12", "CALENDAR_MONTH", 10), {
    start: "2026-09-01",
    end: "2026-10-01",
  });
  assert.deepEqual(budgetPeriodRange("2026-09-12", "SALARY", 10), {
    start: "2026-09-10",
    end: "2026-10-10",
  });
});

test("预算颜色从正常到深度超支分级且带文字", () => {
  assert.equal(budgetTone(20, 100).label, "正常");
  assert.equal(budgetTone(90, 100).label, "留意");
  assert.equal(budgetTone(99, 100).label, "接近预算");
  assert.equal(budgetTone(100, 100).label, "预算已用完");
  assert.equal(budgetTone(130, 100).label, "超支");
  assert.notEqual(budgetTone(105, 100).color, budgetTone(130, 100).color);
});

test("工资分配允许零值保留金额，不在页面初次渲染时抛错", () => {
  assert.equal(parseMoneyExpression("0", { zero: true }), 0n);
  assert.throws(() => parseMoneyExpression("0"), /金额超出允许范围/);
});
