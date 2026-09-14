import * as Crypto from "expo-crypto";
import type { SQLiteDatabase } from "expo-sqlite";

import {
  addDays,
  budgetPeriodRange,
  monthDay,
  today,
  validDate,
} from "@/domain/dates";
import { DATABASE_VERSION, schemaSql } from "./schema";

export type BudgetBasis = "SALARY" | "CALENDAR_MONTH";
export type TransactionKind = "INCOME" | "EXPENSE" | "TRANSFER" | "REFUND";

export type Settings = {
  budgetBasis: BudgetBasis;
  payday: number;
  amountsVisible: boolean;
  accountSummaryVisible: boolean;
  palette: "forest" | "ocean" | "violet" | "amber" | "rose" | "slate";
  themeMode: "system" | "light" | "dark";
  onboardingComplete: boolean;
};

export type Account = {
  id: string;
  name: string;
  typeId: "bank" | "cash" | "investment";
  typeName: string;
  roles: string[];
  hidden: boolean;
  valuationMode: boolean;
  balanceMinor: number;
};

export type Category = {
  id: string;
  kind: "INCOME" | "EXPENSE";
  name: string;
  groupName: string;
};

export type TransactionItem = {
  id: string;
  kind: TransactionKind | "OPENING" | "ADJUSTMENT";
  amountMinor: number;
  date: string;
  note: string;
  salary: boolean;
  sourceName: string | null;
  destinationName: string | null;
  categoryName: string | null;
  sourceId: string | null;
  destinationId: string | null;
  categoryId: string | null;
  originalId: string | null;
};

export type BudgetItem = {
  categoryId: string;
  name: string;
  groupName: string;
  budgetMinor: number;
  actualMinor: number;
};

export type Snapshot = {
  settings: Settings;
  accounts: Account[];
  categories: Category[];
  transactions: TransactionItem[];
  budgets: BudgetItem[];
  cycle: { id: string; start: string; end: string };
  summary: {
    incomeMinor: number;
    grossExpenseMinor: number;
    refundMinor: number;
    netExpenseMinor: number;
    budgetMinor: number;
    remainingBudgetMinor: number;
    totalAssetsMinor: number;
    spendingBalanceMinor: number;
    safeToSpendMinor: number;
    todayExpenseMinor: number;
    threeDayExpenseMinor: number;
    receivableOutstandingMinor: number;
    receivableOverdueCount: number;
    receivableDueTodayCount: number;
  };
};

export type NewTransaction = {
  kind: Exclude<TransactionKind, "REFUND">;
  amountMinor: number;
  date: string;
  sourceId?: string;
  destinationId?: string;
  categoryId?: string;
  salary?: boolean;
  note?: string;
};

const defaultSettings: Settings = {
  budgetBasis: "SALARY",
  payday: 10,
  amountsVisible: true,
  accountSummaryVisible: true,
  palette: "forest",
  themeMode: "system",
  onboardingComplete: false,
};

const accountSeeds = [
  ["account-spending", "日常消费", "bank", ["PRIMARY_SPENDING"], 0],
  ["account-savings", "长期储蓄", "bank", ["PRIMARY_SAVINGS"], 0],
  ["account-salary", "工资账户", "bank", ["PRIMARY_SALARY"], 0],
  ["account-investment", "理财账户", "investment", ["INVESTMENT"], 1],
] as const;

const categorySeeds = [
  ["income-salary", "INCOME", "工资", "收入"],
  ["income-other", "INCOME", "其他收入", "收入"],
  ["income-investment", "INCOME", "理财收益", "收入"],
  ["expense-rent", "EXPENSE", "房租", "固定生活"],
  ["expense-grocery", "EXPENSE", "买菜", "餐饮"],
  ["expense-dining", "EXPENSE", "外食/外卖", "餐饮"],
  ["expense-transport", "EXPENSE", "交通", "日常生活"],
  ["expense-daily", "EXPENSE", "日用品", "日常生活"],
  ["expense-social", "EXPENSE", "聚餐/社交", "社交娱乐"],
  ["expense-study", "EXPENSE", "课程/学习", "成长投资"],
  ["expense-medical", "EXPENSE", "医疗", "医疗与备用"],
  ["expense-other", "EXPENSE", "其他", "其他"],
] as const;

const defaultBudget: Record<string, number> = {
  "expense-rent": 185000,
  "expense-grocery": 50000,
  "expense-dining": 100000,
  "expense-transport": 20000,
  "expense-daily": 15000,
  "expense-social": 30000,
  "expense-study": 30000,
  "expense-medical": 10000,
  "expense-other": 20000,
};

function isoNow() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}-${Crypto.randomUUID()}`;
}

type CycleRule = { effectiveFrom: string; payday: number; basis: BudgetBasis };

async function getCycleRuleForDate(
  db: SQLiteDatabase,
  date: string,
): Promise<CycleRule> {
  validDate(date);
  const row = await db.getFirstAsync<{
    effective_from: string;
    payday: number;
    basis: BudgetBasis;
  }>(
    "SELECT effective_from,payday,basis FROM cycle_rules WHERE effective_from<=? ORDER BY effective_from DESC LIMIT 1",
    date,
  );
  return row
    ? {
        effectiveFrom: row.effective_from,
        payday: row.payday,
        basis: row.basis,
      }
    : {
        effectiveFrom: "1900-01-01",
        payday: defaultSettings.payday,
        basis: defaultSettings.budgetBasis,
      };
}

async function ensureCycleForDate(db: SQLiteDatabase, date: string) {
  const rule = await getCycleRuleForDate(db, date);
  const calculated = budgetPeriodRange(date, rule.basis, rule.payday);
  const range = {
    start:
      rule.effectiveFrom > calculated.start
        ? rule.effectiveFrom
        : calculated.start,
    end: calculated.end,
  };
  const existing = await db.getFirstAsync<{
    id: string;
    start: string;
    end: string;
  }>("SELECT id,start,end FROM cycles WHERE start=?", range.start);
  if (existing) return existing;

  const cycleId = id("cycle");
  const partial = range.start !== calculated.start ? 1 : 0;
  const status = range.end <= today() ? "CLOSED" : "OPEN";
  await db.runAsync(
    "INSERT INTO cycles(id,start,end,status,partial,revision) VALUES(?,?,?,?,?,1)",
    cycleId,
    range.start,
    range.end,
    status,
    partial,
  );

  const latestDefault = await db.getFirstAsync<{ id: string; items: string }>(
    "SELECT id,items FROM budget_versions WHERE scope='DEFAULT' ORDER BY version DESC LIMIT 1",
  );
  if (latestDefault) {
    await db.runAsync(
      "INSERT INTO budget_versions(id,scope,cycle_id,version,items,reason,source_id,created_at) VALUES(?,'CYCLE',?,1,?,'创建周期',?,?)",
      id("budget"),
      cycleId,
      latestDefault.items,
      latestDefault.id,
      isoNow(),
    );
  }
  return { id: cycleId, ...range };
}
async function seed(db: SQLiteDatabase) {
  const current = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) count FROM settings",
  );
  if ((current?.count ?? 0) > 0) return;
  const now = isoNow();

  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      "INSERT INTO settings(id,data,revision) VALUES(1,?,1)",
      JSON.stringify(defaultSettings),
    );
    await tx.runAsync(
      "INSERT INTO account_types(id,name,archived) VALUES('bank','银行/支付账户',0),('cash','现金',0),('investment','理财账户',0)",
    );
    for (const [
      accountId,
      name,
      typeId,
      roles,
      valuationMode,
    ] of accountSeeds) {
      await tx.runAsync(
        "INSERT INTO accounts(id,name,type_id,start_date,roles,hidden,archived,deleted,note,revision,created_at,valuation_mode) VALUES(?,?,?,?,?,0,0,0,'',1,?,?)",
        accountId,
        name,
        typeId,
        today(),
        JSON.stringify(roles),
        now,
        valuationMode,
      );
    }
    for (const [categoryId, kind, name, groupName] of categorySeeds) {
      await tx.runAsync(
        "INSERT INTO categories(id,kind,archived,revision) VALUES(?,?,0,1)",
        categoryId,
        kind,
      );
      await tx.runAsync(
        "INSERT INTO category_versions(id,category_id,version,name,group_name,created_at) VALUES(?,?,1,?,?,?)",
        `${categoryId}-v1`,
        categoryId,
        name,
        groupName,
        now,
      );
    }
    await tx.runAsync(
      "INSERT INTO cycle_rules(id,effective_from,payday,basis) VALUES('rule-initial','1900-01-01',10,'SALARY')",
    );
    const items = JSON.stringify(
      Object.entries(defaultBudget).map(([categoryId, amountMinor]) => ({
        categoryId,
        amountMinor,
        enabled: true,
      })),
    );
    const systemId = "budget-system-v1";
    await tx.runAsync(
      "INSERT INTO budget_versions(id,scope,cycle_id,version,items,reason,source_id,created_at) VALUES(?,'SYSTEM',NULL,1,?,'系统初始模板',NULL,?)",
      systemId,
      items,
      now,
    );
    await tx.runAsync(
      "INSERT INTO budget_versions(id,scope,cycle_id,version,items,reason,source_id,created_at) VALUES('budget-default-v1','DEFAULT',NULL,1,?,'首次初始化',?,?)",
      items,
      systemId,
      now,
    );
  });
}

export async function initializeDatabase(db: SQLiteDatabase) {
  await db.execAsync("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  const version = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  if ((version?.user_version ?? 0) < 1) {
    await db.execAsync(schemaSql);
    await db.runAsync(
      "INSERT OR IGNORE INTO schema_migrations(version,checksum,applied_at) VALUES(1,?,?)",
      "mobile-schema-v1",
      isoNow(),
    );
    await db.execAsync("PRAGMA user_version = 1");
  }
  if ((version?.user_version ?? 0) < 2) {
    await db.execAsync(`CREATE TABLE IF NOT EXISTS receivables (
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

`);
    await db.runAsync("INSERT OR IGNORE INTO schema_migrations(version,checksum,applied_at) VALUES(2,?,?)", "mobile-receivables-v2", isoNow());
    await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  }
  await seed(db);
  await ensureCycleForDate(db, today());
}

export async function getSettings(db: SQLiteDatabase): Promise<Settings> {
  const row = await db.getFirstAsync<{ data: string }>(
    "SELECT data FROM settings WHERE id=1",
  );
  const stored = row
    ? { ...defaultSettings, ...JSON.parse(row.data) }
    : defaultSettings;
  const rule = await getCycleRuleForDate(db, today());
  return { ...stored, budgetBasis: rule.basis, payday: rule.payday };
}

export async function updateSettings(
  db: SQLiteDatabase,
  patch: Partial<Settings>,
) {
  const next = { ...(await getSettings(db)), ...patch };
  await db.runAsync(
    "UPDATE settings SET data=?,revision=revision+1 WHERE id=1",
    JSON.stringify(next),
  );
}

export type CycleRuleInput = {
  basis: BudgetBasis;
  payday: number;
  effectiveMode: "IMMEDIATE" | "NEXT_CYCLE" | "SPECIFIED";
  specifiedDate?: string;
};

export async function scheduleCycleRule(
  db: SQLiteDatabase,
  input: CycleRuleInput,
) {
  if (!Number.isInteger(input.payday) || input.payday < 1 || input.payday > 31)
    throw new Error("工资日应为 1—31");
  const current = await ensureCycleForDate(db, today());
  const effectiveFrom =
    input.effectiveMode === "IMMEDIATE"
      ? today()
      : input.effectiveMode === "NEXT_CYCLE"
        ? current.end
        : (input.specifiedDate ?? "");
  validDate(effectiveFrom);
  if (effectiveFrom < today()) throw new Error("指定生效日期不能早于今天");
  const now = isoNow();
  const ruleId = id("rule");
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO cycle_rules(id,effective_from,payday,basis) VALUES(?,?,?,?)
       ON CONFLICT(effective_from) DO UPDATE SET payday=excluded.payday,basis=excluded.basis`,
      ruleId,
      effectiveFrom,
      input.payday,
      input.basis,
    );
    const operationId = id("op");
    await tx.runAsync(
      "INSERT INTO operations(id,hash,action,result,created_at) VALUES(?,?,?,?,?)",
      operationId,
      operationId,
      "SCHEDULE_CYCLE_RULE",
      JSON.stringify({
        effectiveFrom,
        basis: input.basis,
        payday: input.payday,
      }),
      now,
    );
    await tx.runAsync(
      "INSERT INTO audit(id,operation_id,entity,entity_id,before_data,after_data,reason,created_at) VALUES(?,?,?,?,?,?,?,?)",
      id("audit"),
      operationId,
      "cycle_rules",
      ruleId,
      null,
      JSON.stringify({
        effectiveFrom,
        basis: input.basis,
        payday: input.payday,
      }),
      "用户修改预算周期规则",
      now,
    );
  });
  if (effectiveFrom === today()) await ensureCycleForDate(db, today());
  return effectiveFrom;
}

