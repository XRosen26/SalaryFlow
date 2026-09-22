import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Store } from "../core/store.mjs";
import { parseMoney, rate, budgetState } from "../core/money.mjs";
import { cycleRange, timeRange } from "../core/dates.mjs";

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "salaryflow-test-"));
  const store = new Store(path.join(dir, "ledger.sqlite"), () => "2026-09-20");
  t.after(() => {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  store.command("initialize", {
    payday: 10,
    start_date: "2026-08-01",
    accounts: [
      { name: "工资", opening_minor: "0", roles: ["SALARY"] },
      { name: "消费", opening_minor: "70000", roles: ["SPENDING"] },
      { name: "储蓄", opening_minor: "300000", roles: ["SAVINGS"] },
    ],
  });
  const snap = store.snapshot(),
    [salary, spending, savings] = snap.accounts;
  const income = snap.categories.find((c) => c.name === "工资"),
    food = snap.categories.find((c) => c.name === "买菜");
  const record = (kind, amount, extras = {}) =>
    store.command("record", {
      kind,
      amount_minor: String(amount),
      date: "2026-09-15",
      ...(kind === "INCOME"
        ? { destination_id: salary.id, category_id: income.id }
        : { source_id: spending.id, category_id: food.id }),
      ...extras,
    });
  return { store, dir, salary, spending, savings, income, food, record };
}
test("金额严格精确，预算及储蓄率边界", () => {
  assert.equal(BigInt(parseMoney("0.10")) + BigInt(parseMoney("0.20")), 30n);
  assert.equal(parseMoney("1852.25"), "185225");
  for (const x of ["1.001", "1e4", "NaN", "-1", "0"])
    assert.throws(() => parseMoney(x));
  assert.equal(rate(2000n, 10000n), "20.0");
  assert.equal(rate(1n, 0n), null);
  assert.equal(budgetState(10001, 10000), "超出预算");
  assert.equal(budgetState(8000, 10000), "接近预算");
});
test("工资周期与全部滚动时间边界", () => {
  assert.deepEqual(cycleRange("2028-02-29", 31), {
    start: "2028-02-29",
    end: "2028-03-31",
  });
  assert.deepEqual(cycleRange("2026-09-09", 10), {
    start: "2026-08-10",
    end: "2026-09-10",
  });
  assert.equal(timeRange("days90", "2026-09-06").start, "2026-06-09");
  assert.equal(timeRange("months3", "2026-09-06").start, "2026-06-07");
  for (const mode of [
    "week",
    "month",
    "quarter",
    "year",
    "days7",
    "days30",
    "days90",
    "months3",
    "months6",
    "months12",
  ]) {
    const r = timeRange(mode, "2028-02-29");
    assert(r.start < r.end);
  }
  assert.throws(() =>
    timeRange("custom", "2026-09-06", {
      start: "2026-09-02",
      end: "2026-09-01",
    }),
  );
});
test("初始化模板9870元，重复初始化回滚", (t) => {
  const { store } = fixture(t);
  assert.equal(store.snapshot().totalBudget, "987000");
  assert.throws(() => store.command("initialize", {}));
  assert.equal(store.snapshot().accounts.length, 3);
});
test("工资与转账只统计一次，操作幂等", (t) => {
  const { store, salary, spending, income } = fixture(t);
  const p = {
    kind: "INCOME",
    salary: true,
    amount_minor: "1000000",
    destination_id: salary.id,
    category_id: income.id,
    date: "2026-09-10",
  };
  const first = store.command("record", p, "same-op");
  assert.deepEqual(store.command("record", p, "same-op"), first);
  store.command("record", {
    kind: "TRANSFER",
    amount_minor: "450000",
    source_id: salary.id,
    destination_id: spending.id,
    date: "2026-09-10",
  });
  const s = store.snapshot();
  assert.equal(s.cycleReport.income, "1000000");
  assert.equal(s.cycleReport.net, "0");
  assert.equal(s.totalAssets, "1370000");
  assert.equal(s.accounts.find((a) => a.id === spending.id).balance, "520000");
  assert.throws(() =>
    store.command("record", {
      kind: "TRANSFER",
      amount_minor: "1",
      source_id: salary.id,
      destination_id: salary.id,
      date: "2026-09-10",
    }),
  );
});
test("多次退款上限，不能删除有退款原支出，整组撤销", (t) => {
  const { store, record, spending } = fixture(t);
  const expense = record("EXPENSE", 10000);
  for (const amount of ["3000", "7000"])
    store.command("record", {
      kind: "REFUND",
      original_id: expense.id,
      amount_minor: amount,
      destination_id: spending.id,
      date: "2026-09-16",
    });
  assert.equal(store.snapshot().cycleReport.net, "0");
  assert.throws(() =>
    store.command("record", {
      kind: "REFUND",
      original_id: expense.id,
      amount_minor: "1",
      destination_id: spending.id,
      date: "2026-09-17",
    }),
  );
  assert.throws(() =>
    store.command("deleteTransaction", { id: expense.id, revision: 1 }),
  );
  store.command("deleteTransaction", {
    id: expense.id,
    revision: 1,
    with_refunds: true,
  });
  assert.equal(store.snapshot().cycleReport.net, "0");
  assert.equal(store.balances()[spending.id], 70000n);
});
test("历史修改跨周期和账户联动，版本冲突回滚", (t) => {
  const { store, record, spending, savings, food } = fixture(t);
  const x = record("EXPENSE", 10000, { date: "2026-09-09" });
  store.command("edit", {
    id: x.id,
    revision: 1,
    date: "2026-09-10",
    amount_minor: "12000",
    source_id: savings.id,
    category_id: food.id,
  });
  assert.equal(store.balances()[spending.id], 70000n);
  assert.equal(store.balances()[savings.id], 288000n);
  assert.equal(store.snapshot().cycleReport.net, "12000");
  assert.throws(() =>
    store.command("edit", {
      id: x.id,
      revision: 1,
      date: "2026-09-10",
      amount_minor: "100",
      source_id: savings.id,
      category_id: food.id,
    }),
  );
  assert.equal(store.history({ entity: "transaction", id: x.id }).length, 2);
});
test("三层预算互不回写，软删和恢复重算", (t) => {
  const { store, record } = fixture(t);
  let s = store.snapshot();
  const items = s.budget.items.map((x) => ({ ...x, amount_minor: "100" }));
  store.command("saveBudget", {
    cycle_id: s.cycle.id,
    expected_id: s.budget.id,
    items,
  });
  s = store.snapshot();
  assert.equal(s.totalBudget, "2000");
  assert.equal(
    s.defaultBudget.items.reduce((n, x) => n + BigInt(x.amount_minor), 0n),
    987000n,
  );
  const tx = record("EXPENSE", 100);
  store.command("deleteTransaction", { id: tx.id, revision: 1 });
  assert.equal(store.snapshot().cycleReport.net, "0");
  store.command("restoreTransaction", { id: tx.id, revision: 2 });
  assert.equal(store.snapshot().cycleReport.net, "100");
});
test("校准不计收支，先于期初交易拒绝", (t) => {
  const { store, spending, record } = fixture(t);
  store.command("calibrate", {
    account_id: spending.id,
    actual_minor: "69000",
    reason: "银行卡核对",
  });
  assert.equal(store.balances()[spending.id], 69000n);
  assert.equal(store.snapshot().cycleReport.net, "0");
  assert.throws(() => record("EXPENSE", 1, { date: "2026-07-31" }));
});
test("固定账单幂等实例和删除后回待确认", (t) => {
  const { store, spending, food } = fixture(t);
  store.command("saveBill", {
    name: "房租",
    amount_minor: "10000",
    account_id: spending.id,
    category_id: food.id,
    frequency: "MONTHLY",
    day: 15,
    start_date: "2026-09-01",
  });
  store.materializeBills();
  let b = store.snapshot().occurrences;
  assert.equal(b.length, 1);
  store.command("processBill", { id: b[0].id, date: "2026-09-15" });
  assert.equal(store.snapshot().occurrences.length, 0);
  const paid = store.one("SELECT * FROM bill_occurrences WHERE id=?", b[0].id);
  store.command("deleteTransaction", { id: paid.transaction_id, revision: 1 });
  assert.equal(store.snapshot().occurrences.length, 1);
});
test("导入原子性，外部键去重和回滚", (t) => {
  const { store, spending, food } = fixture(t);
  const row = {
    kind: "EXPENSE",
    amount_minor: "100",
    source_id: spending.id,
    category_id: food.id,
    date: "2026-09-15",
    external_id: "bank-1",
  };
  store.command("commitImport", { source: "bank", rows: [row] });
  store.command("commitImport", { source: "bank", rows: [row] });
  assert.equal(store.snapshot().cycleReport.net, "100");
  assert.throws(() =>
    store.command("commitImport", {
      rows: [
        { ...row, external_id: "new" },
        { ...row, amount_minor: "invalid" },
      ],
    }),
  );
  assert.equal(store.snapshot().cycleReport.net, "100");
});
test("真实SQLite快照备份、校验和、恢复保留历史", async (t) => {
  const { store, dir, record } = fixture(t);
  record("EXPENSE", 12345);
  const before = store.snapshot();
  const b = await store.createBackup(path.join(dir, "backup"));
  record("EXPENSE", 999);
  await store.restore(b.file);
  assert.equal(store.snapshot().cycleReport.net, before.cycleReport.net);
  assert.equal(store.snapshot().totalAssets, before.totalAssets);
  assert(fs.existsSync(b.file + ".json"));
});
test("结算锁和重新打开，旧快照保留", (t) => {
  const { store, record } = fixture(t);
  record("EXPENSE", 100, { date: "2026-09-09" });
  const c = store.one("SELECT * FROM cycles WHERE start='2026-08-10'");
  store.command("openCycle", { id: c.id, source: "blank" });
  store.command("settle", { id: c.id, note: "核对完毕" });
  assert.throws(() => record("EXPENSE", 100, { date: "2026-09-09" }));
  store.command("reopen", { id: c.id, reason: "补录遗漏" });
  record("EXPENSE", 100, { date: "2026-09-09" });
  assert.equal(
    store.one("SELECT dirty FROM settlements WHERE cycle_id=?", c.id).dirty,
    1,
  );
});

test("固定账单规则可删除且取消待办", (t) => {
  const { store, spending, food } = fixture(t);
  store.command("saveBill", {
    name: "会员",
    amount_minor: "1000",
    account_id: spending.id,
    category_id: food.id,
    frequency: "MONTHLY",
    day: 20,
    start_date: "2026-09-01",
  });
  const rule = store.snapshot().bills.find((b) => b.name === "会员");
  store.command("deleteBill", { id: rule.id, revision: rule.revision });
  assert.equal(
    store.snapshot().bills.some((b) => b.id === rule.id),
    false,
  );
  const stored = store.one(
    "SELECT deleted,enabled FROM bills WHERE id=?",
    rule.id,
  );
  assert.deepEqual(Object.assign({}, stored), { deleted: 1, enabled: 0 });
  assert.equal(
    store.one(
      "SELECT status FROM bill_occurrences WHERE bill_id=? ORDER BY due_date LIMIT 1",
      rule.id,
    ).status,
    "SKIPPED",
  );
});

test("未使用分类可删除，已有预算的分类只能归档", (t) => {
  const { store, food } = fixture(t);
  const unused = store.command("saveCategory", {
    kind: "EXPENSE",
    name: "临时分类",
    group: "其他",
  });
  const row = store.one("SELECT * FROM categories WHERE id=?", unused.id);
  store.command("deleteCategory", { id: unused.id, revision: row.revision });
  assert.equal(
    store.one("SELECT id FROM categories WHERE id=?", unused.id),
    undefined,
  );
  const budgetCategory = store.one(
    "SELECT * FROM categories WHERE id=?",
    food.id,
  );
  assert.throws(
    () =>
      store.command("deleteCategory", {
        id: food.id,
        revision: budgetCategory.revision,
      }),
    /不能彻底删除/,
  );
});

test("存钱计划可关联多个账户或手动维护，转账不重复累计进度", (t) => {
  const { store, salary, spending, savings } = fixture(t);
  const linked = store.command("saveSavingsPlan", {
    name: "应急金",
    target_minor: "1000000",
    mode: "ACCOUNTS",
    account_ids: [spending.id, savings.id],
    manual_minor: "0",
  });
  let plan = store.snapshot().savingsPlans.find((item) => item.id === linked.id);
  assert.equal(plan.current_minor, "370000");
  assert.equal(plan.remaining_minor, "630000");
  store.command("record", {
    kind: "TRANSFER",
    amount_minor: "10000",
    date: "2026-09-15",
    source_id: spending.id,
    destination_id: savings.id,
  });
  plan = store.snapshot().savingsPlans.find((item) => item.id === linked.id);
  assert.equal(plan.current_minor, "370000");
  const manual = store.command("saveSavingsPlan", {
    name: "旅行",
    target_minor: "500000",
    mode: "MANUAL",
    manual_minor: "120000",
    account_ids: [],
  });
  const manualPlan = store.snapshot().savingsPlans.find((item) => item.id === manual.id);
  assert.equal(manualPlan.current_minor, "120000");
  store.command("deleteSavingsPlan", { id: manual.id });
  assert.equal(store.snapshot().savingsPlans.some((item) => item.id === manual.id), false);
});

test("工资分配超支补齐方案只改变转账目标，不改预算统计", (t) => {
  const { store, salary, spending, savings, record } = fixture(t);
  record("INCOME", 1000000, { salary: true });
  const salaryTx = store.snapshot().salaryIncomes[0];
  const full = store.allocationQuote({
    salary_id: salaryTx.id,
    spending_id: spending.id,
    savings_id: savings.id,
    reserve_minor: "0",
    limit_mode: "SOURCE_BALANCE",
    topup_mode: "FULL",
  });
  assert.equal(full.topup_mode, "FULL");
  assert.equal(BigInt(full.topup) <= BigInt(full.available), true);
  const before = store.snapshot().totalBudget;
  const half = store.allocationQuote({
    ...full.input,
    topup_mode: "HALF",
  });
  assert.equal(half.topup_mode, "HALF");
  assert.equal(store.snapshot().totalBudget, before);
});
