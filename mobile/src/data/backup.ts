import * as Crypto from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { SQLiteBindValue, SQLiteDatabase } from "expo-sqlite";

const TABLES = [
  "settings",
  "account_types",
  "accounts",
  "categories",
  "category_versions",
  "cycle_rules",
  "cycles",
  "budget_versions",
  "operations",
  "transactions",
  "account_valuations",
  "audit",
  "bills",
  "bill_occurrences",
  "allocation_plans",
  "allocation_items",
  "imports",
  "external_keys",
  "receivables",
  "receivable_repayments",
  "schema_migrations",
] as const;

const INSERT_ORDER = TABLES;
const DELETE_ORDER = [...TABLES].reverse();
const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

type TableName = (typeof TABLES)[number];
type BackupRow = Record<string, SQLiteBindValue>;
type BackupBase = {
  format: "salaryflow-ledger";
  formatVersion: 1;
  schemaVersion: 4;
  createdAt: string;
  source: { platform: "mobile"; appVersion: "0.5.0" };
  tables: Record<TableName, BackupRow[]>;
};

export type BackupDocument = BackupBase & {
  integrity: { algorithm: "SHA-256"; digest: string };
};

export type BackupSummary = {
  createdAt: string;
  accounts: number;
  transactions: number;
  categories: number;
};

async function digest(value: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}

export async function buildBackup(db: SQLiteDatabase): Promise<BackupDocument> {
  const tables = {} as BackupBase["tables"];
  for (const table of TABLES) {
    tables[table] = await db.getAllAsync<BackupRow>(`SELECT * FROM ${table}`);
  }
  const base: BackupBase = {
    format: "salaryflow-ledger",
    formatVersion: 1,
    schemaVersion: 4,
    createdAt: new Date().toISOString(),
    source: { platform: "mobile", appVersion: "0.5.0" },
    tables,
  };
  return {
    ...base,
    integrity: {
      algorithm: "SHA-256",
      digest: await digest(JSON.stringify(base)),
    },
  };
}

function backupName(prefix: string) {
  return `${prefix}-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;
}

export async function writeBackup(db: SQLiteDatabase, recovery = false) {
  const backup = await buildBackup(db);
  const directory = recovery
    ? new Directory(Paths.document, "SalaryFlow", "recovery")
    : Paths.cache;
  if (recovery && !directory.exists)
    directory.create({ intermediates: true, idempotent: true });
  const file = new File(
    directory,
    backupName(recovery ? "Recovery" : "SalaryFlow-Mobile"),
  );
  file.create({ overwrite: true, intermediates: true });
  file.write(JSON.stringify(backup, null, 2));
  return file;
}

export async function shareBackup(db: SQLiteDatabase) {
  const file = await writeBackup(db);
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("当前设备无法打开系统分享面板");
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/json",
    dialogTitle: "导出薪流完整备份",
    UTI: "public.json",
  });
  return file.uri;
}

function assertRecord(
  value: unknown,
  message: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(message);
}

async function parseBackup(text: string): Promise<BackupDocument> {
  if (text.length > MAX_BACKUP_BYTES)
    throw new Error("备份文件超过 50 MB 限制");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("文件不是有效的 JSON 备份");
  }
  assertRecord(value, "备份结构无效");
  if (
    value.format !== "salaryflow-ledger" ||
    value.formatVersion !== 1 ||
    value.schemaVersion !== 4
  ) {
    throw new Error("备份格式或版本不受支持");
  }
  assertRecord(value.tables, "备份缺少数据表");
  assertRecord(value.integrity, "备份缺少完整性校验");
  for (const table of TABLES) {
    if (!Array.isArray(value.tables[table]) && !["receivables", "receivable_repayments"].includes(table))
      throw new Error(`备份缺少 ${table} 数据`);
  }
  const document = value as unknown as BackupDocument;
  const { integrity, ...base } = document;
  if (
    integrity.algorithm !== "SHA-256" ||
    integrity.digest !== (await digest(JSON.stringify(base)))
  ) {
    throw new Error("备份完整性校验失败，文件可能已损坏或被修改");
  }
  document.tables.receivables ??= [];
  document.tables.receivable_repayments ??= [];
  return document;
}

export async function inspectBackup(
  uri: string,
): Promise<{ document: BackupDocument; summary: BackupSummary }> {
  const file = new File(uri);
  if (!file.exists) throw new Error("无法读取所选文件");
  const info = file.info();
  if (typeof info.size === "number" && info.size > MAX_BACKUP_BYTES)
    throw new Error("备份文件超过 50 MB 限制");
  const document = await parseBackup(await file.text());
  return {
    document,
    summary: {
      createdAt: document.createdAt,
      accounts: document.tables.accounts.filter((row) => row.deleted !== 1)
        .length,
      transactions: document.tables.transactions.filter(
        (row) => row.deleted !== 1,
      ).length,
      categories: document.tables.categories.filter((row) => row.archived !== 1)
        .length,
    },
  };
}

async function columnsFor(db: SQLiteDatabase, table: TableName) {
  const columns = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table})`,
  );
  return new Set(columns.map((column) => column.name));
}

export async function restoreBackup(
  db: SQLiteDatabase,
  document: BackupDocument,
) {
  await writeBackup(db, true);
  const columns = new Map<TableName, Set<string>>();
  for (const table of TABLES) columns.set(table, await columnsFor(db, table));

  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const table of DELETE_ORDER) await tx.runAsync(`DELETE FROM ${table}`);
    for (const table of INSERT_ORDER) {
      const allowed = columns.get(table) ?? new Set<string>();
      for (const row of document.tables[table]) {
        const names = Object.keys(row).filter((name) => allowed.has(name));
        if (!names.length) continue;
        const placeholders = names.map(() => "?").join(",");
        const values = names.map((name) => row[name]);
        await tx.runAsync(
          `INSERT INTO ${table}(${names.map((name) => `"${name}"`).join(",")}) VALUES(${placeholders})`,
          values,
        );
      }
    }
    const foreignKeyErrors = await tx.getAllAsync<Record<string, unknown>>(
      "PRAGMA foreign_key_check",
    );
    if (foreignKeyErrors.length)
      throw new Error("备份存在无效的数据关联，恢复已回滚");
    const transactionIntegrity = await tx.getFirstAsync<{
      integrity_check: string;
    }>("PRAGMA integrity_check");
    if (!transactionIntegrity || transactionIntegrity.integrity_check !== "ok")
      throw new Error("数据库完整性检查失败，恢复已回滚");
  });

  const integrity = await db.getFirstAsync<{ integrity_check: string }>(
    "PRAGMA integrity_check",
  );
  if (!integrity || integrity.integrity_check !== "ok")
    throw new Error("恢复后的数据库完整性检查未通过");
}
