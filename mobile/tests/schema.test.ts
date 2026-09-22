import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { schemaSql } from "../src/data/schema";

test("Android SQLite 初始 schema 可以一次建成并启用核心约束", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(schemaSql);
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((row) => row.name);
  for (const required of [
    "settings",
    "accounts",
    "transactions",
    "budget_versions",
    "audit",
    "receivables",
    "receivable_repayments",
    "savings_plans",
    "savings_plan_accounts",
    "schema_migrations",
  ]) {
    assert.ok(tables.includes(required), `missing ${required}`);
  }
  assert.equal(
    (db.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number })
      .foreign_keys,
    1,
  );
  const receivableColumns = db
    .prepare("PRAGMA table_info(receivables)")
    .all()
    .map((row) => (row as { name: string }).name);
  assert.ok(receivableColumns.includes("deleted"));
  const billColumns = db
    .prepare("PRAGMA table_info(bills)")
    .all()
    .map((row) => (row as { name: string }).name);
  assert.ok(billColumns.includes("deleted"));
  assert.throws(
    () =>
      db.exec(
        "INSERT INTO accounts(id,name,type_id,start_date,roles,created_at) VALUES('x','x','missing','2026-09-12','[]','now')",
      ),
    /FOREIGN KEY/,
  );
  db.close();
});

test("固定账单规则修改只更新未确认待办，删除规则保留历史", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(schemaSql);
  db.exec(
    [
      "INSERT INTO account_types(id,name,archived) VALUES('bank','银行',0);",
      "INSERT INTO accounts(id,name,type_id,start_date,roles,hidden,archived,deleted,note,revision,created_at,valuation_mode) VALUES('a1','日常消费','bank','2026-09-01','[\"PRIMARY_SPENDING\"]',0,0,0,'',1,'2026-09-01',0);",
      "INSERT INTO categories(id,kind,archived,revision) VALUES('c1','EXPENSE',0,1);",
      "INSERT INTO category_versions(id,category_id,version,name,group_name,created_at) VALUES('cv1','c1',1,'房租','固定生活','2026-09-01');",
      "INSERT INTO bills(id,name,amount_minor,account_id,category_id,frequency,day,start_date,enabled,revision) VALUES('b1','旧房租',200000,'a1','c1','MONTHLY',1,'2026-09-01',1,1);",
      "INSERT INTO bill_occurrences(id,bill_id,due_date,name,amount_minor,account_id,category_id,status) VALUES('paid','b1','2026-09-01','旧房租',200000,'a1','c1','PAID');",
      "INSERT INTO bill_occurrences(id,bill_id,due_date,name,amount_minor,account_id,category_id,status) VALUES('pending','b1','2026-10-01','旧房租',200000,'a1','c1','PENDING');",
    ].join("\n"),
  );
  db.exec(
    [
      "UPDATE bills SET name='新房租',amount_minor=220000,day=5,revision=revision+1 WHERE id='b1' AND enabled=1 AND revision=1;",
      "UPDATE bill_occurrences SET due_date='2026-10-05',name='新房租',amount_minor=220000 WHERE id='pending' AND status='PENDING';",
    ].join("\n"),
  );
  assert.deepEqual(
    Object.assign(
      {},
      db
        .prepare(
          "SELECT name,amount_minor FROM bill_occurrences WHERE id='paid'",
        )
        .get(),
    ),
    { name: "旧房租", amount_minor: 200000 },
  );
  assert.deepEqual(
    Object.assign(
      {},
      db
        .prepare(
          "SELECT name,amount_minor,due_date FROM bill_occurrences WHERE id='pending'",
        )
        .get(),
    ),
    { name: "新房租", amount_minor: 220000, due_date: "2026-10-05" },
  );

  db.exec(
    [
      "UPDATE bills SET enabled=0,deleted=1,revision=revision+1 WHERE id='b1' AND enabled=1 AND revision=2;",
      "UPDATE bill_occurrences SET status='SKIPPED' WHERE bill_id='b1' AND status='PENDING';",
    ].join("\n"),
  );
  assert.deepEqual(
    Object.assign(
      {},
      db.prepare("SELECT enabled,deleted FROM bills WHERE id='b1'").get(),
    ),
    { enabled: 0, deleted: 1 },
  );
  assert.equal(
    (
      db
        .prepare("SELECT status FROM bill_occurrences WHERE id='paid'")
        .get() as { status: string }
    ).status,
    "PAID",
  );
  assert.equal(
    (
      db
        .prepare("SELECT status FROM bill_occurrences WHERE id='pending'")
        .get() as { status: string }
    ).status,
    "SKIPPED",
  );
  db.close();
});
