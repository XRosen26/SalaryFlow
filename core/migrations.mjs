// Published migrations are immutable. Change the schema only by appending a version.
export const migrations = [
  {version:2,name:'账单延期',sql:'ALTER TABLE bill_occurrences ADD COLUMN snoozed_to TEXT;'},
  {version:3,name:'账本汇总覆盖索引',sql:`
CREATE INDEX tx_report_cover ON transactions(date,kind,amount_minor,source_id,destination_id,category_version_id) WHERE deleted=0;
CREATE INDEX tx_source_cover ON transactions(source_id,date,amount_minor) WHERE deleted=0 AND source_id IS NOT NULL;
CREATE INDEX tx_destination_cover ON transactions(destination_id,date,amount_minor) WHERE deleted=0 AND destination_id IS NOT NULL;
CREATE INDEX tx_list_order ON transactions(date DESC,created_at DESC,id) WHERE deleted=0;
`},
  {version:4,name:'预算口径、理财估值和分配计划归档',sql:`
ALTER TABLE cycle_rules ADD COLUMN basis TEXT NOT NULL DEFAULT 'SALARY' CHECK(basis IN('SALARY','CALENDAR_MONTH'));
ALTER TABLE accounts ADD COLUMN valuation_mode INTEGER NOT NULL DEFAULT 0 CHECK(valuation_mode IN(0,1));
ALTER TABLE allocation_plans ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN(0,1));
CREATE TABLE account_valuations (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), date TEXT NOT NULL, value_minor INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '', operation_id TEXT NOT NULL REFERENCES operations(id), revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, UNIQUE(account_id,date)) STRICT;
CREATE INDEX valuation_account_date ON account_valuations(account_id,date DESC);
`}
];
export const currentSchema = 4;