export type AccountInput = {
  id?: string;
  name: string;
  typeId: "bank" | "cash" | "investment";
  role?:
    "PRIMARY_SPENDING" | "PRIMARY_SAVINGS" | "PRIMARY_SALARY" | "INVESTMENT";
  openingBalanceMinor?: number;
  startDate: string;
  note?: string;
};

async function assignExclusiveRole(
  tx: SQLiteDatabase,
  accountId: string,
  role?: AccountInput["role"],
) {
  if (!role || role === "INVESTMENT") return;
  const rows = await tx.getAllAsync<{ id: string; roles: string }>(
    "SELECT id,roles FROM accounts WHERE deleted=0",
  );
  for (const row of rows) {
    const roles = (JSON.parse(row.roles) as string[]).filter(
      (item) => item !== role,
    );
    await tx.runAsync(
      "UPDATE accounts SET roles=? WHERE id=?",
      JSON.stringify(roles),
      row.id,
    );
  }
}

export async function saveAccount(db: SQLiteDatabase, input: AccountInput) {
  const name = input.name.trim();
  if (!name) throw new Error("请输入账户名称");
  validDate(input.startDate);
  const opening = input.openingBalanceMinor ?? 0;
  if (
    !Number.isSafeInteger(opening) ||
    opening < 0 ||
    opening > Number(MAX_SAFE_MONEY)
  )
    throw new Error("期初余额无效");
  const now = isoNow();
  const accountId = input.id ?? id("account");

  await db.withExclusiveTransactionAsync(async (tx) => {
    await assignExclusiveRole(
      tx as unknown as SQLiteDatabase,
      accountId,
      input.role,
    );
    const roles = input.role ? [input.role] : [];
    if (input.id) {
      const before = await tx.getFirstAsync<Record<string, unknown>>(
        "SELECT * FROM accounts WHERE id=? AND deleted=0",
        input.id,
      );
      if (!before) throw new Error("账户不存在或已删除");
      const existingRoles = JSON.parse(String(before.roles)) as string[];
      const kept = existingRoles.filter(
        (role) =>
          ![
            "PRIMARY_SPENDING",
            "PRIMARY_SAVINGS",
            "PRIMARY_SALARY",
            "INVESTMENT",
          ].includes(role),
      );
      await tx.runAsync(
        "UPDATE accounts SET name=?,type_id=?,roles=?,note=?,valuation_mode=?,revision=revision+1 WHERE id=?",
        name,
        input.typeId,
        JSON.stringify([...kept, ...roles]),
        input.note?.trim() ?? "",
        input.typeId === "investment" ? 1 : 0,
        input.id,
      );
      const operationId = id("op");
      await tx.runAsync(
        "INSERT INTO operations(id,hash,action,result,created_at) VALUES(?,?,?,?,?)",
        operationId,
        operationId,
        "UPDATE_ACCOUNT",
        "{}",
        now,
      );
      await tx.runAsync(
        "INSERT INTO audit(id,operation_id,entity,entity_id,before_data,after_data,reason,created_at) VALUES(?,?,?,?,?,?,?,?)",
        id("audit"),
        operationId,
        "accounts",
        input.id,
        JSON.stringify(before),
        JSON.stringify(input),
        "用户编辑账户",
        now,
      );
    } else {
      await tx.runAsync(
        "INSERT INTO accounts(id,name,type_id,start_date,roles,hidden,archived,deleted,note,revision,created_at,valuation_mode) VALUES(?,?,?,?,?,0,0,0,?,1,?,?)",
        accountId,
        name,
        input.typeId,
        input.startDate,
        JSON.stringify(roles),
        input.note?.trim() ?? "",
        now,
        input.typeId === "investment" ? 1 : 0,
      );
      if (opening > 0) {
        const operationId = id("op");
        const transactionId = id("tx");
        await tx.runAsync(
          "INSERT INTO operations(id,hash,action,result,created_at) VALUES(?,?,?,?,?)",
          operationId,
          transactionId,
          "CREATE_ACCOUNT",
          "{}",
          now,
        );
        await tx.runAsync(
          `INSERT INTO transactions(id,kind,amount_minor,date,source_id,destination_id,category_version_id,cycle_id,original_id,salary,note,deleted,revision,operation_id,created_at,updated_at)
           VALUES(?,'OPENING',?,?,NULL,?,NULL,NULL,NULL,0,'账户期初余额',0,1,?,?,?)`,
          transactionId,
          opening,
          input.startDate,
          accountId,
          operationId,
          now,
          now,
        );
      }
    }
  });
  return accountId;
}

