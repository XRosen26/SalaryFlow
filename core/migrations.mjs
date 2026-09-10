// Published migrations are immutable. Change the schema only by appending a version.
export const migrations = [
  {version:2,name:'账单延期',sql:'ALTER TABLE bill_occurrences ADD COLUMN snoozed_to TEXT;'},
  {version:3,name:'账本汇总覆盖索引',sql:`
CREATE INDEX tx_report_cover ON transactions(date,kind,amount_minor,source_id,destination_id,category_version_id) WHERE deleted=0;
CREATE INDEX tx_source_cover ON transactions(source_id,date,amount_minor) WHERE deleted=0 AND source_id IS NOT NULL;
CREATE INDEX tx_destination_cover ON transactions(destination_id,date,amount_minor) WHERE deleted=0 AND destination_id IS NOT NULL;
CREATE INDEX tx_list_order ON transactions(date DESC,created_at DESC,id) WHERE deleted=0;
`}
];
export const currentSchema = 3;
