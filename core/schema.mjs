export const schema = `
CREATE TABLE settings (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL CHECK(json_valid(data)), revision INTEGER NOT NULL DEFAULT 0) STRICT;
CREATE TABLE account_types (id TEXT PRIMARY KEY, name TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN(0,1))) STRICT;
CREATE TABLE accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL, type_id TEXT NOT NULL REFERENCES account_types(id), start_date TEXT NOT NULL, roles TEXT NOT NULL CHECK(json_valid(roles)), hidden INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL) STRICT;
CREATE TABLE categories (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN('INCOME','EXPENSE')), archived INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 1) STRICT;
CREATE TABLE category_versions (id TEXT PRIMARY KEY, category_id TEXT NOT NULL REFERENCES categories(id), version INTEGER NOT NULL, name TEXT NOT NULL, group_name TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(category_id,version)) STRICT;
CREATE TABLE cycle_rules (id TEXT PRIMARY KEY, effective_from TEXT NOT NULL UNIQUE, payday INTEGER NOT NULL CHECK(payday BETWEEN 1 AND 31)) STRICT;
CREATE TABLE cycles (id TEXT PRIMARY KEY, start TEXT NOT NULL UNIQUE, end TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN('DRAFT','OPEN','CLOSED')), partial INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 1, CHECK(start<end)) STRICT;
CREATE TRIGGER cycle_no_overlap BEFORE INSERT ON cycles WHEN EXISTS(SELECT 1 FROM cycles WHERE start<NEW.end AND end>NEW.start) BEGIN SELECT RAISE(ABORT,'工资周期不能重叠'); END;
CREATE TABLE budget_versions (id TEXT PRIMARY KEY, scope TEXT NOT NULL CHECK(scope IN('SYSTEM','DEFAULT','CYCLE')), cycle_id TEXT REFERENCES cycles(id), version INTEGER NOT NULL, items TEXT NOT NULL CHECK(json_valid(items)), reason TEXT NOT NULL, source_id TEXT REFERENCES budget_versions(id), created_at TEXT NOT NULL, CHECK((scope='CYCLE' AND cycle_id IS NOT NULL) OR (scope!='CYCLE' AND cycle_id IS NULL))) STRICT;
CREATE UNIQUE INDEX budget_version_unique ON budget_versions(scope,COALESCE(cycle_id,''),version);
CREATE TABLE operations (id TEXT PRIMARY KEY, hash TEXT NOT NULL, action TEXT NOT NULL, result TEXT NOT NULL, created_at TEXT NOT NULL) STRICT;
CREATE TABLE transactions (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN('INCOME','EXPENSE','TRANSFER','REFUND','OPENING','ADJUSTMENT')),
 amount_minor INTEGER NOT NULL CHECK(amount_minor BETWEEN -9000000000000 AND 9000000000000), date TEXT NOT NULL,
 source_id TEXT REFERENCES accounts(id), destination_id TEXT REFERENCES accounts(id), category_version_id TEXT REFERENCES category_versions(id), cycle_id TEXT REFERENCES cycles(id), original_id TEXT REFERENCES transactions(id),
 salary INTEGER NOT NULL DEFAULT 0 CHECK(salary IN(0,1)), note TEXT NOT NULL DEFAULT '', deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN(0,1)), revision INTEGER NOT NULL DEFAULT 1,
 operation_id TEXT NOT NULL REFERENCES operations(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 CHECK((kind='INCOME' AND amount_minor>0 AND source_id IS NULL AND destination_id IS NOT NULL AND category_version_id IS NOT NULL AND cycle_id IS NOT NULL AND original_id IS NULL)
 OR (kind='EXPENSE' AND amount_minor>0 AND source_id IS NOT NULL AND destination_id IS NULL AND category_version_id IS NOT NULL AND cycle_id IS NOT NULL AND original_id IS NULL)
 OR (kind='TRANSFER' AND amount_minor>0 AND source_id IS NOT NULL AND destination_id IS NOT NULL AND source_id!=destination_id AND category_version_id IS NULL AND cycle_id IS NULL AND original_id IS NULL)
 OR (kind='REFUND' AND amount_minor>0 AND source_id IS NULL AND destination_id IS NOT NULL AND category_version_id IS NOT NULL AND cycle_id IS NOT NULL AND original_id IS NOT NULL)
 OR (kind IN('OPENING','ADJUSTMENT') AND source_id IS NULL AND destination_id IS NOT NULL AND category_version_id IS NULL AND cycle_id IS NULL AND original_id IS NULL AND (kind='OPENING' OR amount_minor!=0))),
 CHECK(kind='INCOME' OR salary=0)
) STRICT;
CREATE UNIQUE INDEX opening_unique ON transactions(destination_id) WHERE kind='OPENING' AND deleted=0;
CREATE INDEX tx_date ON transactions(date,id) WHERE deleted=0;
CREATE INDEX tx_source ON transactions(source_id,date) WHERE deleted=0;
CREATE INDEX tx_destination ON transactions(destination_id,date) WHERE deleted=0;
CREATE INDEX tx_cycle ON transactions(cycle_id,category_version_id) WHERE deleted=0;
CREATE INDEX tx_original ON transactions(original_id,deleted);
CREATE VIEW movements AS
 SELECT id, date, destination_id account_id, amount_minor delta FROM transactions WHERE deleted=0 AND destination_id IS NOT NULL
 UNION ALL SELECT id, date, source_id account_id, -amount_minor delta FROM transactions WHERE deleted=0 AND source_id IS NOT NULL;
CREATE TABLE audit (id TEXT PRIMARY KEY, operation_id TEXT NOT NULL REFERENCES operations(id), entity TEXT NOT NULL, entity_id TEXT NOT NULL, before_data TEXT, after_data TEXT, reason TEXT NOT NULL, created_at TEXT NOT NULL) STRICT;
CREATE INDEX audit_entity ON audit(entity,entity_id,created_at);
CREATE TABLE settlements (id TEXT PRIMARY KEY, cycle_id TEXT NOT NULL REFERENCES cycles(id), data TEXT NOT NULL CHECK(json_valid(data)), note TEXT NOT NULL, dirty INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL) STRICT;
CREATE TABLE bills (id TEXT PRIMARY KEY, name TEXT NOT NULL, amount_minor INTEGER NOT NULL CHECK(amount_minor>0), account_id TEXT NOT NULL REFERENCES accounts(id), category_id TEXT NOT NULL REFERENCES categories(id), frequency TEXT NOT NULL CHECK(frequency IN('MONTHLY','WEEKLY')), day INTEGER NOT NULL, start_date TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, revision INTEGER NOT NULL DEFAULT 1) STRICT;
CREATE TABLE bill_occurrences (id TEXT PRIMARY KEY, bill_id TEXT NOT NULL REFERENCES bills(id), due_date TEXT NOT NULL, name TEXT NOT NULL, amount_minor INTEGER NOT NULL, account_id TEXT NOT NULL REFERENCES accounts(id), category_id TEXT NOT NULL REFERENCES categories(id), status TEXT NOT NULL CHECK(status IN('PENDING','PAID','SKIPPED')), transaction_id TEXT REFERENCES transactions(id), UNIQUE(bill_id,due_date)) STRICT;
CREATE UNIQUE INDEX bill_tx ON bill_occurrences(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE TABLE allocation_plans (id TEXT PRIMARY KEY, salary_id TEXT NOT NULL REFERENCES transactions(id), data TEXT NOT NULL CHECK(json_valid(data)), status TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL) STRICT;
CREATE UNIQUE INDEX active_plan ON allocation_plans(salary_id) WHERE status IN('DRAFT','PARTIAL');
CREATE TABLE allocation_items (id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES allocation_plans(id), source_id TEXT NOT NULL REFERENCES accounts(id), destination_id TEXT NOT NULL REFERENCES accounts(id), amount_minor INTEGER NOT NULL CHECK(amount_minor>0), transaction_id TEXT UNIQUE REFERENCES transactions(id), status TEXT NOT NULL CHECK(status IN('PENDING','RECORDED','CANCELLED')), CHECK(source_id!=destination_id)) STRICT;
CREATE TABLE imports (id TEXT PRIMARY KEY, file_hash TEXT NOT NULL, source TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), status TEXT NOT NULL, created_at TEXT NOT NULL) STRICT;
CREATE TABLE external_keys (source TEXT NOT NULL, account_key TEXT NOT NULL, external_id TEXT NOT NULL, transaction_id TEXT NOT NULL REFERENCES transactions(id), PRIMARY KEY(source,account_key,external_id)) STRICT;
CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL) STRICT;
`;
