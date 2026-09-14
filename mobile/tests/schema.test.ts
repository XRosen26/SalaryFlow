import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import { schemaSql } from '../src/data/schema';

test('Android SQLite 初始 schema 可以一次建成并启用核心约束', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(schemaSql);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name);
  for (const required of ['settings', 'accounts', 'transactions', 'budget_versions', 'audit', 'receivables', 'receivable_repayments', 'schema_migrations']) {
    assert.ok(tables.includes(required), `missing ${required}`);
  }
  assert.equal((db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }).foreign_keys, 1);
  assert.throws(() => db.exec("INSERT INTO accounts(id,name,type_id,start_date,roles,created_at) VALUES('x','x','missing','2026-09-12','[]','now')"), /FOREIGN KEY/);
  db.close();
});