export async function setAccountValuation(
  db: SQLiteDatabase,
  accountId: string,
  valueMinor: number,
  date: string,
  note = "",
) {
  if (
    !Number.isSafeInteger(valueMinor) ||
    valueMinor < 0 ||
    valueMinor > Number(MAX_SAFE_MONEY)
  )
    throw new Error("市值金额无效");
  validDate(date);
  const account = await db.getFirstAsync<{
    id: string;
    valuation_mode: number;
  }>(
    "SELECT id,valuation_mode FROM accounts WHERE id=? AND deleted=0 AND archived=0",
    accountId,
  );
  if (!account || account.valuation_mode !== 1)
    throw new Error("该账户不是理财估值账户");
  const before = await db.getFirstAsync<Record<string, unknown>>(
    "SELECT * FROM account_valuations WHERE account_id=? AND date=?",
    accountId,
    date,
  );
  const operationId = id("op"),
    now = isoNow();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      "INSERT INTO operations(id,hash,action,result,created_at) VALUES(?,?,?,?,?)",
      operationId,
      operationId,
      "UPDATE_VALUATION",
      "{}",
      now,
    );
    await tx.runAsync(
      `INSERT INTO account_valuations(id,account_id,date,value_minor,note,operation_id,revision,created_at) VALUES(?,?,?,?,?,?,1,?) ON CONFLICT(account_id,date) DO UPDATE SET value_minor=excluded.value_minor,note=excluded.note,operation_id=excluded.operation_id,revision=account_valuations.revision+1`,
      id("valuation"),
      accountId,
      date,
      valueMinor,
      note.trim(),
      operationId,
      now,
    );
    await tx.runAsync(
      "INSERT INTO audit(id,operation_id,entity,entity_id,before_data,after_data,reason,created_at) VALUES(?,?,?,?,?,?,?,?)",
      id("audit"),
      operationId,
      "account_valuations",
      accountId,
      before ? JSON.stringify(before) : null,
      JSON.stringify({ date, valueMinor, note }),
      "用户更新理财市值",
      now,
    );
  });
}
export async function archiveAccount(db: SQLiteDatabase, accountId: string) {
  const balance = await accountBalance(db, accountId);
  if (balance !== 0)
    throw new Error("账户余额必须为 0 才能归档，请先转出或校准");
  await db.runAsync(
    "UPDATE accounts SET archived=1,revision=revision+1 WHERE id=?",
    accountId,
  );
}
export async function toggleAccountHidden(
  db: SQLiteDatabase,
  accountId: string,
) {
  await db.runAsync(
    "UPDATE accounts SET hidden=CASE hidden WHEN 1 THEN 0 ELSE 1 END,revision=revision+1 WHERE id=?",
    accountId,
  );
}


export type TransactionQuery = {
  kind?: TransactionItem["kind"];
  search?: string;
  start?: string;
  end?: string;
  minAmountMinor?: number;
  maxAmountMinor?: number;
  sort?: "DATE_DESC" | "DATE_ASC" | "AMOUNT_DESC" | "AMOUNT_ASC" | "CATEGORY";
};

export async function loadTransactions(
  db: SQLiteDatabase,
  query: TransactionQuery = {},
): Promise<TransactionItem[]> {
  const clauses = ["x.deleted=0"];
  const params: (string | number)[] = [];
  if (query.kind) { clauses.push("x.kind=?"); params.push(query.kind); }
  if (query.start) { validDate(query.start); clauses.push("x.date>=?"); params.push(query.start); }
  if (query.end) { validDate(query.end); clauses.push("x.date<?"); params.push(query.end); }
  if (query.minAmountMinor !== undefined) { clauses.push("ABS(x.amount_minor)>=?"); params.push(query.minAmountMinor); }
  if (query.maxAmountMinor !== undefined) { clauses.push("ABS(x.amount_minor)<=?"); params.push(query.maxAmountMinor); }
  if (query.search?.trim()) {
    const term = "%" + query.search.trim().slice(0, 100) + "%";
    clauses.push("(x.note LIKE ? OR cv.name LIKE ? OR s.name LIKE ? OR d.name LIKE ? OR x.date LIKE ?)");
    params.push(term, term, term, term, term);
  }
  const order = {
    DATE_DESC: "x.date DESC,x.created_at DESC,x.id",
    DATE_ASC: "x.date ASC,x.created_at ASC,x.id",
    AMOUNT_DESC: "ABS(x.amount_minor) DESC,x.date DESC,x.id",
    AMOUNT_ASC: "ABS(x.amount_minor) ASC,x.date DESC,x.id",
    CATEGORY: "COALESCE(cv.name,'账户资金变动'),x.date DESC,x.id",
  }[query.sort ?? "DATE_DESC"];
  const rows = await db.getAllAsync<{
    id: string; kind: TransactionItem["kind"]; amount_minor: number; date: string;
    note: string; salary: number; source_name: string | null; destination_name: string | null;
    category_name: string | null; source_id: string | null; destination_id: string | null;
    category_id: string | null; original_id: string | null;
  }>(
    `SELECT x.id,x.kind,x.amount_minor,x.date,x.note,x.salary,x.source_id,x.destination_id,cv.category_id,x.original_id,
      s.name source_name,d.name destination_name,cv.name category_name
     FROM transactions x
     LEFT JOIN accounts s ON s.id=x.source_id
     LEFT JOIN accounts d ON d.id=x.destination_id
     LEFT JOIN category_versions cv ON cv.id=x.category_version_id
     WHERE ${clauses.join(" AND ")} ORDER BY ${order} LIMIT 5000`,
    ...params,
  );
  return rows.map((item) => ({
    id: item.id, kind: item.kind, amountMinor: item.amount_minor, date: item.date,
    note: item.note, salary: item.salary === 1, sourceName: item.source_name,
    destinationName: item.destination_name, categoryName: item.category_name,
    sourceId: item.source_id, destinationId: item.destination_id,
    categoryId: item.category_id, originalId: item.original_id,
  }));
}

