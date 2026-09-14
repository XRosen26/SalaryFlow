export const DATABASE_VERSION = 3;

export const schemaSql = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK(id=1),
  data TEXT NOT NULL CHECK(json_valid(data)),
  revision INTEGER NOT NULL DEFAULT 1
) STRICT;

CREATE TABLE IF NOT EXISTS account_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN(0,1))
) STRICT;

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type_id TEXT NOT NULL REFERENCES account_types(id),
  start_date TEXT NOT NULL,
  roles TEXT NOT NULL CHECK(json_valid(roles)),
  hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN(0,1)),
  archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN(0,1)),
  deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN(0,1)),
  note TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  valuation_mode INTEGER NOT NULL DEFAULT 0 CHECK(valuation_mode IN(0,1))
) STRICT;

CREATE TABLE IF NOT EXISTS account_valuations (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  date TEXT NOT NULL,
  value_minor INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  operation_id TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE(account_id,date)
) STRICT;

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN('INCOME','EXPENSE')),
  archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN(0,1)),
  revision INTEGER NOT NULL DEFAULT 1
) STRICT;

CREATE TABLE IF NOT EXISTS category_versions (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id),
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  group_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(category_id,version)
) STRICT;

CREATE TABLE IF NOT EXISTS cycle_rules (
  id TEXT PRIMARY KEY,
  effective_from TEXT NOT NULL UNIQUE,
  payday INTEGER NOT NULL CHECK(payday BETWEEN 1 AND 31),
  basis TEXT NOT NULL DEFAULT 'SALARY' CHECK(basis IN('SALARY','CALENDAR_MONTH'))
) STRICT;

CREATE TABLE IF NOT EXISTS cycles (
  id TEXT PRIMARY KEY,
  start TEXT NOT NULL UNIQUE,
  end TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN('DRAFT','OPEN','CLOSED')),
  partial INTEGER NOT NULL DEFAULT 0 CHECK(partial IN(0,1)),
  revision INTEGER NOT NULL DEFAULT 1,
  CHECK(start < end)
) STRICT;

CREATE TABLE IF NOT EXISTS budget_versions (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK(scope IN('SYSTEM','DEFAULT','CYCLE')),
  cycle_id TEXT REFERENCES cycles(id),
  version INTEGER NOT NULL,
  items TEXT NOT NULL CHECK(json_valid(items)),
  reason TEXT NOT NULL,
  source_id TEXT REFERENCES budget_versions(id),
  created_at TEXT NOT NULL,
  CHECK((scope='CYCLE' AND cycle_id IS NOT NULL) OR (scope!='CYCLE' AND cycle_id IS NULL))
) STRICT;
CREATE UNIQUE INDEX IF NOT EXISTS budget_version_unique ON budget_versions(scope,COALESCE(cycle_id,''),version);

CREATE TABLE IF NOT EXISTS operations (
  id TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN('INCOME','EXPENSE','TRANSFER','REFUND','OPENING','ADJUSTMENT')),
  amount_minor INTEGER NOT NULL CHECK(amount_minor BETWEEN -9000000000000 AND 9000000000000),
  date TEXT NOT NULL,
  source_id TEXT REFERENCES accounts(id),
  destination_id TEXT REFERENCES accounts(id),
  category_version_id TEXT REFERENCES category_versions(id),
  cycle_id TEXT REFERENCES cycles(id),
  original_id TEXT REFERENCES transactions(id),
  salary INTEGER NOT NULL DEFAULT 0 CHECK(salary IN(0,1)),
  note TEXT NOT NULL DEFAULT '',
  deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN(0,1)),
  revision INTEGER NOT NULL DEFAULT 1,
  operation_id TEXT NOT NULL REFERENCES operations(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE UNIQUE INDEX IF NOT EXISTS opening_unique ON transactions(destination_id) WHERE kind='OPENING' AND deleted=0;
CREATE INDEX IF NOT EXISTS tx_date ON transactions(date,id) WHERE deleted=0;
CREATE INDEX IF NOT EXISTS tx_source ON transactions(source_id,date) WHERE deleted=0;
CREATE INDEX IF NOT EXISTS tx_destination ON transactions(destination_id,date) WHERE deleted=0;
CREATE INDEX IF NOT EXISTS tx_cycle ON transactions(cycle_id,category_version_id) WHERE deleted=0;
CREATE INDEX IF NOT EXISTS tx_original ON transactions(original_id,deleted);

CREATE VIEW IF NOT EXISTS movements AS
  SELECT id,date,destination_id account_id,amount_minor delta FROM transactions WHERE deleted=0 AND destination_id IS NOT NULL
  UNION ALL
  SELECT id,date,source_id account_id,-amount_minor delta FROM transactions WHERE deleted=0 AND source_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS audit (
  id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL REFERENCES operations(id),
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_data TEXT,
  after_data TEXT,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS bills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK(amount_minor>0),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  category_id TEXT NOT NULL REFERENCES categories(id),
  frequency TEXT NOT NULL CHECK(frequency IN('MONTHLY','WEEKLY')),
  day INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN(0,1)),
  revision INTEGER NOT NULL DEFAULT 1
) STRICT;

