import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { Store } from "../core/store.mjs";
import { schema } from "../core/schema.mjs";
import { currentSchema } from "../core/migrations.mjs";
import { resetLedgerFiles } from "../core/storage.mjs";
import { parseCSV, previewCSV, exportCSV } from "../core/csv.mjs";
function setup(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "salaryflow-check-"));
  const s = new Store(path.join(dir, "ledger.sqlite"), () => "2026-09-20");
  t.after(() => {
    s.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  s.command("initialize", {
    payday: 10,
    start_date: "2026-01-01",
    accounts: [
      { name: "源", opening_minor: "1000000", roles: ["SALARY"] },
      { name: "消费", opening_minor: "70000", roles: ["SPENDING"] },
      { name: "储蓄", opening_minor: "0", roles: ["SAVINGS"] },
    ],
  });
  const d = s.snapshot(),
    [source, spending, savings] = d.accounts,
    expense = d.categories.find((c) => c.kind === "EXPENSE"),
    income = d.categories.find((c) => c.name === "工资");
  const tx = (kind, amount, extra = {}) =>
    s.command("record", {
      kind,
      amount_minor: String(amount),
      date: "2026-09-15",
      ...(kind === "INCOME"
        ? { destination_id: source.id, category_id: income.id }
        : { source_id: spending.id, category_id: expense.id }),
      ...extra,
    });
  return { s, dir, source, spending, savings, expense, income, tx };
}
test("跨期退款只冲减到账期，原期成本保留", (t) => {
  const { s, spending, tx } = setup(t);
  const p = tx("EXPENSE", 10000, { date: "2026-09-09" });
  s.command("record", {
    kind: "REFUND",
    original_id: p.id,
    date: "2026-09-10",
    amount_minor: "3000",
    destination_id: spending.id,
  });
  assert.equal(s.report("2026-08-10", "2026-09-10").net, "10000");
  assert.equal(s.report("2026-09-10", "2026-10-10").net, "-3000");
  assert.equal(s.snapshot().cycleReport.rate, null);
});
test("原交易金额改小受退款约束，失败原子回滚", (t) => {
  const { s, spending, expense, tx } = setup(t);
  const e = tx("EXPENSE", 10000);
  s.command("record", {
    kind: "REFUND",
    original_id: e.id,
    date: "2026-09-16",
    amount_minor: "6000",
    destination_id: spending.id,
  });
  assert.throws(() =>
    s.command("edit", {
      id: e.id,
      revision: 1,
      date: "2026-09-15",
      amount_minor: "5000",
      source_id: spending.id,
      category_id: expense.id,
    }),
  );
  assert.equal(s.tx(e.id).amount_minor, 10000);
  assert.equal(s.tx(e.id).revision, 1);
});
test("退款恢复不绕过原交易软删除", (t) => {
  const { s, spending, tx } = setup(t);
  const e = tx("EXPENSE", 10000);
  const r = s.command("record", {
    kind: "REFUND",
    original_id: e.id,
    date: "2026-09-16",
    amount_minor: "6000",
    destination_id: spending.id,
  });
  s.command("deleteTransaction", { id: e.id, revision: 1, with_refunds: true });
  assert.throws(() =>
    s.command("restoreTransaction", { id: r.id, revision: 2 }),
  );
  s.command("restoreTransaction", { id: e.id, revision: 2 });
  s.command("restoreTransaction", { id: r.id, revision: 2 });
  assert.equal(s.snapshot().cycleReport.net, "4000");
});
test("分类版本不改变历史名称和分组，预算按稳定ID聚合", (t) => {
  const { s, expense, tx } = setup(t);
  tx("EXPENSE", 1000);
  s.command("saveCategory", {
    id: expense.id,
    revision: 1,
    name: "新名称",
    group: "新分组",
  });
  tx("EXPENSE", 2000);
  const r = s.snapshot();
  assert.equal(r.report.groups.length, 2);
  assert(r.report.groups.some((g) => g.name === expense.name));
  assert(r.report.groups.some((g) => g.name === "新名称"));
  assert.equal(
    r.budgetRows.find((b) => b.category_id === expense.id).actual,
    "3000",
  );
});
test("预算调整默认同步与下期复制，已存在周期不回写", (t) => {
  const { s } = setup(t);
  let d = s.snapshot();
  s.ensureCycle("2026-10-10");
  const oldFuture = s.latestBudget("CYCLE", s.ensureCycle("2026-10-10").id);
  s.command("saveBudget", {
    cycle_id: d.cycle.id,
    expected_id: d.budget.id,
    items: [{ ...d.budget.items[0], amount_minor: "185225" }],
    update_default: true,
  });
  assert.equal(s.latestBudget("DEFAULT").items[0].amount_minor, "185225");
  assert.equal(s.latestBudget("CYCLE", oldFuture.cycle_id).items.length, 20);
  assert.equal(
    s.latestBudget("CYCLE", s.ensureCycle("2026-11-10").id).items[0]
      .amount_minor,
    "185225",
  );
});
test("工资分配补足、幂等确认与累计上限", (t) => {
  const { s, source, spending, savings, tx } = setup(t);
  const salary = tx("INCOME", 1000000, { salary: true });
  const d = s.snapshot();
  s.command("saveBudget", {
    cycle_id: d.cycle.id,
    expected_id: d.budget.id,
    items: [{ ...d.budget.items[0], amount_minor: "520000" }],
  });
  const input = {
    salary_id: salary.id,
    spending_id: spending.id,
    savings_id: savings.id,
    reserve_minor: "0",
    cap_minor: "1000000",
  };
  const q = s.allocationQuote(input);
  assert.equal(q.topup, "450000");
  assert.equal(q.saving, "550000");
  const p = s.command("saveAllocation", {
    ...input,
    expected_revision: q.revision,
  });
  const items = s.all("SELECT * FROM allocation_items WHERE plan_id=?", p.id);
  for (const item of items)
    s.command(
      "confirmAllocation",
      { id: item.id, date: "2026-09-16" },
      item.id,
    );
  assert.equal(s.snapshot().cycleReport.income, "1000000");
  assert.equal(s.snapshot().cycleReport.net, "0");
  assert.equal(s.allocationQuote(input).items.length, 0);
  assert.throws(() =>
    s.command("confirmAllocation", { id: items[0].id, date: "2026-09-16" }),
  );
  assert(s.balances()[source.id] >= 0n);
});
test("工资源与消费账户相同，无自转账并保留预算", (t) => {
  const { s, source, savings, tx } = setup(t);
  const salary = tx("INCOME", 1000000, { salary: true });
  const d = s.snapshot();
  s.command("saveBudget", {
    cycle_id: d.cycle.id,
    expected_id: d.budget.id,
    items: [{ ...d.budget.items[0], amount_minor: "520000" }],
  });
  const q = s.allocationQuote({
    salary_id: salary.id,
    spending_id: source.id,
    savings_id: savings.id,
  });
  assert.equal(q.topup, "0");
  assert(q.items.every((i) => i.source_id !== i.destination_id));
  assert(BigInt(q.saving) <= 1000000n);
});
test("账户归档、隐藏、角色变化不改变总资产", (t) => {
  const { s, spending, source } = setup(t);
  const before = s.snapshot().totalAssets;
  s.command("saveAccount", {
    ...spending,
    roles: ["SALARY", "SPENDING"],
    hidden: true,
    type_id: spending.type_id,
  });
  s.command("setDefaults", { SALARY: spending.id, SPENDING: spending.id });
  s.command("archiveAccount", { id: source.id, revision: source.revision });
  assert.equal(s.snapshot().totalAssets, before);
  assert.equal(s.settings().defaults.SALARY, spending.id);
  assert.throws(() =>
    s.command("record", {
      kind: "TRANSFER",
      amount_minor: "100",
      date: "2026-09-20",
      source_id: source.id,
      destination_id: spending.id,
    }),
  );
});
test("校准固定差额，回填历史后继续改变账面余额", (t) => {
  const { s, spending, tx } = setup(t);
  s.command("calibrate", {
    account_id: spending.id,
    actual_minor: "69500",
    reason: "实账核对",
  });
  tx("EXPENSE", 300, { date: "2026-09-14" });
  assert.equal(s.balances()[spending.id], 69200n);
  assert.equal(
    s.one("SELECT amount_minor FROM transactions WHERE kind='ADJUSTMENT'")
      .amount_minor,
    -500,
  );
});
test("下一期工资日过渡短周期连续", (t) => {
  const { s } = setup(t);
  s.command("setPayday", { payday: 15 });
  const c = s.ensureCycle("2026-10-10"),
    next = s.ensureCycle("2026-10-15");
  assert.equal(c.start, "2026-10-10");
  assert.equal(c.end, "2026-10-15");
  assert.equal(next.start, c.end);
  assert.equal(next.end, "2026-11-15");
});
test("固定账单延期不记支出", (t) => {
  const { s, spending, expense } = setup(t);
  s.command("saveBill", {
    name: "订阅",
    amount_minor: "2000",
    account_id: spending.id,
    category_id: expense.id,
    frequency: "MONTHLY",
    day: 10,
    start_date: "2026-09-01",
  });
  const b = s.snapshot().occurrences[0];
  s.command("snoozeBill", { id: b.id, date: "2026-09-30" });
  assert.equal(s.snapshot().occurrences[0].snoozed_to, "2026-09-30");
  assert.equal(s.snapshot().report.net, "0");
});
test("导出重新导入不会复制原账本交易；同额真实支出仍可保留", (t) => {
  const { s, tx } = setup(t);
  tx("EXPENSE", 1000);
  const exported = exportCSV(s, "2026-09-10", "2026-10-10");
  const preview = previewCSV(s, exported);
  s.command("commitImport", { source: "CSV", rows: preview.rows });
  assert.equal(s.snapshot().report.net, "1000");
  s.command("commitImport", {
    source: "CSV",
    rows: preview.rows.map((r) => ({
      ...r,
      external_id: "different-real-payment",
    })),
  });
  assert.equal(s.snapshot().report.net, "2000");
});
test("CSV引号、换行、BOM和公式保护", (t) => {
  assert.deepEqual(parseCSV('\uFEFFa,b\r\n"x,y","z""q"\r\n'), [
    ["a", "b"],
    ["x,y", 'z"q'],
  ]);
  assert.throws(() => parseCSV('a,b\n"bad'));
  const { s, tx } = setup(t);
  tx("EXPENSE", 100, { note: '=HYPERLINK("file")' });
  assert(exportCSV(s, "2026-09-01", "2026-10-01").includes("'=HYPERLINK"));
});
test("旧版本数据库自动备份后升级，金额与审计保真", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "salaryflow-v1-"));
  const file = path.join(dir, "ledger.sqlite");
  const old = new DatabaseSync(file);
  old.exec(schema);
  old
    .prepare("INSERT INTO settings VALUES(1,?,0)")
    .run(JSON.stringify({ initialized: false, payday: 10, defaults: {} }));
  old
    .prepare("INSERT INTO schema_migrations VALUES(1,?,?)")
    .run(
      createHash("sha256").update(schema).digest("hex"),
      new Date().toISOString(),
    );
  old.exec("PRAGMA user_version=1");
  old.close();
  const s = new Store(file);
  t.after(() => {
    s.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  assert.equal(s.one("PRAGMA user_version").user_version, currentSchema);
  assert.equal(s.all("SELECT * FROM schema_migrations").length, currentSchema);
  assert(
    fs
      .readdirSync(path.join(dir, "backups"))
      .some((f) => f.endsWith(".sqlite")),
  );
  s.close();
  s.open();
  assert.equal(s.all("SELECT * FROM schema_migrations").length, currentSchema);
});
test("未来schema拒绝写入，损坏快照拒绝恢复", async (t) => {
  const { s, dir } = setup(t);
  const file = path.join(dir, "future.sqlite");
  fs.writeFileSync(path.join(dir, "broken.sqlite"), "not sqlite");
  const future = new DatabaseSync(file);
  future.exec("PRAGMA user_version=999");
  future.close();
  assert.throws(() => Store.verifyFile(file));
  await assert.rejects(s.restore(path.join(dir, "broken.sqlite")));
  assert(s.snapshot().settings.initialized);
});
test("恢复中断保留原库，重启恢复可读状态", (t) => {
  const { s, dir, tx } = setup(t);
  tx("EXPENSE", 2300);
  s.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  s.close();
  const file = path.join(dir, "ledger.sqlite");
  fs.renameSync(file, file + ".restore-old");
  fs.writeFileSync(file, "incomplete replacement");
  fs.writeFileSync(file + ".restore-state.json", "{}");
  s.recoverInterrupted();
  s.open();
  assert.equal(s.snapshot().report.net, "2300");
});
test("随机交易序列余额守恒，转账不改变净结余", (t) => {
  const { s, source, spending, tx } = setup(t);
  let state = 12345,
    net = 0n;
  for (let i = 0; i < 120; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const n = BigInt((state % 900) + 1);
    if (i % 3 === 0) {
      tx("INCOME", n);
      net += n;
    } else if (i % 3 === 1) {
      tx("EXPENSE", n);
      net -= n;
    } else
      s.command("record", {
        kind: "TRANSFER",
        source_id: source.id,
        destination_id: spending.id,
        amount_minor: String(n),
        date: "2026-09-15",
      });
  }
  const snap = s.snapshot();
  assert.equal(BigInt(snap.totalAssets), 1070000n + net);
  assert.equal(BigInt(snap.report.saving), net);
});