export async function loadSnapshot(db: SQLiteDatabase): Promise<Snapshot> {
  const settings = await getSettings(db);
  const cycle = await ensureCycleForDate(db, today());
  const accounts = await db.getAllAsync<{
    id: string;
    name: string;
    type_id: "bank" | "cash" | "investment";
    type_name: string;
    roles: string;
    hidden: number;
    valuation_mode: number;
    balance_minor: number;
  }>(`
    SELECT a.id,a.name,a.type_id,t.name type_name,a.roles,a.hidden,a.valuation_mode,
      CASE WHEN a.valuation_mode=1 AND av.id IS NOT NULL THEN av.value_minor+COALESCE(SUM(m.delta),0) ELSE COALESCE(SUM(m.delta),0) END balance_minor
    FROM accounts a JOIN account_types t ON t.id=a.type_id
    LEFT JOIN account_valuations av ON av.id=(SELECT v.id FROM account_valuations v WHERE v.account_id=a.id ORDER BY v.date DESC,v.created_at DESC LIMIT 1)
    LEFT JOIN movements m ON m.account_id=a.id AND (av.id IS NULL OR m.date>av.date)
    WHERE a.deleted=0 AND a.archived=0
    GROUP BY a.id ORDER BY CASE WHEN instr(a.roles,'PRIMARY_SPENDING')>0 THEN 0 WHEN instr(a.roles,'PRIMARY_SALARY')>0 THEN 1 ELSE 2 END,a.created_at
  `);

  const categories = await db.getAllAsync<{
    id: string;
    kind: "INCOME" | "EXPENSE";
    name: string;
    group_name: string;
  }>(`
    SELECT c.id,c.kind,cv.name,cv.group_name
    FROM categories c JOIN category_versions cv ON cv.category_id=c.id
    WHERE c.archived=0 AND cv.version=(SELECT MAX(v.version) FROM category_versions v WHERE v.category_id=c.id)
    ORDER BY c.kind DESC,cv.group_name,cv.name
  `);

  const transactions = await db.getAllAsync<{
    id: string;
    kind: TransactionItem["kind"];
    amount_minor: number;
    date: string;
    note: string;
    salary: number;
    source_name: string | null;
    destination_name: string | null;
    category_name: string | null;
    source_id: string | null;
    destination_id: string | null;
    category_id: string | null;
    original_id: string | null;
  }>(`
    SELECT x.id,x.kind,x.amount_minor,x.date,x.note,x.salary,x.source_id,x.destination_id,cv.category_id,x.original_id,
      s.name source_name,d.name destination_name,cv.name category_name
    FROM transactions x
    LEFT JOIN accounts s ON s.id=x.source_id
    LEFT JOIN accounts d ON d.id=x.destination_id
    LEFT JOIN category_versions cv ON cv.id=x.category_version_id
    WHERE x.deleted=0
    ORDER BY x.date DESC,x.created_at DESC LIMIT 100
  `);

  const budgetVersion = await db.getFirstAsync<{ items: string }>(
    "SELECT items FROM budget_versions WHERE scope='CYCLE' AND cycle_id=? ORDER BY version DESC LIMIT 1",
    cycle.id,
  );
  const rawBudget = budgetVersion
    ? (JSON.parse(budgetVersion.items) as {
        categoryId: string;
        amountMinor: number;
        enabled?: boolean;
      }[])
    : [];
  const actualRows = await db.getAllAsync<{
    category_id: string;
    actual_minor: number;
  }>(
    `
    SELECT cv.category_id,
      COALESCE(SUM(CASE WHEN x.kind='EXPENSE' THEN x.amount_minor WHEN x.kind='REFUND' THEN -x.amount_minor ELSE 0 END),0) actual_minor
    FROM transactions x JOIN category_versions cv ON cv.id=x.category_version_id
    WHERE x.deleted=0 AND x.cycle_id=? AND x.kind IN('EXPENSE','REFUND')
    GROUP BY cv.category_id
  `,
    cycle.id,
  );
  const actualMap = new Map(
    actualRows.map((row) => [row.category_id, row.actual_minor]),
  );
  const categoryMap = new Map(
    categories.map((category) => [category.id, category]),
  );
  const budgets = rawBudget
    .filter((item) => item.enabled !== false)
    .map((item) => {
      const category = categoryMap.get(item.categoryId);
      return {
        categoryId: item.categoryId,
        name: category?.name ?? "已归档分类",
        groupName: category?.group_name ?? "其他",
        budgetMinor: item.amountMinor,
        actualMinor: actualMap.get(item.categoryId) ?? 0,
      };
    })
    .sort(
      (a, b) =>
        b.actualMinor / Math.max(b.budgetMinor, 1) -
        a.actualMinor / Math.max(a.budgetMinor, 1),
    );

  const totals = await db.getFirstAsync<{
    income: number;
    expense: number;
    refund: number;
  }>(
    `
    SELECT
      COALESCE(SUM(CASE WHEN kind='INCOME' THEN amount_minor ELSE 0 END),0) income,
      COALESCE(SUM(CASE WHEN kind='EXPENSE' THEN amount_minor ELSE 0 END),0) expense,
      COALESCE(SUM(CASE WHEN kind='REFUND' THEN amount_minor ELSE 0 END),0) refund
    FROM transactions WHERE deleted=0 AND cycle_id=?
  `,
    cycle.id,
  );
  const mappedAccounts: Account[] = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    typeId: account.type_id,
    typeName: account.type_name,
    roles: JSON.parse(account.roles),
    hidden: account.hidden === 1,
    valuationMode: account.valuation_mode === 1,
    balanceMinor: account.balance_minor,
  }));
  const budgetMinor = budgets.reduce((sum, item) => sum + item.budgetMinor, 0);
  const grossExpenseMinor = totals?.expense ?? 0;
  const refundMinor = totals?.refund ?? 0;
  const netExpenseMinor = grossExpenseMinor - refundMinor;
  const remainingBudgetMinor = budgetMinor - netExpenseMinor;
  const spendingBalanceMinor =
    mappedAccounts.find((account) => account.roles.includes("PRIMARY_SPENDING"))
      ?.balanceMinor ?? 0;
  const tomorrow = addDays(today(), 1);
  const quickExpense = await db.getFirstAsync<{ today_expense: number; three_day_expense: number }>(
    `SELECT
      COALESCE(SUM(CASE WHEN date>=? THEN CASE WHEN kind='EXPENSE' THEN amount_minor WHEN kind='REFUND' THEN -amount_minor ELSE 0 END ELSE 0 END),0) today_expense,
      COALESCE(SUM(CASE WHEN date>=? THEN CASE WHEN kind='EXPENSE' THEN amount_minor WHEN kind='REFUND' THEN -amount_minor ELSE 0 END ELSE 0 END),0) three_day_expense
     FROM transactions WHERE deleted=0 AND date<?`,
    today(), addDays(today(), -2), tomorrow,
  );
  const receivableSummary = await db.getFirstAsync<{ outstanding: number; overdue: number; due_today: number }>(
    "SELECT COALESCE(SUM(outstanding_minor),0) outstanding,COALESCE(SUM(CASE WHEN due_date IS NOT NULL AND due_date<? THEN 1 ELSE 0 END),0) overdue,COALESCE(SUM(CASE WHEN due_date=? THEN 1 ELSE 0 END),0) due_today FROM receivables WHERE status='OPEN'",
    today(), today(),
  );
  const totalAssetsMinor = mappedAccounts.reduce(
    (sum, account) => sum + account.balanceMinor,
    0,
  );

  return {
    settings,
    accounts: mappedAccounts,
    categories: categories.map((category) => ({
      ...category,
      groupName: category.group_name,
    })),
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      kind: transaction.kind,
      amountMinor: transaction.amount_minor,
      date: transaction.date,
      note: transaction.note,
      salary: transaction.salary === 1,
      sourceName: transaction.source_name,
      destinationName: transaction.destination_name,
      categoryName: transaction.category_name,
      sourceId: transaction.source_id,
      destinationId: transaction.destination_id,
      categoryId: transaction.category_id,
      originalId: transaction.original_id,
    })),
    budgets,
    cycle,
    summary: {
      incomeMinor: totals?.income ?? 0,
      grossExpenseMinor,
      refundMinor,
      netExpenseMinor,
      budgetMinor,
      remainingBudgetMinor,
      totalAssetsMinor,
      spendingBalanceMinor,
      safeToSpendMinor: Math.max(
        0,
        Math.min(remainingBudgetMinor, spendingBalanceMinor),
      ),
      todayExpenseMinor: quickExpense?.today_expense ?? 0,
      threeDayExpenseMinor: quickExpense?.three_day_expense ?? 0,
      receivableOutstandingMinor: receivableSummary?.outstanding ?? 0,
      receivableOverdueCount: receivableSummary?.overdue ?? 0,
      receivableDueTodayCount: receivableSummary?.due_today ?? 0,
    },
  };
}

async function accountBalance(db: SQLiteDatabase, accountId: string) {
  const row = await db.getFirstAsync<{ balance: number }>(
    `
    SELECT CASE WHEN a.valuation_mode=1 AND av.id IS NOT NULL
      THEN av.value_minor+COALESCE(SUM(m.delta),0) ELSE COALESCE(SUM(m.delta),0) END balance
    FROM accounts a
    LEFT JOIN account_valuations av ON av.id=(SELECT v.id FROM account_valuations v WHERE v.account_id=a.id ORDER BY v.date DESC,v.created_at DESC LIMIT 1)
    LEFT JOIN movements m ON m.account_id=a.id AND (av.id IS NULL OR m.date>av.date)
    WHERE a.id=? GROUP BY a.id`,
    accountId,
  );
  return row?.balance ?? 0;
}

export async function finishOnboarding(
  db: SQLiteDatabase,
  input: {
    budgetBasis: BudgetBasis;
    payday: number;
    amountsVisible: boolean;
    openingBalances: Record<string, number>;
  },
) {
  if (!Number.isInteger(input.payday) || input.payday < 1 || input.payday > 31)
    throw new Error("工资日应为 1—31");
  for (const value of Object.values(input.openingBalances)) {
    if (
      !Number.isSafeInteger(value) ||
      value < 0 ||
      value > Number(MAX_SAFE_MONEY)
    )
      throw new Error("期初余额无效");
  }
  const operationId = id("op");
  const now = isoNow();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync("DELETE FROM budget_versions WHERE scope='CYCLE'");
    await tx.runAsync("DELETE FROM cycles");
    await tx.runAsync(
      "UPDATE cycle_rules SET payday=?,basis=? WHERE id='rule-initial'",
      input.payday,
      input.budgetBasis,
    );
    await tx.runAsync(
      "UPDATE settings SET data=?,revision=revision+1 WHERE id=1",
      JSON.stringify({
        ...defaultSettings,
        budgetBasis: input.budgetBasis,
        payday: input.payday,
        amountsVisible: input.amountsVisible,
        onboardingComplete: true,
      }),
    );
    await tx.runAsync(
      "INSERT INTO operations(id,hash,action,result,created_at) VALUES(?,?,?,?,?)",
      operationId,
      operationId,
      "INITIALIZE_LEDGER",
      "{}",
      now,
    );
    for (const [accountId, amountMinor] of Object.entries(
      input.openingBalances,
    )) {
      if (amountMinor === 0) continue;
      const transactionId = id("opening");
      await tx.runAsync(
        `INSERT INTO transactions(
          id,kind,amount_minor,date,source_id,destination_id,category_version_id,cycle_id,original_id,
          salary,note,deleted,revision,operation_id,created_at,updated_at
        ) VALUES(?,'OPENING',?,?,NULL,?,NULL,NULL,NULL,0,'首次设置期初余额',0,1,?,?,?)`,
        transactionId,
        amountMinor,
        today(),
        accountId,
        operationId,
        now,
        now,
      );
    }
  });
  await ensureCycleForDate(db, today());
}

