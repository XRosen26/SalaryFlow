// Published migrations are immutable. Change the schema only by appending a version.
export const migrations = [
  {
    version: 2,
    name: "账单延期",
    sql: "ALTER TABLE bill_occurrences ADD COLUMN snoozed_to TEXT;",
  },
  {
    version: 3,
    name: "账本汇总覆盖索引",
    sql: `
CREATE INDEX tx_report_cover ON transactions(date,kind,amount_minor,source_id,destination_id,category_version_id) WHERE deleted=0;
CREATE INDEX tx_source_cover ON transactions(source_id,date,amount_minor) WHERE deleted=0 AND source_id IS NOT NULL;
CREATE INDEX tx_destination_cover ON transactions(destination_id,date,amount_minor) WHERE deleted=0 AND destination_id IS NOT NULL;
CREATE INDEX tx_list_order ON transactions(date DESC,created_at DESC,id) WHERE deleted=0;
`,
  },
  {
    version: 4,
    name: "预算口径、理财估值和分配计划归档",
    sql: `
ALTER TABLE cycle_rules ADD COLUMN basis TEXT NOT NULL DEFAULT 'SALARY' CHECK(basis IN('SALARY','CALENDAR_MONTH'));
ALTER TABLE accounts ADD COLUMN valuation_mode INTEGER NOT NULL DEFAULT 0 CHECK(valuation_mode IN(0,1));
ALTER TABLE allocation_plans ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN(0,1));
CREATE TABLE account_valuations (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), date TEXT NOT NULL, value_minor INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '', operation_id TEXT NOT NULL REFERENCES operations(id), revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, UNIQUE(account_id,date)) STRICT;
CREATE INDEX valuation_account_date ON account_valuations(account_id,date DESC);
`,
  },
  {
    version: 5,
    name: "待收款与分次归还",
    sql: `
CREATE TABLE receivables (id TEXT PRIMARY KEY, person TEXT NOT NULL, principal_minor INTEGER NOT NULL CHECK(principal_minor>0), outstanding_minor INTEGER NOT NULL CHECK(outstanding_minor>=0 AND outstanding_minor<=principal_minor), source_account_id TEXT NOT NULL REFERENCES accounts(id), default_return_account_id TEXT REFERENCES accounts(id), lent_date TEXT NOT NULL, due_date TEXT, status TEXT NOT NULL CHECK(status IN('OPEN','SETTLED')), note TEXT NOT NULL DEFAULT '', outbound_transaction_id TEXT UNIQUE NOT NULL REFERENCES transactions(id), revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, CHECK(due_date IS NULL OR due_date>=lent_date)) STRICT;
CREATE TABLE receivable_repayments (id TEXT PRIMARY KEY, receivable_id TEXT NOT NULL REFERENCES receivables(id), amount_minor INTEGER NOT NULL CHECK(amount_minor>0), destination_account_id TEXT NOT NULL REFERENCES accounts(id), date TEXT NOT NULL, transaction_id TEXT UNIQUE NOT NULL REFERENCES transactions(id), note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL) STRICT;
CREATE INDEX receivable_status_due ON receivables(status,due_date);
CREATE INDEX receivable_person ON receivables(person);
CREATE INDEX repayment_receivable_date ON receivable_repayments(receivable_id,date);
`,
  },
  {
    version: 6,
    name: "待收款软删除",
    sql: `
ALTER TABLE receivables ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN(0,1));
CREATE INDEX receivable_active_due ON receivables(deleted,status,due_date);
`,
  },
  {
    version: 7,
    name: "固定账单软删除",
    sql: `
ALTER TABLE bills ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN(0,1));
CREATE INDEX bill_active_name ON bills(deleted,name);
`,
  },
  {
    version: 8,
    name: "存钱计划",
    sql: `
CREATE TABLE savings_plans (id TEXT PRIMARY KEY,name TEXT NOT NULL,target_minor INTEGER NOT NULL CHECK(target_minor>0),mode TEXT NOT NULL CHECK(mode IN('ACCOUNTS','MANUAL')),manual_minor INTEGER NOT NULL DEFAULT 0 CHECK(manual_minor>=0),due_date TEXT,note TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','COMPLETED','ARCHIVED')),revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN(0,1))) STRICT;
CREATE TABLE savings_plan_accounts (plan_id TEXT NOT NULL REFERENCES savings_plans(id),account_id TEXT NOT NULL REFERENCES accounts(id),PRIMARY KEY(plan_id,account_id)) STRICT;
CREATE INDEX savings_plan_status ON savings_plans(deleted,status,due_date);
`,
  },
];
export const currentSchema = 8;