test("工资日可立即生效或在7天后开始新规则", (t) => {
  const immediate = setup(t).s;
  const before = immediate.snapshot().cycle;
  immediate.command("setPayday", { payday: 25, mode: "IMMEDIATE" });
  const now = immediate.snapshot().cycle;
  assert.equal(now.id, before.id);
  assert.equal(now.end, "2026-09-25");
  assert.equal(
    immediate.one(
      "SELECT payday FROM cycle_rules WHERE effective_from='2026-09-20'",
    ).payday,
    25,
  );
  assert.equal(immediate.ensureCycle("2026-09-25").start, "2026-09-25");

  const nextWeek = setup(t).s;
  nextWeek.command("setPayday", { payday: 15, mode: "NEXT_WEEK" });
  assert.equal(nextWeek.snapshot().cycle.end, "2026-09-27");
  const following = nextWeek.ensureCycle("2026-09-27");
  assert.equal(following.start, "2026-09-27");
  assert.equal(following.end, "2026-10-15");
});

test("清空账本文件可选择删除应用备份且保留其他文件", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "salaryflow-reset-"));
  const backups = path.join(dir, "backups");
  fs.mkdirSync(backups);
  for (const file of [
    path.join(dir, "ledger.sqlite"),
    path.join(dir, "ledger.sqlite-wal"),
    path.join(dir, "backup-status.json"),
    path.join(backups, "SalaryFlow-test-manual-a.sqlite"),
    path.join(backups, "SalaryFlow-test-manual-a.sqlite.json"),
    path.join(backups, "notes.txt"),
  ])
    fs.writeFileSync(file, "test");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const result = resetLedgerFiles(dir, backups, true);
  assert.equal(result.removed, 5);
  assert.equal(fs.existsSync(path.join(dir, "ledger.sqlite")), false);
  assert.equal(
    fs.existsSync(path.join(backups, "SalaryFlow-test-manual-a.sqlite")),
    false,
  );
  assert.equal(fs.existsSync(path.join(backups, "notes.txt")), true);
});