export async function saveCategory(
  db: SQLiteDatabase,
  input: {
    id?: string;
    kind: "INCOME" | "EXPENSE";
    name: string;
    groupName: string;
  },
) {
  const name = input.name.trim(),
    groupName = input.groupName.trim() || "其他";
  if (!name) throw new Error("请输入分类名称");
  const duplicate = await db.getFirstAsync<{ id: string }>(
    `SELECT c.id FROM categories c JOIN category_versions cv ON cv.category_id=c.id WHERE c.kind=? AND c.archived=0 AND lower(cv.name)=lower(?) AND cv.version=(SELECT MAX(v.version) FROM category_versions v WHERE v.category_id=c.id) AND c.id<>?`,
    input.kind,
    name,
    input.id ?? "",
  );
  if (duplicate) throw new Error("同类型下已有同名分类");
  const categoryId = input.id ?? id("category"),
    operationId = id("op"),
    now = isoNow();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      "INSERT INTO operations(id,hash,action,result,created_at) VALUES(?,?,?,?,?)",
      operationId,
      operationId,
      input.id ? "UPDATE_CATEGORY" : "CREATE_CATEGORY",
      "{}",
      now,
    );
    if (input.id) {
      const previous = await tx.getFirstAsync<{ version: number }>(
        "SELECT MAX(version) version FROM category_versions WHERE category_id=?",
        input.id,
      );
      if (!previous) throw new Error("分类不存在");
      await tx.runAsync(
        "UPDATE categories SET revision=revision+1 WHERE id=?",
        input.id,
      );
      await tx.runAsync(
        "INSERT INTO category_versions(id,category_id,version,name,group_name,created_at) VALUES(?,?,?,?,?,?)",
        id("category-version"),
        input.id,
        (previous.version ?? 0) + 1,
        name,
        groupName,
        now,
      );
    } else {
      await tx.runAsync(
        "INSERT INTO categories(id,kind,archived,revision) VALUES(?,?,0,1)",
        categoryId,
        input.kind,
      );
      await tx.runAsync(
        "INSERT INTO category_versions(id,category_id,version,name,group_name,created_at) VALUES(?,?,1,?,?,?)",
        id("category-version"),
        categoryId,
        name,
        groupName,
        now,
      );
    }
    await tx.runAsync(
      "INSERT INTO audit(id,operation_id,entity,entity_id,before_data,after_data,reason,created_at) VALUES(?,?,?,?,?,?,?,?)",
      id("audit"),
      operationId,
      "categories",
      categoryId,
      null,
      JSON.stringify(input),
      input.id ? "用户修改分类" : "用户新增分类",
      now,
    );
  });
  return categoryId;
}
export async function archiveCategory(db: SQLiteDatabase, categoryId: string) {
  const category = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM categories WHERE id=? AND archived=0",
    categoryId,
  );
  if (!category) throw new Error("分类不存在");
  await db.runAsync(
    "UPDATE categories SET archived=1,revision=revision+1 WHERE id=?",
    categoryId,
  );
}
export async function saveCycleBudget(
  db: SQLiteDatabase,
  cycleId: string,
  items: { categoryId: string; amountMinor: number; enabled?: boolean }[],
  updateDefault: boolean,
) {
  if (!items.length) throw new Error("请至少保留一个预算分类");
  for (const item of items) {
    if (
      !Number.isSafeInteger(item.amountMinor) ||
      item.amountMinor < 0 ||
      item.amountMinor > Number(MAX_SAFE_MONEY)
    ) {
      throw new Error("预算金额无效");
    }
  }
  const now = isoNow();
  const payload = JSON.stringify(items);
  await db.withExclusiveTransactionAsync(async (tx) => {
    const cycle = await tx.getFirstAsync<{ id: string }>(
      "SELECT id FROM cycles WHERE id=?",
      cycleId,
    );
    if (!cycle) throw new Error("当前预算周期不存在");
    const latest = await tx.getFirstAsync<{ id: string; version: number }>(
      "SELECT id,version FROM budget_versions WHERE scope='CYCLE' AND cycle_id=? ORDER BY version DESC LIMIT 1",
      cycleId,
    );
    await tx.runAsync(
      "INSERT INTO budget_versions(id,scope,cycle_id,version,items,reason,source_id,created_at) VALUES(?,'CYCLE',?,?,?,?,?,?)",
      id("budget"),
      cycleId,
      (latest?.version ?? 0) + 1,
      payload,
      "用户修改当前周期预算",
      latest?.id ?? null,
      now,
    );
    if (updateDefault) {
      const previous = await tx.getFirstAsync<{ id: string; version: number }>(
        "SELECT id,version FROM budget_versions WHERE scope='DEFAULT' ORDER BY version DESC LIMIT 1",
      );
      await tx.runAsync(
        "INSERT INTO budget_versions(id,scope,cycle_id,version,items,reason,source_id,created_at) VALUES(?,'DEFAULT',NULL,?,?,?,?,?)",
        id("budget"),
        (previous?.version ?? 0) + 1,
        payload,
        "从当前周期同步",
        previous?.id ?? null,
        now,
      );
    }
  });
}
export async function createTransaction(
  db: SQLiteDatabase,
  input: NewTransaction,
) {
  if (
    !Number.isSafeInteger(input.amountMinor) ||
    input.amountMinor <= 0 ||
    input.amountMinor > Number(MAX_SAFE_MONEY)
  ) {
    throw new Error("金额无效或超出允许范围");
  }
  if (input.kind === "INCOME" && (!input.destinationId || !input.categoryId))
    throw new Error("请选择收款账户和收入分类");
  if (input.kind === "EXPENSE" && (!input.sourceId || !input.categoryId))
    throw new Error("请选择付款账户和支出分类");
  if (
    input.kind === "TRANSFER" &&
    (!input.sourceId ||
      !input.destinationId ||
      input.sourceId === input.destinationId)
  ) {
    throw new Error("请选择两个不同的转出和转入账户");
  }
  if (input.sourceId) {
    const balance = await accountBalance(db, input.sourceId);
    if (balance < input.amountMinor)
      throw new Error(
        `账户余额不足，还差 ${((input.amountMinor - balance) / 100).toFixed(2)} 元`,
      );
  }

  validDate(input.date);
  const cycle =
    input.kind === "TRANSFER" ? null : await ensureCycleForDate(db, input.date);
  const categoryVersion = input.categoryId
    ? await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM category_versions WHERE category_id=? ORDER BY version DESC LIMIT 1",
        input.categoryId,
      )
    : null;
  if (input.categoryId && !categoryVersion) throw new Error("所选分类已不可用");

  const operationId = id("op");
  const transactionId = id("tx");
  const now = isoNow();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      "INSERT INTO operations(id,hash,action,result,created_at) VALUES(?,?,?,?,?)",
      operationId,
      transactionId,
      "CREATE_TRANSACTION",
      "{}",
      now,
    );
    await tx.runAsync(
      `INSERT INTO transactions(
        id,kind,amount_minor,date,source_id,destination_id,category_version_id,cycle_id,original_id,
        salary,note,deleted,revision,operation_id,created_at,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,NULL,?,?,0,1,?,?,?)`,
      transactionId,
      input.kind,
      input.amountMinor,
      input.date,
      input.kind === "INCOME" ? null : (input.sourceId ?? null),
      input.kind === "EXPENSE" ? null : (input.destinationId ?? null),
      categoryVersion?.id ?? null,
      cycle?.id ?? null,
      input.kind === "INCOME" && input.salary ? 1 : 0,
      input.note?.trim() ?? "",
      operationId,
      now,
      now,
    );
  });
  return transactionId;
}


