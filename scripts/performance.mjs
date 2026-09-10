import fs from "node:fs";
import path from "node:path";
import { Store } from "../core/store.mjs";
const dir = path.resolve(`.local/performance-${Date.now()}`);
fs.mkdirSync(dir, { recursive: true });
const s = new Store(path.join(dir, "ledger.sqlite"), () => "2026-09-20");
s.command("initialize", {
  payday: 10,
  start_date: "2020-01-01",
  accounts: Array.from({ length: 20 }, (_, i) => ({
    name: "性能账户" + i,
    roles: [],
    opening_minor: "0",
  })),
});
const d = s.snapshot(),
  category = d.categories.find((c) => c.kind === "EXPENSE");
// Fixture construction bypasses the command layer deliberately; timed reads use production queries.
s.db.exec("BEGIN");
const op = "performance-fixture";
s.run(
  "INSERT INTO operations VALUES(?,?,?,?,?)",
  op,
  "fixture",
  "fixture",
  "{}",
  new Date().toISOString(),
);
const insert = s.db.prepare(
  "INSERT INTO transactions(id,kind,amount_minor,date,source_id,category_version_id,cycle_id,operation_id,created_at,updated_at) VALUES(?,'EXPENSE',?,?,?,?,?,?,?,?)",
);
for (let i = 0; i < 100000; i++) {
  const date = "2026-09-" + String(10 + (i % 10)).padStart(2, "0");
  insert.run(
    "fixture-" + i,
    100 + (i % 10000),
    date,
    d.accounts[i % 20].id,
    category.version_id,
    d.cycle.id,
    op,
    "2026-09-20T00:00:00.000Z",
    "2026-09-20T00:00:00.000Z",
  );
}
s.db.exec("COMMIT");
const timings = [];
let snapshot;
for (let i = 0; i < 6; i++) {
  const begin = performance.now();
  snapshot = s.snapshot();
  timings.push(Math.round(performance.now() - begin));
}
const result = {
  rows: 100000,
  accounts: 20,
  timings_ms: timings,
  total_transactions: snapshot.total,
  returned_page: snapshot.transactions.length,
  net: snapshot.report.net,
  node: process.version,
};
fs.mkdirSync("test-results", { recursive: true });
fs.writeFileSync(
  "test-results/performance.json",
  JSON.stringify(result, null, 2),
);
console.log(result);
s.close();