CREATE TABLE IF NOT EXISTS bill_occurrences (
  id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL REFERENCES bills(id),
  due_date TEXT NOT NULL,
  name TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  category_id TEXT NOT NULL REFERENCES categories(id),
  status TEXT NOT NULL CHECK(status IN('PENDING','PAID','SKIPPED')),
  transaction_id TEXT REFERENCES transactions(id),
  snoozed_to TEXT,
  UNIQUE(bill_id,due_date)
) STRICT;

CREATE TABLE IF NOT EXISTS allocation_plans (
  id TEXT PRIMARY KEY,
  salary_id TEXT NOT NULL REFERENCES transactions(id),
  data TEXT NOT NULL CHECK(json_valid(data)),
  status TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN(0,1))
) STRICT;

CREATE TABLE IF NOT EXISTS allocation_items (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES allocation_plans(id),
  source_id TEXT NOT NULL REFERENCES accounts(id),
  destination_id TEXT NOT NULL REFERENCES accounts(id),
  amount_minor INTEGER NOT NULL CHECK(amount_minor>0),
  transaction_id TEXT UNIQUE REFERENCES transactions(id),
  status TEXT NOT NULL CHECK(status IN('PENDING','RECORDED','CANCELLED')),
  CHECK(source_id!=destination_id)
) STRICT;

CREATE TABLE IF NOT EXISTS imports (
  id TEXT PRIMARY KEY,
  file_hash TEXT NOT NULL,
  source TEXT NOT NULL,
  data TEXT NOT NULL CHECK(json_valid(data)),
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS external_keys (
  source TEXT NOT NULL,
  account_key TEXT NOT NULL,
  external_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL REFERENCES transactions(id),
  PRIMARY KEY(source,account_key,external_id)
) STRICT;

CREATE TABLE IF NOT EXISTS receivables (
  id TEXT PRIMARY KEY,
  person TEXT NOT NULL,
  principal_minor INTEGER NOT NULL CHECK(principal_minor>0),
  outstanding_minor INTEGER NOT NULL CHECK(outstanding_minor>=0 AND outstanding_minor<=principal_minor),
  source_account_id TEXT NOT NULL REFERENCES accounts(id),
  default_return_account_id TEXT REFERENCES accounts(id),
  lent_date TEXT NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL CHECK(status IN('OPEN','SETTLED')),
  note TEXT NOT NULL DEFAULT '',
  outbound_transaction_id TEXT UNIQUE NOT NULL REFERENCES transactions(id),
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN(0,1)),
  CHECK(due_date IS NULL OR due_date>=lent_date)
) STRICT;

CREATE TABLE IF NOT EXISTS receivable_repayments (
  id TEXT PRIMARY KEY,
  receivable_id TEXT NOT NULL REFERENCES receivables(id),
  amount_minor INTEGER NOT NULL CHECK(amount_minor>0),
  destination_account_id TEXT NOT NULL REFERENCES accounts(id),
  date TEXT NOT NULL,
  transaction_id TEXT UNIQUE NOT NULL REFERENCES transactions(id),
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS receivable_status_due ON receivables(status,due_date);
CREATE INDEX IF NOT EXISTS receivable_person ON receivables(person);
CREATE INDEX IF NOT EXISTS repayment_receivable_date ON receivable_repayments(receivable_id,date);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
) STRICT;

`;