export type ReceivableRepayment = {
  id: string;
  amountMinor: number;
  destinationAccountName: string;
  date: string;
  note: string;
};
export type ReceivableItem = {
  id: string;
  person: string;
  principalMinor: number;
  outstandingMinor: number;
  sourceAccountId: string;
  sourceAccountName: string;
  defaultReturnAccountId: string | null;
  lentDate: string;
  dueDate: string | null;
  status: "OPEN" | "SETTLED";
  note: string;
  revision: number;
  repayments: ReceivableRepayment[];
};
export async function loadReceivables(db: SQLiteDatabase): Promise<ReceivableItem[]> {
  const rows = await db.getAllAsync<{
    id:string;person:string;principal_minor:number;outstanding_minor:number;source_account_id:string;
    source_account_name:string;default_return_account_id:string|null;lent_date:string;due_date:string|null;
    status:"OPEN"|"SETTLED";note:string;revision:number;
  }>("SELECT r.id,r.person,r.principal_minor,r.outstanding_minor,r.source_account_id,a.name source_account_name,r.default_return_account_id,r.lent_date,r.due_date,r.status,r.note,r.revision FROM receivables r JOIN accounts a ON a.id=r.source_account_id ORDER BY CASE r.status WHEN 'OPEN' THEN 0 ELSE 1 END,COALESCE(r.due_date,'9999-12-31'),r.created_at DESC");
  return Promise.all(rows.map(async (row) => ({
    id:row.id, person:row.person, principalMinor:row.principal_minor, outstandingMinor:row.outstanding_minor,
    sourceAccountId:row.source_account_id, sourceAccountName:row.source_account_name,
    defaultReturnAccountId:row.default_return_account_id, lentDate:row.lent_date, dueDate:row.due_date,
    status:row.status, note:row.note, revision:row.revision,
    repayments:(await db.getAllAsync<{id:string;amount_minor:number;destination_account_name:string;date:string;note:string}>(
      "SELECT p.id,p.amount_minor,a.name destination_account_name,p.date,p.note FROM receivable_repayments p JOIN accounts a ON a.id=p.destination_account_id WHERE p.receivable_id=? ORDER BY p.date DESC,p.created_at DESC", row.id
    )).map((item) => ({ id:item.id, amountMinor:item.amount_minor, destinationAccountName:item.destination_account_name, date:item.date, note:item.note })),
  })));
}
export async function createReceivable(db: SQLiteDatabase, input: {
  person:string; amountMinor:number; sourceAccountId:string; defaultReturnAccountId?:string;
  lentDate:string; dueDate?:string; note?:string;
}) {
  const person=input.person.trim();
  if (!person || person.length>80) throw new Error("请填写对方名称（80字以内）");
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor<=0 || input.amountMinor>Number(MAX_SAFE_MONEY)) throw new Error("借出金额无效");
  validDate(input.lentDate);
  if (input.lentDate>today()) throw new Error("借出日期不能晚于今天");
  if (input.dueDate) { validDate(input.dueDate); if(input.dueDate<input.lentDate) throw new Error("预计归还日期不能早于借出日期"); }
  const balance=await accountBalance(db,input.sourceAccountId);
  if (balance<input.amountMinor) throw new Error("借出账户余额不足");
  const now=isoNow(),operationId=id("op"),transactionId=id("tx"),receivableId=id("receivable");
  await db.withExclusiveTransactionAsync(async tx=>{
    await tx.runAsync("INSERT INTO operations(id,hash,action,result,created_at) VALUES(?,?,?,?,?)",operationId,transactionId,"CREATE_RECEIVABLE","{}",now);
    await tx.runAsync("INSERT INTO transactions(id,kind,amount_minor,date,source_id,destination_id,category_version_id,cycle_id,original_id,salary,note,deleted,revision,operation_id,created_at,updated_at) VALUES(?,'ADJUSTMENT',?, ?,NULL,?,NULL,NULL,NULL,0,?,0,1,?,?,?)",transactionId,-input.amountMinor,input.lentDate,input.sourceAccountId,"借给 "+person+(input.note?.trim()?" · "+input.note.trim():""),operationId,now,now);
    await tx.runAsync("INSERT INTO receivables(id,person,principal_minor,outstanding_minor,source_account_id,default_return_account_id,lent_date,due_date,status,note,outbound_transaction_id,revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,1,?,?)",receivableId,person,input.amountMinor,input.amountMinor,input.sourceAccountId,input.defaultReturnAccountId||null,input.lentDate,input.dueDate||null,"OPEN",input.note?.trim()??"",transactionId,now,now);
  });
  return receivableId;
}
export async function repayReceivable(db: SQLiteDatabase,input:{
  id:string; revision:number; amountMinor:number; destinationAccountId:string; date:string; note?:string;
}) {
  const row=await db.getFirstAsync<{person:string;outstanding_minor:number;lent_date:string;status:string;revision:number}>("SELECT person,outstanding_minor,lent_date,status,revision FROM receivables WHERE id=?",input.id);
  if(!row||row.status!=="OPEN") throw new Error("待收款已结清或不存在");
  if(row.revision!==input.revision) throw new Error("记录已更新，请刷新");
  if(!Number.isSafeInteger(input.amountMinor)||input.amountMinor<=0||input.amountMinor>row.outstanding_minor) throw new Error("归还金额无效或超过待收金额");
  validDate(input.date); if(input.date<row.lent_date||input.date>today()) throw new Error("归还日期需在借出日期至今天之间");
  const now=isoNow(),operationId=id("op"),transactionId=id("tx"),repaymentId=id("repayment"),outstanding=row.outstanding_minor-input.amountMinor;
  await db.withExclusiveTransactionAsync(async tx=>{
    await tx.runAsync("INSERT INTO operations(id,hash,action,result,created_at) VALUES(?,?,?,?,?)",operationId,transactionId,"REPAY_RECEIVABLE","{}",now);
    await tx.runAsync("INSERT INTO transactions(id,kind,amount_minor,date,source_id,destination_id,category_version_id,cycle_id,original_id,salary,note,deleted,revision,operation_id,created_at,updated_at) VALUES(?,'ADJUSTMENT',?, ?,NULL,?,NULL,NULL,NULL,0,?,0,1,?,?,?)",transactionId,input.amountMinor,input.date,input.destinationAccountId,row.person+" 归还"+(input.note?.trim()?" · "+input.note.trim():""),operationId,now,now);
    await tx.runAsync("INSERT INTO receivable_repayments(id,receivable_id,amount_minor,destination_account_id,date,transaction_id,note,created_at) VALUES(?,?,?,?,?,?,?,?)",repaymentId,input.id,input.amountMinor,input.destinationAccountId,input.date,transactionId,input.note?.trim()??"",now);
    await tx.runAsync("UPDATE receivables SET outstanding_minor=?,status=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?",outstanding,outstanding===0?"SETTLED":"OPEN",now,input.id,input.revision);
  });
  return repaymentId;
}

export type BillOccurrenceItem = {
  id: string;
  billId: string;
  name: string;
  amountMinor: number;
  accountId: string;
  accountName: string;
  categoryId: string;
  categoryName: string;
  dueDate: string;
  frequency: "MONTHLY" | "WEEKLY";
};
function nextBillDate(
  frequency: "MONTHLY" | "WEEKLY",
  day: number,
  from: string,
) {
  validDate(from);
  const d = new Date(`${from}T00:00:00Z`);
  if (frequency === "MONTHLY") {
    let candidate = monthDay(d.getUTCFullYear(), d.getUTCMonth(), day);
    if (candidate < from)
      candidate = monthDay(d.getUTCFullYear(), d.getUTCMonth() + 1, day);
    return candidate;
  }
  const weekday = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  return addDays(from, (day - weekday + 7) % 7);
}
export async function saveBill(
  db: SQLiteDatabase,
  input: {
    name: string;
    amountMinor: number;
    accountId: string;
    categoryId: string;
    frequency: "MONTHLY" | "WEEKLY";
    day: number;
  },
) {
  const name = input.name.trim();
  if (!name) throw new Error("请输入账单名称");
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0)
    throw new Error("账单金额无效");
  const max = input.frequency === "MONTHLY" ? 31 : 7;
  if (!Number.isInteger(input.day) || input.day < 1 || input.day > max)
    throw new Error(
      input.frequency === "MONTHLY" ? "每月日期应为 1—31" : "星期应为 1—7",
    );
  const billId = id("bill");
  const due = nextBillDate(input.frequency, input.day, today());
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      "INSERT INTO bills(id,name,amount_minor,account_id,category_id,frequency,day,start_date,enabled,revision) VALUES(?,?,?,?,?,?,?,?,1,1)",
      billId,
      name,
      input.amountMinor,
      input.accountId,
      input.categoryId,
      input.frequency,
      input.day,
      today(),
    );
    await tx.runAsync(
      "INSERT INTO bill_occurrences(id,bill_id,due_date,name,amount_minor,account_id,category_id,status) VALUES(?,?,?,?,?,?,?,'PENDING')",
      id("bill-due"),
      billId,
      due,
      name,
      input.amountMinor,
      input.accountId,
      input.categoryId,
    );
  });
  return billId;
}
export async function loadPendingBills(
  db: SQLiteDatabase,
): Promise<BillOccurrenceItem[]> {
  const bills = await db.getAllAsync<{
    id: string;
    name: string;
    amount_minor: number;
    account_id: string;
    category_id: string;
    frequency: "MONTHLY" | "WEEKLY";
    day: number;
  }>(
    "SELECT id,name,amount_minor,account_id,category_id,frequency,day FROM bills WHERE enabled=1",
  );
  for (const bill of bills) {
    const pending = await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM bill_occurrences WHERE bill_id=? AND status='PENDING' ORDER BY due_date LIMIT 1",
      bill.id,
    );
    if (!pending) {
      const due = nextBillDate(bill.frequency, bill.day, today());
      await db.runAsync(
        "INSERT OR IGNORE INTO bill_occurrences(id,bill_id,due_date,name,amount_minor,account_id,category_id,status) VALUES(?,?,?,?,?,?,?,'PENDING')",
        id("bill-due"),
        bill.id,
        due,
        bill.name,
        bill.amount_minor,
        bill.account_id,
        bill.category_id,
      );
    }
  }
  return db.getAllAsync<BillOccurrenceItem>(
    `SELECT o.id,o.bill_id billId,o.name,o.amount_minor amountMinor,o.account_id accountId,a.name accountName,o.category_id categoryId,cv.name categoryName,o.due_date dueDate,b.frequency FROM bill_occurrences o JOIN bills b ON b.id=o.bill_id JOIN accounts a ON a.id=o.account_id JOIN category_versions cv ON cv.category_id=o.category_id AND cv.version=(SELECT MAX(v.version) FROM category_versions v WHERE v.category_id=o.category_id) WHERE o.status='PENDING' ORDER BY o.due_date,o.name`,
  );
}
async function createNextBillOccurrence(
  tx: SQLiteDatabase,
  occurrence: {
    bill_id: string;
    due_date: string;
    name: string;
    amount_minor: number;
    account_id: string;
    category_id: string;
    frequency: "MONTHLY" | "WEEKLY";
    day: number;
  },
) {
  const next = nextBillDate(
    occurrence.frequency,
    occurrence.day,
    addDays(occurrence.due_date, 1),
  );
  await tx.runAsync(
    "INSERT OR IGNORE INTO bill_occurrences(id,bill_id,due_date,name,amount_minor,account_id,category_id,status) VALUES(?,?,?,?,?,?,?,'PENDING')",
    id("bill-due"),
    occurrence.bill_id,
    next,
    occurrence.name,
    occurrence.amount_minor,
    occurrence.account_id,
    occurrence.category_id,
  );
}
export async function completeBill(
  db: SQLiteDatabase,
  occurrenceId: string,
  actualDate: string,
) {
  validDate(actualDate);
  const o = await db.getFirstAsync<{
    bill_id: string;
    due_date: string;
    name: string;
    amount_minor: number;
    account_id: string;
    category_id: string;
    frequency: "MONTHLY" | "WEEKLY";
    day: number;
  }>(
    `SELECT o.bill_id,o.due_date,o.name,o.amount_minor,o.account_id,o.category_id,b.frequency,b.day FROM bill_occurrences o JOIN bills b ON b.id=o.bill_id WHERE o.id=? AND o.status='PENDING'`,
    occurrenceId,
  );
  if (!o) throw new Error("待办账单不存在");
  const balance = await accountBalance(db, o.account_id);
  if (balance < o.amount_minor)
    throw new Error(
      `付款账户余额不足，还差 ${((o.amount_minor - balance) / 100).toFixed(2)} 元`,
    );
  const cv = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM category_versions WHERE category_id=? ORDER BY version DESC LIMIT 1",
    o.category_id,
  );
  if (!cv) throw new Error("账单分类不可用");
  const cycle = await ensureCycleForDate(db, actualDate);
  const op = id("op"),
    txid = id("tx"),
    now = isoNow();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      "INSERT INTO operations(id,hash,action,result,created_at) VALUES(?,?,?,?,?)",
      op,
      txid,
      "COMPLETE_BILL",
      "{}",
      now,
    );
    await tx.runAsync(
      `INSERT INTO transactions(id,kind,amount_minor,date,source_id,destination_id,category_version_id,cycle_id,original_id,salary,note,deleted,revision,operation_id,created_at,updated_at) VALUES(?,'EXPENSE',?,?,?,NULL,?,?,NULL,0,?,0,1,?,?,?)`,
      txid,
      o.amount_minor,
      actualDate,
      o.account_id,
      cv.id,
      cycle.id,
      `固定账单：${o.name}`,
      op,
      now,
      now,
    );
    await tx.runAsync(
      "UPDATE bill_occurrences SET status='PAID',transaction_id=? WHERE id=?",
      txid,
      occurrenceId,
    );
    await createNextBillOccurrence(tx as unknown as SQLiteDatabase, o);
  });
  return txid;
}
export async function skipBill(db: SQLiteDatabase, occurrenceId: string) {
  const o = await db.getFirstAsync<{
    bill_id: string;
    due_date: string;
    name: string;
    amount_minor: number;
    account_id: string;
    category_id: string;
    frequency: "MONTHLY" | "WEEKLY";
    day: number;
  }>(
    `SELECT o.bill_id,o.due_date,o.name,o.amount_minor,o.account_id,o.category_id,b.frequency,b.day FROM bill_occurrences o JOIN bills b ON b.id=o.bill_id WHERE o.id=? AND o.status='PENDING'`,
    occurrenceId,
  );
  if (!o) throw new Error("待办账单不存在");
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      "UPDATE bill_occurrences SET status='SKIPPED' WHERE id=?",
      occurrenceId,
    );
    await createNextBillOccurrence(tx as unknown as SQLiteDatabase, o);
  });
}
export type SalaryAllocationInput = {
  salaryId: string;
  sourceId: string;
  spendingId: string;
  savingsId?: string;
  spendingMinor: number;
  savingsMinor: number;
  calculation: Record<string, unknown>;
};

