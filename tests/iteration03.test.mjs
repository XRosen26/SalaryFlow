import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Store } from "../core/store.mjs";
import { relocate, readLocation } from "../core/storage.mjs";
import { budgetColor } from "../core/presentation.mjs";
function setup(t) {
  const dir = fs.mkdtempSync(path.resolve(".local/check03-"));
  const s = new Store(path.join(dir, "ledger.sqlite"), () => "2026-09-20");
  t.after(() => s.close());
  s.command("initialize", {
    payday: 10,
    start_date: "2026-09-01",
    accounts: [
      { name: "现金", opening_minor: "10000", roles: ["SPENDING", "SALARY"] },
      { name: "存款", opening_minor: "0", roles: ["SAVINGS"] },
    ],
  });
  const d = s.snapshot();
  return {
    s,
    dir,
    a: d.accounts[0],
    b: d.accounts[1],
    cat: d.categories.find((c) => c.kind === "EXPENSE"),
    inc: d.categories.find((c) => c.kind === "INCOME"),
  };
}
test("默认拒绝余额不足、允许刚好用尽，失败无交易或审计残留", (t) => {
  const { s, a, b, cat } = setup(t);
  const count = s.one("SELECT COUNT(*) n FROM transactions").n;
  for (const kind of ["EXPENSE", "TRANSFER"])
    assert.throws(
      () =>
        s.command("record", {
          kind,
          date: "2026-09-20",
          source_id: a.id,
          destination_id: b.id,
          category_id: cat.id,
          amount_minor: "10001",
        }),
      /余额不足/,
    );
  assert.equal(s.one("SELECT COUNT(*) n FROM transactions").n, count);
  s.command("record", {
    kind: "TRANSFER",
    date: "2026-09-20",
    source_id: a.id,
    destination_id: b.id,
    amount_minor: "10000",
  });
  assert.equal(s.snapshot().totalAssets, "10000");
});
test("历史补录模式明确开启并持久化，不把负余额当收入", (t) => {
  const { s, a, cat } = setup(t);
  s.command("saveSettings", { allow_negative: true });
  s.command("record", {
    kind: "EXPENSE",
    date: "2026-09-20",
    source_id: a.id,
    category_id: cat.id,
    amount_minor: "15000",
  });
  assert.equal(s.snapshot().totalAssets, "-5000");
  assert.equal(s.snapshot().report.income, "0");
});
test("修改支出排除原金额，较晚收入不能覆盖早期资金不足", (t) => {
  const { s, a, cat, inc } = setup(t);
  const e = s.command("record", {
    kind: "EXPENSE",
    date: "2026-09-10",
    source_id: a.id,
    category_id: cat.id,
    amount_minor: "8000",
  });
  const old = s.tx(e.id);
  s.command("edit", { ...old, category_id: cat.id, amount_minor: "10000" });
  s.command("record", {
    kind: "INCOME",
    date: "2026-09-20",
    destination_id: a.id,
    category_id: inc.id,
    amount_minor: "10000",
  });
  assert.throws(
    () =>
      s.command("record", {
        kind: "EXPENSE",
        date: "2026-09-11",
        source_id: a.id,
        category_id: cat.id,
        amount_minor: "1",
      }),
    /余额不足/,
  );
});
test("自定义分类原子创建，理财收益不标工资且不重复建分类", (t) => {
  const { s, a } = setup(t);
  for (let i = 0; i < 2; i++)
    s.command("record", {
      kind: "INCOME",
      date: "2026-09-20",
      destination_id: a.id,
      category_id: "__investment",
      amount_minor: "123",
    });
  assert.equal(s.categories().filter((c) => c.name === "理财收益").length, 1);
  assert.equal(s.snapshot().report.income, "246");
  const n = s.categories().length;
  assert.throws(() =>
    s.command("record", {
      kind: "EXPENSE",
      date: "2026-09-20",
      source_id: a.id,
      category_id: "__custom",
      custom_category: "测试新分类",
      amount_minor: "999999",
    }),
  );
  assert.equal(s.categories().length, n);
  s.command("record", {
    kind: "EXPENSE",
    date: "2026-09-20",
    source_id: a.id,
    category_id: "__custom",
    custom_category: "宠物照护",
    amount_minor: "50",
  });
  assert(s.categories().some((c) => c.name === "宠物照护"));
});
test("待办可多个并行、支付进入历史，删除支付重新待办", (t) => {
  const { s, a, cat } = setup(t);
  for (const name of ["水费", "电费"])
    s.command("saveBill", {
      name,
      amount_minor: "100",
      account_id: a.id,
      category_id: cat.id,
      frequency: "MONTHLY",
      day: 20,
      start_date: "2026-09-20",
    });
  const before = s.snapshot();
  assert.equal(before.occurrences.length, 2);
  s.command("processBill", {
    id: before.occurrences[0].id,
    date: "2026-09-20",
    amount_minor: "100",
  });
  const after = s.snapshot();
  assert.equal(after.occurrenceHistory.length, 1);
  assert.equal(after.occurrences.length, 1);
  const tx = s.tx(after.occurrenceHistory[0].transaction_id);
  s.command("deleteTransaction", { id: tx.id, revision: tx.revision });
  assert.equal(s.snapshot().occurrences.length, 2);
});
test("待生效工资日可再次修改，当前边界更正保留交易", (t) => {
  const { s } = setup(t);
  const c = s.snapshot().cycle;
  s.command("adjustCycle", {
    id: c.id,
    start: c.start,
    end: "2026-10-12",
    reason: "更正",
  });
  assert.equal(s.snapshot().cycle.end, "2026-10-12");
  s.command("setPayday", { payday: 12 });
  s.command("setPayday", { payday: 15 });
  assert.equal(
    s.all("SELECT * FROM cycle_rules WHERE effective_from=?", "2026-10-12")
      .length,
    1,
  );
  assert.equal(
    s.one("SELECT payday FROM cycle_rules WHERE effective_from=?", "2026-10-12")
      .payday,
    15,
  );
});
test("分析前期等长比较与收入结构采用真实日期，不计转账", (t) => {
  const { s, a, b, inc } = setup(t);
  s.command("record", {
    kind: "INCOME",
    date: "2026-09-05",
    destination_id: a.id,
    category_id: inc.id,
    amount_minor: "1000",
  });
  s.command("record", {
    kind: "INCOME",
    date: "2026-09-15",
    destination_id: a.id,
    category_id: inc.id,
    amount_minor: "2000",
  });
  s.command("record", {
    kind: "TRANSFER",
    date: "2026-09-15",
    source_id: a.id,
    destination_id: b.id,
    amount_minor: "500",
  });
  const report = s.snapshot({
    analysis: true,
    start: "2026-09-11",
    end: "2026-09-21",
  }).report;
  assert.equal(report.previous.start, "2026-09-01");
  assert.equal(report.previous.income, "1000");
  assert.equal(report.income, "2000");
  assert.equal(report.incomeGroups[0].amount, "2000");
});
test("自定义目录迁移保留原库、验证新库，拒绝覆盖与不可用目录", async (t) => {
  const { s, dir } = setup(t);
  const parent = fs.mkdtempSync(path.resolve(".local/target03-")),
    config = fs.mkdtempSync(path.resolve(".local/config03-"));
  const result = await relocate(s, dir, parent, config);
  assert.equal(readLocation(config), result.directory);
  assert(fs.existsSync(path.join(dir, "ledger.sqlite")));
  const migrated = new Store(path.join(result.directory, "ledger.sqlite"));
  assert.equal(migrated.snapshot().totalAssets, s.snapshot().totalAssets);
  migrated.close();
  await assert.rejects(() => relocate(s, dir, parent, config), /已有账本/);
  await assert.rejects(() => relocate(s, dir, dir, config), /当前数据目录/);
});
test("预算耗尽正红，超支越多明度越低，零预算不产生NaN", () => {
  assert.equal(budgetColor("100", "100"), "hsl(0 85% 48%)");
  assert.equal(budgetColor("200", "100"), "hsl(0 85% 30%)");
  assert.equal(budgetColor("0", "100"), "hsl(130 65% 38%)");
  assert(!budgetColor("10", "0").includes("NaN"));
});
