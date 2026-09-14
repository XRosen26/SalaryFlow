import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Store } from "../core/store.mjs";
import { timeRange } from "../core/dates.mjs";

function fixture(t) {
  const dir = path.resolve(".local", "test-receivables-" + Date.now() + "-" + Math.random().toString(16).slice(2));
  fs.mkdirSync(dir, { recursive: true });
  const store = new Store(path.join(dir, "ledger.sqlite"), () => "2026-09-14");
  t.after(() => { store.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  store.command("initialize", {
    payday: 10,
    start_date: "2026-09-01",
    accounts: [{ name: "日常消费", opening_minor: "100000", roles: ["SPENDING"] }],
  });
  return { store, account: store.snapshot().accounts[0] };
}

test("待收款借出与分次归还只改变账户和待收余额，不进入收支预算", (t) => {
  const { store, account } = fixture(t);
  store.command("createReceivable", {
    person: "小林", amount_minor: "30000", source_account_id: account.id,
    default_return_account_id: account.id, lent_date: "2026-09-12", due_date: "2026-09-13", note: "临时周转",
  });
  let snap = store.snapshot({ start: "2026-09-01", end: "2026-10-01" });
  assert.equal(snap.accounts[0].balance, "70000");
  assert.equal(snap.report.income, "0");
  assert.equal(snap.report.expense, "0");
  assert.equal(snap.report.net, "0");
  assert.equal(snap.receivableSummary.outstanding, "30000");
  assert.equal(snap.receivableSummary.overdue, 1);
  assert.equal(snap.receivables[0].outstanding_minor, "30000");

  store.command("repayReceivable", {
    id: snap.receivables[0].id, revision: snap.receivables[0].revision,
    amount_minor: "10000", destination_account_id: account.id, date: "2026-09-14",
  });
  snap = store.snapshot({ start: "2026-09-01", end: "2026-10-01" });
  assert.equal(snap.accounts[0].balance, "80000");
  assert.equal(snap.report.income, "0");
  assert.equal(snap.report.expense, "0");
  assert.equal(snap.receivables[0].outstanding_minor, "20000");
  assert.equal(snap.receivables[0].repayments.length, 1);

  const filtered = store.snapshot({
    start: "2026-09-01", end: "2026-10-01", min_amount: "15000", max_amount: "35000",
  });
  assert.equal(filtered.transactions.length, 1);
  assert.equal(filtered.transactions[0].amount_minor, "-30000");
});

test("待收款拒绝余额不足、超额归还和错误日期，失败保持原子性", (t) => {
  const { store, account } = fixture(t);
  assert.throws(() => store.command("createReceivable", {
    person: "甲", amount_minor: "100001", source_account_id: account.id, lent_date: "2026-09-14",
  }), /余额不足/);
  assert.equal(store.snapshot().receivables.length, 0);
  store.command("createReceivable", {
    person: "乙", amount_minor: "5000", source_account_id: account.id, lent_date: "2026-09-10",
  });
  const row = store.snapshot().receivables[0];
  assert.throws(() => store.command("repayReceivable", {
    id: row.id, revision: row.revision, amount_minor: "5001",
    destination_account_id: account.id, date: "2026-09-14",
  }), /不能超过/);
  assert.equal(store.snapshot().receivables[0].outstanding_minor, "5000");
});

test("今日与最近三天使用包含今天的半开区间", () => {
  assert.deepEqual(timeRange("today", "2026-09-14"), { start: "2026-09-14", end: "2026-09-15" });
  assert.deepEqual(timeRange("days3", "2026-09-14"), { start: "2026-09-12", end: "2026-09-15" });
});