export async function executeSalaryAllocation(
  db: SQLiteDatabase,
  input: SalaryAllocationInput,
) {
  const salary = await db.getFirstAsync<{ id: string; amount_minor: number }>(
    "SELECT id,amount_minor FROM transactions WHERE id=? AND kind='INCOME' AND salary=1 AND deleted=0",
    input.salaryId,
  );
  if (!salary) throw new Error("请选择一笔有效的工资收入");
  for (const amount of [input.spendingMinor, input.savingsMinor])
    if (
      !Number.isSafeInteger(amount) ||
      amount < 0 ||
      amount > Number(MAX_SAFE_MONEY)
    )
      throw new Error("分配金额无效");
  const total = input.spendingMinor + input.savingsMinor;
  if (total <= 0) throw new Error("请至少分配一笔资金");
  if (
    input.sourceId === input.spendingId ||
    (input.savingsId && input.sourceId === input.savingsId)
  )
    throw new Error("转入账户不能与工资账户相同");
  if (
    input.spendingMinor > 0 &&
    input.savingsMinor > 0 &&
    input.spendingId === input.savingsId
  )
    throw new Error("消费账户与储蓄账户应不同");
  const balance = await accountBalance(db, input.sourceId);
  if (balance < total)
    throw new Error(
      `工资账户余额不足，还差 ${((total - balance) / 100).toFixed(2)} 元`,
    );
  const planId = id("allocation");
  const operationId = id("op");
  const now = isoNow();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      "INSERT INTO operations(id,hash,action,result,created_at) VALUES(?,?,?,?,?)",
      operationId,
      operationId,
      "EXECUTE_SALARY_ALLOCATION",
      "{}",
      now,
    );
    await tx.runAsync(
      "INSERT INTO allocation_plans(id,salary_id,data,status,revision,created_at,deleted) VALUES(?,?,?,'RECORDED',1,?,0)",
      planId,
      input.salaryId,
      JSON.stringify(input.calculation),
      now,
    );
    for (const part of [
      {
        destinationId: input.spendingId,
        amountMinor: input.spendingMinor,
        label: "工资分配至消费账户",
      },
      {
        destinationId: input.savingsId,
        amountMinor: input.savingsMinor,
        label: "工资分配至储蓄账户",
      },
    ]) {
      if (!part.destinationId || part.amountMinor <= 0) continue;
      const transactionId = id("transfer");
      await tx.runAsync(
        `INSERT INTO transactions(id,kind,amount_minor,date,source_id,destination_id,category_version_id,cycle_id,original_id,salary,note,deleted,revision,operation_id,created_at,updated_at) VALUES(?,'TRANSFER',?,?,?, ?,NULL,NULL,NULL,0,?,0,1,?,?,?)`,
        transactionId,
        part.amountMinor,
        today(),
        input.sourceId,
        part.destinationId,
        part.label,
        operationId,
        now,
        now,
      );
      await tx.runAsync(
        "INSERT INTO allocation_items(id,plan_id,source_id,destination_id,amount_minor,transaction_id,status) VALUES(?,?,?,?,?,?,'RECORDED')",
        id("allocation-item"),
        planId,
        input.sourceId,
        part.destinationId,
        part.amountMinor,
        transactionId,
      );
    }
  });
  return planId;
}
export type AnalyticsSnapshot = {
  totals: {
    incomeMinor: number;
    grossExpenseMinor: number;
    refundMinor: number;
    netExpenseMinor: number;
    savingsRate: number;
  };
  categories: {
    id: string;
    name: string;
    groupName: string;
    grossMinor: number;
    refundMinor: number;
    netMinor: number;
  }[];
  incomeCategories: { id: string; name: string; amountMinor: number }[];
  daily: { date: string; incomeMinor: number; expenseMinor: number }[];
};

export async function loadAnalytics(
  db: SQLiteDatabase,
  start: string,
  end: string,
): Promise<AnalyticsSnapshot> {
  validDate(start);
  validDate(end);
  if (start >= end) throw new Error("统计开始日期必须早于结束日期");
  const totals = await db.getFirstAsync<{
    income: number;
    expense: number;
    refund: number;
  }>(
    "SELECT COALESCE(SUM(CASE WHEN kind='INCOME' THEN amount_minor ELSE 0 END),0) income, " +
      "COALESCE(SUM(CASE WHEN kind='EXPENSE' THEN amount_minor ELSE 0 END),0) expense, " +
      "COALESCE(SUM(CASE WHEN kind='REFUND' THEN amount_minor ELSE 0 END),0) refund " +
      "FROM transactions WHERE deleted=0 AND date>=? AND date<?",
    start,
    end,
  );
  const categories = await db.getAllAsync<{
    id: string;
    name: string;
    group_name: string;
    gross: number;
    refund: number;
  }>(
    "SELECT cv.id,cv.name,cv.group_name, " +
      "COALESCE(SUM(CASE WHEN x.kind='EXPENSE' THEN x.amount_minor ELSE 0 END),0) gross, " +
      "COALESCE(SUM(CASE WHEN x.kind='REFUND' THEN x.amount_minor ELSE 0 END),0) refund " +
      "FROM transactions x JOIN category_versions cv ON cv.id=x.category_version_id " +
      "WHERE x.deleted=0 AND x.kind IN('EXPENSE','REFUND') AND x.date>=? AND x.date<? " +
      "GROUP BY cv.id HAVING gross>0 ORDER BY gross DESC",
    start,
    end,
  );
  const incomeCategories = await db.getAllAsync<{
    id: string;
    name: string;
    amount: number;
  }>(
    "SELECT cv.id,cv.name,COALESCE(SUM(x.amount_minor),0) amount " +
      "FROM transactions x JOIN category_versions cv ON cv.id=x.category_version_id " +
      "WHERE x.deleted=0 AND x.kind='INCOME' AND x.date>=? AND x.date<? " +
      "GROUP BY cv.id HAVING amount>0 ORDER BY amount DESC",
    start,
    end,
  );
  const daily = await db.getAllAsync<{
    date: string;
    income: number;
    expense: number;
  }>(
    "SELECT date,COALESCE(SUM(CASE WHEN kind='INCOME' THEN amount_minor ELSE 0 END),0) income, " +
      "COALESCE(SUM(CASE WHEN kind='EXPENSE' THEN amount_minor WHEN kind='REFUND' THEN -amount_minor ELSE 0 END),0) expense " +
      "FROM transactions WHERE deleted=0 AND kind IN('INCOME','EXPENSE','REFUND') AND date>=? AND date<? " +
      "GROUP BY date ORDER BY date",
    start,
    end,
  );
  const incomeMinor = totals?.income ?? 0;
  const grossExpenseMinor = totals?.expense ?? 0;
  const refundMinor = totals?.refund ?? 0;
  const netExpenseMinor = grossExpenseMinor - refundMinor;
  return {
    totals: {
      incomeMinor,
      grossExpenseMinor,
      refundMinor,
      netExpenseMinor,
      savingsRate:
        incomeMinor > 0 ? (incomeMinor - netExpenseMinor) / incomeMinor : 0,
    },
    categories: categories.map((item) => ({
      id: item.id,
      name: item.name,
      groupName: item.group_name,
      grossMinor: item.gross,
      refundMinor: item.refund,
      netMinor: item.gross - item.refund,
    })),
    incomeCategories: incomeCategories.map((item) => ({
      id: item.id,
      name: item.name,
      amountMinor: item.amount,
    })),
    daily: daily.map((item) => ({
      date: item.date,
      incomeMinor: item.income,
      expenseMinor: item.expense,
    })),
  };
}
export type UpdateTransactionInput = NewTransaction & { id: string };

