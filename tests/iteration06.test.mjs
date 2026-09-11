import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Store } from "../core/store.mjs";
import { amountVisible } from "../core/presentation.mjs";
import { budgetPeriodRange } from "../core/dates.mjs";

function ledger(t, clock = "2026-09-20", basis = "SALARY") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "salaryflow-v06-"));
  const store = new Store(path.join(dir, "ledger.sqlite"), () => clock);
  t.after(() => {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  store.command("initialize", {
    basis,
    payday: 10,
    start_date: "2026-08-01",
    accounts: [
      { name: "工资卡", opening_minor: "0", roles: ["SALARY"] },
      { name: "日常消费", opening_minor: "70000", roles: ["SPENDING"] },
      { name: "长期储蓄", opening_minor: "0", roles: ["SAVINGS"] },
      {
        name: "理财账户",
        type_name: "投资/理财",
        opening_minor: "0",
        roles: ["SAVINGS"],
        valuation_mode: true,
      },
    ],
  });
  const snap = store.snapshot();
  return {
    store,
    salary: snap.accounts.find((a) => a.name === "工资卡"),
    spending: snap.accounts.find((a) => a.name === "日常消费"),
    savings: snap.accounts.find((a) => a.name === "长期储蓄"),
    investment: snap.accounts.find((a) => a.name === "理财账户"),
    income: snap.categories.find((c) => c.name === "工资"),
  };
}

test("账户页总资产金额同时受全局与独立开关控制", () => {
  assert.equal(
    amountVisible(
      { amount_visibility: { master: true, account_summary: true } },
      "accountSummary",
    ),
    true,
  );
  assert.equal(
    amountVisible(
      { amount_visibility: { master: true, account_summary: false } },
      "accountSummary",
    ),
    false,
  );
  assert.equal(
    amountVisible(
      { amount_visibility: { master: false, account_summary: true } },
      "accountSummary",
    ),
    false,
  );
});

test("预算口径支持自然月以及立即、下周期和指定日期生效", (t) => {
  assert.deepEqual(budgetPeriodRange("2026-09-20", "CALENDAR_MONTH", 1), {
    start: "2026-09-01",
    end: "2026-10-01",
  });
  const immediate = ledger(t).store;
  immediate.command("setPayday", {
    basis: "CALENDAR_MONTH",
    mode: "IMMEDIATE",
  });
  assert.equal(immediate.snapshot().cycle.end, "2026-10-01");
  assert.equal(immediate.ensureCycle("2026-10-01").end, "2026-11-01");

  const next = ledger(t).store;
  next.command("setPayday", {
    basis: "CALENDAR_MONTH",
    mode: "NEXT_CYCLE",
  });
  assert.equal(next.snapshot().cycle.end, "2026-10-10");
  const transition = next.ensureCycle("2026-10-10");
  assert.equal(transition.start, "2026-10-10");
  assert.equal(transition.end, "2026-11-01");

  const custom = ledger(t).store;
  custom.command("setPayday", {
    basis: "CALENDAR_MONTH",
    mode: "CUSTOM",
    effective_from: "2026-09-25",
  });
  assert.equal(custom.snapshot().cycle.end, "2026-09-25");
  assert.equal(custom.ensureCycle("2026-09-25").end, "2026-10-01");
});

test("理财估值替代估值日及此前流水，之后转账继续叠加且不计收支", (t) => {
  const { store, salary, investment } = ledger(t);
  store.command("record", {
    kind: "INCOME",
    amount_minor: "100000",
    date: "2026-09-17",
    destination_id: salary.id,
    category_id: store.snapshot().categories.find((c) => c.name === "工资").id,
  });
  store.command("record", {
    kind: "TRANSFER",
    amount_minor: "20000",
    date: "2026-09-17",
    source_id: salary.id,
    destination_id: investment.id,
  });
  store.command("saveValuation", {
    account_id: investment.id,
    date: "2026-09-18",
    value_minor: "500000",
    note: "收盘市值",
  });
  const assetsBeforeSameDayTransfer = store.snapshot().totalAssets;
  store.command("record", {
    kind: "TRANSFER",
    amount_minor: "5000",
    date: "2026-09-18",
    source_id: salary.id,
    destination_id: investment.id,
  });
  assert.equal(store.snapshot().totalAssets, assetsBeforeSameDayTransfer);
  store.command("record", {
    kind: "TRANSFER",
    amount_minor: "10000",
    date: "2026-09-19",
    source_id: salary.id,
    destination_id: investment.id,
  });
  assert.equal(store.balances()[investment.id], 515000n);
  const before = store.snapshot().cycleReport;
  store.command("saveValuation", {
    account_id: investment.id,
    date: "2026-09-18",
    value_minor: "600000",
    note: "修正市值",
  });
  assert.equal(store.balances()[investment.id], 610000n);
  assert.equal(store.all("SELECT * FROM account_valuations").length, 1);
  assert.deepEqual(store.snapshot().cycleReport, before);
  assert.throws(() =>
    store.command("saveAccount", {
      ...investment,
      valuation_mode: true,
      roles: ["SALARY"],
      type_id: investment.type_id,
    }),
  );
});

test("工资分配展示完整依据，批量确认只记转账，取消后可删除计划", (t) => {
  const { store, salary, spending, savings, income } = ledger(t);
  const wage = store.command("record", {
    kind: "INCOME",
    salary: true,
    amount_minor: "1000000",
    date: "2026-09-20",
    destination_id: salary.id,
    category_id: income.id,
  });
  let snap = store.snapshot();
  store.command("saveBudget", {
    cycle_id: snap.cycle.id,
    expected_id: snap.budget.id,
    items: [{ ...snap.budget.items[0], amount_minor: "520000" }],
  });
  const input = {
    salary_id: wage.id,
    spending_id: spending.id,
    savings_id: savings.id,
    reserve_minor: "0",
    limit_mode: "SOURCE_BALANCE",
  };
  const quote = store.allocationQuote(input);
  assert.equal(quote.total_budget, "520000");
  assert.equal(quote.spending_balance, "70000");
  assert.equal(quote.needed, "450000");
  assert.equal(quote.topup, "450000");
  assert.equal(quote.saving, "550000");
  const plan = store.command("saveAllocation", {
    ...input,
    expected_revision: quote.revision,
  });
  store.command("confirmAllocationPlan", {
    id: plan.id,
    date: "2026-09-20",
  });
  snap = store.snapshot();
  assert.equal(snap.plans[0].status, "COMPLETED");
  assert.equal(snap.cycleReport.income, "1000000");
  assert.equal(snap.cycleReport.net, "0");

  const secondWage = store.command("record", {
    kind: "INCOME",
    salary: true,
    amount_minor: "100000",
    date: "2026-09-20",
    destination_id: salary.id,
    category_id: income.id,
  });
  const secondInput = {
    salary_id: secondWage.id,
    spending_id: spending.id,
    savings_id: savings.id,
    reserve_minor: "0",
    limit_mode: "SOURCE_BALANCE",
  };
  const secondQuote = store.allocationQuote(secondInput);
  const secondPlan = store.command("saveAllocation", {
    ...secondInput,
    expected_revision: secondQuote.revision,
  });
  store.command("cancelAllocation", { id: secondPlan.id });
  store.command("deleteAllocation", { id: secondPlan.id });
  assert.equal(
    store.snapshot().plans.some((item) => item.id === secondPlan.id),
    false,
  );
});

test("可安心支出取剩余预算和主要消费账户余额的较小非负值", (t) => {
  const { store } = ledger(t);
  const snap = store.snapshot();
  assert.equal(snap.spendingBalance, "70000");
  assert.equal(snap.spendableNow, "70000");
  assert(BigInt(snap.remainingBudget) > BigInt(snap.spendableNow));
});