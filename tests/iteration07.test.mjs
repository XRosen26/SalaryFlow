import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Store } from "../core/store.mjs";

test("交易排序在数据库分页前按日期和金额生效", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "salaryflow-v07-"));
  const store = new Store(path.join(dir, "ledger.sqlite"), () => "2026-09-12");
  t.after(() => {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  store.command("initialize", {
    payday: 10,
    start_date: "2026-09-10",
    accounts: [
      { name: "消费账户", opening_minor: "100000", roles: ["SPENDING"] },
    ],
  });
  const snapshot = store.snapshot();
  const account = snapshot.accounts[0];
  const category = snapshot.categories.find((item) => item.kind === "EXPENSE");
  for (const item of [
    { amount_minor: "1000", date: "2026-09-11" },
    { amount_minor: "3000", date: "2026-09-10" },
    { amount_minor: "2000", date: "2026-09-12" },
  ])
    store.command("record", {
      kind: "EXPENSE",
      source_id: account.id,
      category_id: category.id,
      ...item,
    });

  const query = { start: "2026-09-10", end: "2026-09-13", kind: "EXPENSE" };
  assert.deepEqual(
    store
      .snapshot({ ...query, sort: "amount_desc" })
      .transactions.map((item) => item.amount_minor),
    ["3000", "2000", "1000"],
  );
  assert.deepEqual(
    store
      .snapshot({ ...query, sort: "amount_asc" })
      .transactions.map((item) => item.amount_minor),
    ["1000", "2000", "3000"],
  );
  assert.deepEqual(
    store
      .snapshot({ ...query, sort: "date_asc" })
      .transactions.map((item) => item.date),
    ["2026-09-10", "2026-09-11", "2026-09-12"],
  );
  assert.deepEqual(
    store
      .snapshot({ ...query, sort: "date_desc" })
      .transactions.map((item) => item.date),
    ["2026-09-12", "2026-09-11", "2026-09-10"],
  );
  assert.deepEqual(
    store
      .snapshot({ ...query, sort: "not-a-real-order" })
      .transactions.map((item) => item.date),
    ["2026-09-12", "2026-09-11", "2026-09-10"],
  );
});