export async function updateTransaction(
  db: SQLiteDatabase,
  input: UpdateTransactionInput,
) {
  const before = await db.getFirstAsync<{
    id: string;
    kind: string;
    amount_minor: number;
    source_id: string | null;
    destination_id: string | null;
  }>(
    "SELECT id,kind,amount_minor,source_id,destination_id FROM transactions WHERE id=? AND deleted=0",
    input.id,
  );
  if (!before || !["INCOME", "EXPENSE", "TRANSFER"].includes(before.kind))
    throw new Error("该记录不能修改");
  if (
    !Number.isSafeInteger(input.amountMinor) ||
    input.amountMinor <= 0 ||
    input.amountMinor > Number(MAX_SAFE_MONEY)
  )
    throw new Error("金额无效或超出允许范围");
  validDate(input.date);
  if (input.kind === "INCOME" && (!input.destinationId || !input.categoryId))
    throw new Error("请选择收款账户和收入分类");
  if (input.kind === "EXPENSE" && (!input.sourceId || !input.categoryId))
    throw new Error("请选择付款账户和支出分类");
  if (
    input.kind === "TRANSFER" &&
    (!input.sourceId ||
      !input.destinationId ||
      input.sourceId === input.destinationId)
  )
    throw new Error("请选择两个不同的转出和转入账户");
  const refund = await db.getFirstAsync<{ amount: number }>(
    "SELECT COALESCE(SUM(amount_minor),0) amount FROM transactions WHERE original_id=? AND kind='REFUND' AND deleted=0",
    input.id,
  );
  if ((refund?.amount ?? 0) > 0 && input.kind !== "EXPENSE")
    throw new Error("已有退款的支出不能改为其他交易类型");
  if ((refund?.amount ?? 0) > input.amountMinor)
    throw new Error("新金额不能小于已退款金额");
  if (input.sourceId) {
    const available =
      (await accountBalance(db, input.sourceId)) +
      (before.source_id === input.sourceId ? before.amount_minor : 0);
    if (available < input.amountMinor)
      throw new Error(
        `账户余额不足，还差 ${((input.amountMinor - available) / 100).toFixed(2)} 元`,
      );
  }
  const cycle =
    input.kind === "TRANSFER" ? null : await ensureCycleForDate(db, input.date);
  const categoryVersion = input.categoryId
    ? await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM category_versions WHERE category_id=? ORDER BY version DESC LIMIT 1",
        input.categoryId,
      )
    : null;
  if (input.categoryId && !categoryVersion) throw new Error("所选分类已不可用");
  const operationId = id("op");
  const now = isoNow();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      "INSERT INTO operations(id,hash,action,result,created_at) VALUES(?,?,?,?,?)",
      operationId,
      operationId,
      "UPDATE_TRANSACTION",
      "{}",
      now,
    );
    await tx.runAsync(
      `UPDATE transactions SET kind=?,amount_minor=?,date=?,source_id=?,destination_id=?,category_version_id=?,cycle_id=?,salary=?,note=?,revision=revision+1,operation_id=?,updated_at=? WHERE id=?`,
      input.kind,
      input.amountMinor,
      input.date,
      input.kind === "INCOME" ? null : (input.sourceId ?? null),
      input.kind === "EXPENSE" ? null : (input.destinationId ?? null),
      categoryVersion?.id ?? null,
      cycle?.id ?? null,
      input.kind === "INCOME" && input.salary ? 1 : 0,
      input.note?.trim() ?? "",
      operationId,
      now,
      input.id,
    );
    await tx.runAsync(
      "INSERT INTO audit(id,operation_id,entity,entity_id,before_data,after_data,reason,created_at) VALUES(?,?,?,?,?,?,?,?)",
      id("audit"),
      operationId,
      "transactions",
      input.id,
      JSON.stringify(before),
      JSON.stringify(input),
      "用户修改交易",
      now,
    );
  });
}

export async function refundExpense(
  db: SQLiteDatabase,
  originalId: string,
  amountMinor: number,
  date: string,
  note = "",
) {
  if (
    !Number.isSafeInteger(amountMinor) ||
    amountMinor <= 0 ||
    amountMinor > Number(MAX_SAFE_MONEY)
  )
    throw new Error("退款金额无效");
  validDate(date);
  const original = await db.getFirstAsync<{
    id: string;
    amount_minor: number;
    source_id: string;
    category_version_id: string;
  }>(
    "SELECT id,amount_minor,source_id,category_version_id FROM transactions WHERE id=? AND kind='EXPENSE' AND deleted=0",
    originalId,
  );
  if (!original) throw new Error("原支出不存在或不可退款");
  const previous = await db.getFirstAsync<{ amount: number }>(
    "SELECT COALESCE(SUM(amount_minor),0) amount FROM transactions WHERE original_id=? AND kind='REFUND' AND deleted=0",
    originalId,
  );
  const remaining = original.amount_minor - (previous?.amount ?? 0);
  if (amountMinor > remaining)
    throw new Error(`最多还可退款 ${(remaining / 100).toFixed(2)} 元`);
  const cycle = await ensureCycleForDate(db, date);
  const operationId = id("op");
  const transactionId = id("refund");
  const now = isoNow();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      "INSERT INTO operations(id,hash,action,result,created_at) VALUES(?,?,?,?,?)",
      operationId,
      transactionId,
      "REFUND_EXPENSE",
      "{}",
      now,
    );
    await tx.runAsync(
      `INSERT INTO transactions(id,kind,amount_minor,date,source_id,destination_id,category_version_id,cycle_id,original_id,salary,note,deleted,revision,operation_id,created_at,updated_at)
       VALUES(?,'REFUND',?,?,NULL,?,?,?,?,0,?,0,1,?,?,?)`,
      transactionId,
      amountMinor,
      date,
      original.source_id,
      original.category_version_id,
      cycle.id,
      originalId,
      note.trim(),
      operationId,
      now,
      now,
    );
  });
  return transactionId;
}

export async function softDeleteTransaction(
  db: SQLiteDatabase,
  transactionId: string,
  reason = "用户删除交易",
) {
  const before = await db.getFirstAsync<{
    id: string;
    kind: string;
    amount_minor: number;
    destination_id: string | null;
  }>(
    "SELECT id,kind,amount_minor,destination_id FROM transactions WHERE id=? AND deleted=0",
    transactionId,
  );
  if (!before) throw new Error("交易不存在或已删除");
  if (before.kind === "OPENING" || before.kind === "ADJUSTMENT")
    throw new Error("期初余额和校准记录请在账户校准中处理");
  if (
    before.destination_id &&
    ["INCOME", "TRANSFER", "REFUND"].includes(before.kind)
  ) {
    const balance = await accountBalance(db, before.destination_id);
    if (balance < before.amount_minor)
      throw new Error("删除后转入账户将出现负余额，请先转回或校准");
  }
  const operationId = id("op");
  const now = isoNow();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      "INSERT INTO operations(id,hash,action,result,created_at) VALUES(?,?,?,?,?)",
      operationId,
      operationId,
      "DELETE_TRANSACTION",
      "{}",
      now,
    );
    await tx.runAsync(
      "UPDATE transactions SET deleted=1,revision=revision+1,operation_id=?,updated_at=? WHERE id=? OR original_id=?",
      operationId,
      now,
      transactionId,
      transactionId,
    );
    await tx.runAsync(
      "INSERT INTO audit(id,operation_id,entity,entity_id,before_data,after_data,reason,created_at) VALUES(?,?,?,?,?,?,?,?)",
      id("audit"),
      operationId,
      "transactions",
      transactionId,
      JSON.stringify(before),
      JSON.stringify({ deleted: true }),
      reason,
      now,
    );
  });
}
const MAX_SAFE_MONEY = 9_000_000_000_000n;

export async function resetLedger(db: SQLiteDatabase) {
  const deleteOrder = [
    "external_keys",
    "imports",
    "allocation_items",
    "allocation_plans",
    "bill_occurrences",
    "bills",
    "audit",
    "account_valuations",
    "transactions",
    "operations",
    "budget_versions",
    "cycles",
    "cycle_rules",
    "category_versions",
    "categories",
    "accounts",
    "account_types",
    "settings",
  ];
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const table of deleteOrder) await tx.runAsync(`DELETE FROM ${table}`);
  });
  await seed(db);
  await ensureCycleForDate(db, today());
}
