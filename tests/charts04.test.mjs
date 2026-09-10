import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { trendData, pieData } from "../core/charts.mjs";
import { Store } from "../core/store.mjs";
test("截图场景：30天工资周期只显示已发生2天，保留逐日金额", () => {
  const c = trendData(
    [
      { date: "2026-09-06", income: "190029656", expense: "43164206" },
      { date: "2026-09-07", income: "0", expense: "1500000" },
    ],
    "2026-09-06",
    "2026-10-06",
    "2026-09-07",
  );
  assert.equal(c.rows.length, 2);
  assert.equal(c.unit, "day");
  assert.equal(c.rows[0].income, 190029656n);
  assert.equal(c.rows[1].expense, 1500000n);
});
test("历史范围保留无交易日，长范围聚合守恒，退款负值保留", () => {
  const days = [
    { date: "2026-01-02", income: "101", expense: "-102" },
    { date: "2026-07-03", income: "203", expense: "404" },
  ];
  for (const unit of ["auto", "day", "week", "month"]) {
    const c = trendData(days, "2026-01-01", "2026-08-01", "2026-09-07", unit);
    assert.equal(
      c.rows.reduce((n, r) => n + r.income, 0n),
      304n,
    );
    assert.equal(
      c.rows.reduce((n, r) => n + r.expense, 0n),
      302n,
    );
  }
  assert.deepEqual(
    trendData([], "2026-10-01", "2026-11-01", "2026-09-07").rows,
    [],
  );
});
test("饼图仅正数入图，其他合并保留合计和精确分值", () => {
  const c = pieData(
    [
      { id: "a", name: "a", amount: "10001" },
      { id: "b", name: "b", amount: "200" },
      { id: "c", name: "c", amount: "-20" },
      { id: "d", name: "d", amount: "30" },
    ],
    2,
  );
  assert.equal(c.total, 10231n);
  assert.equal(c.rows.length, 3);
  assert.equal(c.rows[2].amount, "30");
  assert.equal(
    c.rows.reduce((n, r) => n + BigInt(r.amount), 0n),
    c.total,
  );
  assert.equal(pieData([{ amount: "0" }, { amount: "-10" }]).total, 0n);
});
test("五种新增配色持久化、独立于明暗模式、不改变财务数据", (t) => {
  const dir = fs.mkdtempSync(path.resolve(".local/palette04-"));
  const s = new Store(path.join(dir, "ledger.sqlite"));
  t.after(() => s.close());
  s.command("initialize", {
    payday: 10,
    start_date: s.clock(),
    accounts: [
      { name: "测试卡", opening_minor: "123456", roles: ["SPENDING"] },
    ],
  });
  for (const palette of ["ocean", "violet", "amber", "rose", "slate"]) {
    s.command("saveSettings", { palette });
    s.command("saveSettings", { theme: "dark" });
    assert.equal(s.settings().palette, palette);
    assert.equal(s.snapshot().totalAssets, "123456");
  }
  assert.throws(
    () => s.command("saveSettings", { palette: "invalid" }),
    /配色/,
  );
  const other = new Store(path.join(dir, "ledger.sqlite"));
  assert.equal(other.settings().palette, "slate");
  other.close();
});
