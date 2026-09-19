import { DatabaseSync, backup } from "node:sqlite";
import { randomUUID, createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { schema } from "./schema.mjs";
import { migrations, currentSchema } from "./migrations.mjs";
import { minor, rate, budgetState, decimal, MAX_MONEY } from "./money.mjs";
import {
  today,
  date,
  addDays,
  cycleRange,
  budgetPeriodRange,
  monthDay,
} from "./dates.mjs";
import { seedBudget } from "./seed.mjs";

const id = () => randomUUID();
const now = () => new Date().toISOString();
export const json = (v) =>
  JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x));
const hash = (s) => createHash("sha256").update(s).digest("hex");
function ensure(c, m) {
  if (!c) throw new Error(m);
}
function label(s, name = "名称") {
  ensure(
    typeof s === "string" && s.trim().length > 0 && s.length <= 200,
    `${name}不能为空且最多200字`,
  );
  return s.trim();
}
const safeNote = (s) => {
  ensure(
    typeof (s ?? "") === "string" && (s ?? "").length <= 4000,
    "备注最多4000字",
  );
  return s ?? "";
};

export class Store {
  constructor(filename, clock = today) {
    this.filename = filename;
    this.clock = clock;
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    this.recoverInterrupted();
    this.open();
  }
  open() {
    this.db = new DatabaseSync(this.filename);
    this.db.exec(
      "PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA cache_size=-32768; PRAGMA temp_store=MEMORY;",
    );
    const version = this.db.prepare("PRAGMA user_version").get().user_version;
    ensure(version <= currentSchema, "数据库由更新版本创建，请升级应用");
    if (version === 0) {
      ensure(
        !this.db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
          )
          .get(),
        "未知数据库格式，已停止写入",
      );
      this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db.exec(schema);
        this.db
          .prepare("INSERT INTO schema_migrations VALUES(1,?,?)")
          .run(hash(schema), now());
        this.db.prepare("INSERT INTO settings VALUES(1,?,0)").run(
          json({
            initialized: false,
            payday: 10,
            defaults: {},
            theme: "system",
            locale: "zh-CN",
          }),
        );
        this.db.exec("PRAGMA user_version=1; COMMIT");
      } catch (e) {
        this.db.exec("ROLLBACK");
        throw e;
      }
    } else
      ensure(
        this.one("SELECT checksum FROM schema_migrations WHERE version=1")
          ?.checksum === hash(schema),
        "数据库结构版本校验失败，请使用匹配的应用版本",
      );
    for (const migration of migrations) {
      const applied = this.one(
        "SELECT * FROM schema_migrations WHERE version=?",
        migration.version,
      );
      if (applied) {
        ensure(
          applied.checksum === hash(migration.sql),
          "已发布数据库升级脚本发生变化",
        );
        continue;
      }
      if (version > 0) {
        const dir = path.join(path.dirname(this.filename), "backups");
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(
          dir,
          `SalaryFlow-${Date.now()}-pre-migration-v${migration.version}.sqlite`,
        );
        this.run("VACUUM INTO ?", file);
        const check = new DatabaseSync(file, { readOnly: true });
        try {
          ensure(
            check.prepare("PRAGMA integrity_check").get().integrity_check ===
              "ok",
            "升级前备份失败",
          );
        } finally {
          check.close();
        }
        fs.writeFileSync(
          file + ".json",
          json({
            format: 1,
            kind: "pre-migration",
            schema_version: version,
            created_at: now(),
            checksum: hash(fs.readFileSync(file)),
          }),
        );
      }
      this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db.exec(migration.sql);
        this.run(
          "INSERT INTO schema_migrations VALUES(?,?,?)",
          migration.version,
          hash(migration.sql),
          now(),
        );
        this.db.exec(`PRAGMA user_version=${migration.version}`);
        this.validate();
        this.db.exec("COMMIT");
      } catch (e) {
        this.db.exec("ROLLBACK");
        throw e;
      }
    }
  }
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
  one(sql, ...p) {
    return this.db.prepare(sql).get(...p);
  }
  all(sql, ...p) {
    return this.db.prepare(sql).all(...p);
  }
  run(sql, ...p) {
    return this.db.prepare(sql).run(...p);
  }
  settings() {
    return {
      ...JSON.parse(this.one("SELECT data FROM settings").data),
      revision: this.one("SELECT revision FROM settings").revision,
    };
  }
  setSettings(data) {
    const { revision, ...s } = { ...this.settings(), ...data };
    this.run("UPDATE settings SET data=? WHERE id=1", json(s));
  }
  audit(entity, entityId, before, after, reason = "") {
    this.run(
      "INSERT INTO audit VALUES(?,?,?,?,?,?,?,?)",
      id(),
      this.operation,
      entity,
      entityId,
      before ? json(before) : null,
      after ? json(after) : null,
      safeNote(reason),
      now(),
    );
  }
  command(action, payload = {}, operationId = id()) {
    const allowed = [
      "initialize",
      "saveAccount",
      "saveValuation",
      "archiveAccount",
      "setDefaults",
      "saveCategory",
      "archiveCategory",
      "deleteCategory",
      "record",
      "edit",
      "deleteTransaction",
      "restoreTransaction",
      "calibrate",
      "changeStart",
      "saveBudget",
      "openCycle",
      "settle",
      "reopen",
      "setPayday",
      "adjustCycle",
      "saveSettings",
      "saveBill",
      "toggleBill",
      "deleteBill",
      "processBill",
      "saveAllocation",
      "confirmAllocation",
      "confirmAllocationPlan",
      "cancelAllocation",
      "deleteAllocation",
      "commitImport",
      "revertImport",
      "maintenance",
      "configureBackup",
      "setExpectedIncome",
      "orderAccounts",
      "snoozeBill",
      "createReceivable",
      "repayReceivable",
      "deleteReceivable",
    ];
    ensure(allowed.includes(action), "操作不可用");
    const digest = hash(json({ action, payload }));
    const previous = this.one(
      "SELECT * FROM operations WHERE id=?",
      operationId,
    );
    if (previous) {
      ensure(previous.hash === digest, "操作编号冲突，请重新提交");
      return JSON.parse(previous.result);
    }
    this.db.exec("BEGIN IMMEDIATE");
    this.operation = operationId;
    try {
      this.run(
        "INSERT INTO operations VALUES(?,?,?,?,?)",
        operationId,
        digest,
        action,
        "{}",
        now(),
      );
      const result = this[action](payload) ?? { ok: true };
      this.validate();
      this.run("UPDATE settings SET revision=revision+1 WHERE id=1");
      this.run(
        "UPDATE operations SET result=? WHERE id=?",
        json(result),
        operationId,
      );
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    } finally {
      this.operation = null;
    }
  }
  maintenance() {
    ensure(this.settings().initialized, "请先完成设置");
    const last = this.one("SELECT end FROM cycles ORDER BY end DESC LIMIT 1");
    let s = last?.end;
    while (s && s <= this.clock()) {
      const c = this.ensureCycle(s);
      s = c.end;
    }
    this.ensureCycle(this.clock());
    this.materializeBills();
    this.setSettings({ last_maintenance: this.clock() });
  }
  configureBackup(p) {
    ensure(
      typeof p.directory === "string" && path.isAbsolute(p.directory),
      "备份目录无效",
    );
    const old = this.settings().backup_directory;
    this.setSettings({ backup_directory: p.directory });
    this.audit(
      "settings",
      "1",
      { backup_directory: old },
      { backup_directory: p.directory },
    );
  }
  setExpectedIncome(p) {
    ensure(
      this.one("SELECT id FROM cycles WHERE id=?", p.cycle_id),
      "周期不存在",
    );
    this.assertEditable(null, p.cycle_id);
    const value =
      p.amount_minor == null
        ? null
        : minor(p.amount_minor, { zero: true }).toString();
    const old = this.settings().expected_income ?? {};
    this.setSettings({ expected_income: { ...old, [p.cycle_id]: value } });
    this.audit(
      "expected_income",
      p.cycle_id,
      old[p.cycle_id] ? { amount: old[p.cycle_id] } : null,
      { amount: value },
    );
  }
  orderAccounts(p) {
    const ids = this.all("SELECT id FROM accounts WHERE deleted=0").map(
      (a) => a.id,
    );
    ensure(
      Array.isArray(p.ids) &&
        p.ids.length === ids.length &&
        new Set(p.ids).size === ids.length &&
        p.ids.every((a) => ids.includes(a)),
      "账户排序必须包含所有账户",
    );
    this.setSettings({ account_order: p.ids });
  }
  snoozeBill(p) {
    const b = this.one(
      "SELECT * FROM bill_occurrences WHERE id=? AND status='PENDING'",
      p.id,
    );
    ensure(b, "账单已处理");
    date(p.date);
    ensure(p.date > this.clock(), "延期日期应晚于今天");
    this.run(
      "UPDATE bill_occurrences SET snoozed_to=? WHERE id=?",
      p.date,
      p.id,
    );
    this.audit(
      "bill_occurrence",
      b.id,
      b,
      this.one("SELECT * FROM bill_occurrences WHERE id=?", b.id),
      "延期提醒",
    );
  }
  initialize(p) {
    ensure(!this.settings().initialized, "账本已初始化");
    ensure(
      Array.isArray(p.accounts) &&
        p.accounts.length > 0 &&
        p.accounts.length <= 100,
      "请至少创建一个账户",
    );
    const basis = p.basis ?? "SALARY";
    ensure(["SALARY", "CALENDAR_MONTH"].includes(basis), "预算周期口径无效");
    const payday = basis === "SALARY" ? Number(p.payday) : 1;
    budgetPeriodRange(this.clock(), basis, payday);
    for (const name of ["银行卡", "第三方支付", "现金", "其他"])
      this.run("INSERT INTO account_types(id,name) VALUES(?,?)", id(), name);
    const typeId = this.one("SELECT id FROM account_types LIMIT 1").id;
    const budget = [];
    for (const [group, name, amount] of seedBudget) {
      const c = this.saveCategory({ name, group, kind: "EXPENSE" });
      budget.push({
        category_id: c.id,
        category_version_id: c.version_id,
        amount_minor: String(amount),
        enabled: true,
        note: "",
      });
    }
    for (const name of ["工资", "奖金", "利息", "其他收入"])
      this.saveCategory({ name, group: "收入", kind: "INCOME" });
    const system = this.insertBudget("SYSTEM", null, budget, "系统推荐 v1");
    this.insertBudget(
      "DEFAULT",
      null,
      p.blank ? [] : budget,
      "首次设置",
      system.id,
    );
    this.setSettings({
      initialized: true,
      payday,
      started: date(p.start_date || this.clock()),
      cycle_basis: basis,
    });
    this.run(
      "INSERT INTO cycle_rules(id,effective_from,payday,basis) VALUES(?,?,?,?)",
      id(),
      "1900-01-01",
      payday,
      basis,
    );
    const defaults = {};
    for (const a of p.accounts) {
      const saved = this.saveAccount({
        ...a,
        type_id: typeId,
        start_date: p.start_date || this.clock(),
      });
      for (const role of a.roles || [])
        if (!defaults[role]) defaults[role] = saved.id;
    }
    this.setSettings({ defaults });
    const c = this.ensureCycle(this.clock());
    this.run("UPDATE cycles SET status='OPEN' WHERE id=?", c.id);
    this.audit("ledger", "1", null, this.settings(), "首次设置");
    return { ok: true };
  }
  saveAccount(p) {
    const old = p.id
      ? this.one("SELECT * FROM accounts WHERE id=? AND deleted=0", p.id)
      : null;
    if (p.id) {
      ensure(old, "账户不存在");
      ensure(old.revision === p.revision, "账户已更新，请刷新后再试");
    }
    let typeId = p.type_id;
    if (p.type_name) {
      const name = label(p.type_name);
      const t = this.one(
        "SELECT id FROM account_types WHERE name=? AND archived=0",
        name,
      );
      typeId = t?.id ?? id();
      if (!t)
        this.run(
          "INSERT INTO account_types(id,name) VALUES(?,?)",
          typeId,
          name,
        );
    }
    ensure(
      this.one(
        "SELECT id FROM account_types WHERE id=? AND archived=0",
        typeId,
      ),
      "请选择有效账户类型",
    );
    const roles = [...new Set(p.roles || [])];
    ensure(
      roles.every((r) => ["SALARY", "SPENDING", "SAVINGS"].includes(r)),
      "账户角色无效",
    );
    const valuationMode =
      p.valuation_mode === undefined
        ? (old?.valuation_mode ?? 0)
        : p.valuation_mode
          ? 1
          : 0;
    ensure(
      !valuationMode || !roles.some((r) => ["SALARY", "SPENDING"].includes(r)),
      "理财估值账户不能设为工资或消费账户",
    );
    ensure(
      !old ||
        valuationMode ||
        !old.valuation_mode ||
        !this.one(
          "SELECT id FROM account_valuations WHERE account_id=? LIMIT 1",
          old.id,
        ),
      "已有估值历史的账户不能关闭估值模式，可归档后新建普通账户",
    );
    const a = {
      id: old?.id ?? id(),
      name: label(p.name),
      type_id: typeId,
      start_date: old?.start_date ?? date(p.start_date || this.clock()),
      roles: json(roles),
      hidden: p.hidden ? 1 : 0,
      valuation_mode: valuationMode,
      archived: old?.archived ?? 0,
      note: safeNote(p.note),
    };
    ensure(a.start_date <= this.clock(), "记账起点不能晚于今天");
    if (old)
      this.run(
        "UPDATE accounts SET name=?,type_id=?,roles=?,hidden=?,valuation_mode=?,note=?,revision=revision+1 WHERE id=?",
        a.name,
        a.type_id,
        a.roles,
        a.hidden,
        a.valuation_mode,
        a.note,
        a.id,
      );
    else {
      this.run(
        "INSERT INTO accounts(id,name,type_id,start_date,roles,hidden,valuation_mode,note,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
        a.id,
        a.name,
        a.type_id,
        a.start_date,
        a.roles,
        a.hidden,
        a.valuation_mode,
        a.note,
        now(),
      );
      this.writeTx({
        kind: "OPENING",
        amount_minor: minor(p.opening_minor ?? "0", {
          signed: true,
          zero: true,
        }).toString(),
        date: a.start_date,
        destination_id: a.id,
        note: "期初余额",
      });
    }
    const defaults = this.settings().defaults || {};
    for (const role of Object.keys(defaults))
      if (defaults[role] === a.id && !roles.includes(role))
        delete defaults[role];
    this.setSettings({ defaults });
    this.audit(
      "account",
      a.id,
      old,
      this.one("SELECT * FROM accounts WHERE id=?", a.id),
      "账户设置",
    );
    return { id: a.id };
  }
  saveValuation(p) {
    const account = this.account(p.account_id);
    ensure(account.valuation_mode, "只有理财估值账户可以更新估值");
    const valuationDate = date(p.date || this.clock());
    ensure(valuationDate <= this.clock(), "估值日期不能晚于今天");
    const value = minor(p.value_minor, { zero: true });
    const old = this.one(
      "SELECT * FROM account_valuations WHERE account_id=? AND date=?",
      account.id,
      valuationDate,
    );
    if (old)
      this.run(
        "UPDATE account_valuations SET value_minor=?,note=?,operation_id=?,created_at=?,revision=revision+1 WHERE id=?",
        value,
        safeNote(p.note),
        this.operation,
        now(),
        old.id,
      );
    else
      this.run(
        "INSERT INTO account_valuations(id,account_id,date,value_minor,note,operation_id,created_at) VALUES(?,?,?,?,?,?,?)",
        id(),
        account.id,
        valuationDate,
        value,
        safeNote(p.note),
        this.operation,
        now(),
      );
    const saved = this.one(
      "SELECT * FROM account_valuations WHERE account_id=? AND date=?",
      account.id,
      valuationDate,
    );
    this.audit("account_valuation", saved.id, old, saved, "更新理财账户估值");
    return { id: saved.id };
  }
  archiveAccount(p) {
    const a = this.account(p.id, true);
    ensure(a.revision === p.revision, "账户已更新");
    ensure(
      !this.one("SELECT id FROM bills WHERE account_id=? AND enabled=1", a.id),
      "请先停用此账户的固定账单",
    );
    ensure(
      !this.one(
        "SELECT id FROM bill_occurrences WHERE account_id=? AND status='PENDING'",
        a.id,
      ),
      "请先处理此账户的待付账单",
    );
    ensure(
      !this.one(
        "SELECT i.id FROM allocation_items i WHERE (source_id=? OR destination_id=?) AND status='PENDING'",
        a.id,
        a.id,
      ),
      "请先取消此账户的未完成分配",
    );
    if (p.remove) {
      ensure(
        !this.one(
          "SELECT id FROM transactions WHERE (source_id=? OR destination_id=?) AND (kind!='OPENING' OR amount_minor!=0)",
          a.id,
          a.id,
        ) &&
          !this.one(
            "SELECT id FROM account_valuations WHERE account_id=? LIMIT 1",
            a.id,
          ),
        "有交易或估值历史的账户请使用归档",
      );
      this.run(
        "UPDATE accounts SET deleted=1,revision=revision+1 WHERE id=?",
        a.id,
      );
      this.run(
        "UPDATE transactions SET deleted=1,revision=revision+1 WHERE destination_id=? AND kind='OPENING'",
        a.id,
      );
    } else
      this.run(
        "UPDATE accounts SET archived=?,revision=revision+1 WHERE id=?",
        a.archived ? 0 : 1,
        a.id,
      );
    const defaults = this.settings().defaults;
    for (const r of Object.keys(defaults))
      if (defaults[r] === a.id) delete defaults[r];
    this.setSettings({ defaults });
    this.audit(
      "account",
      a.id,
      a,
      this.one("SELECT * FROM accounts WHERE id=?", a.id),
      "归档/删除账户",
    );
  }
  setDefaults(p) {
    const defaults = {};
    for (const role of ["SALARY", "SPENDING", "SAVINGS"])
      if (p[role]) {
        const a = this.account(p[role]);
        ensure(JSON.parse(a.roles).includes(role), "默认账户必须具备对应用途");
        defaults[role] = a.id;
      }
    const old = this.settings().defaults;
    this.setSettings({ defaults });
    this.audit("defaults", "1", old, defaults);
  }
  account(accountId, archived = false) {
    const a = this.one(
      "SELECT * FROM accounts WHERE id=? AND deleted=0",
      accountId,
    );
    ensure(a && (archived || !a.archived), "账户不存在或已归档");
    return a;
  }
  saveCategory(p) {
    const old = p.id
      ? this.one("SELECT * FROM categories WHERE id=?", p.id)
      : null;
    if (p.id) {
      ensure(old && !old.archived, "分类不存在或已归档");
      ensure(old.revision === p.revision, "分类已更新");
    }
    const kind = old?.kind ?? p.kind;
    ensure(["INCOME", "EXPENSE"].includes(kind), "分类类型无效");
    const categoryId = old?.id ?? id(),
      versionId = id(),
      name = label(p.name),
      group = label(p.group || (kind === "INCOME" ? "收入" : "其他"));
    if (!old)
      this.run("INSERT INTO categories(id,kind) VALUES(?,?)", categoryId, kind);
    else
      this.run(
        "UPDATE categories SET revision=revision+1 WHERE id=?",
        categoryId,
      );
    const v = old ? old.revision + 1 : 1;
    this.run(
      "INSERT INTO category_versions VALUES(?,?,?,?,?,?)",
      versionId,
      categoryId,
      v,
      name,
      group,
      now(),
    );
    this.audit(
      "category",
      categoryId,
      old,
      { name, group, kind, version: v },
      "分类版本",
    );
    return { id: categoryId, version_id: versionId };
  }
  archiveCategory(p) {
    const c = this.one("SELECT * FROM categories WHERE id=?", p.id);
    ensure(c && c.revision === p.revision, "分类已更新");
    ensure(
      !this.one(
        "SELECT id FROM bills WHERE category_id=? AND enabled=1 AND deleted=0",
        p.id,
      ),
      "请先停用相关固定账单",
    );
    this.run(
      "UPDATE categories SET archived=?,revision=revision+1 WHERE id=?",
      c.archived ? 0 : 1,
      p.id,
    );
    this.audit(
      "category",
      p.id,
      c,
      this.one("SELECT * FROM categories WHERE id=?", p.id),
    );
  }
  deleteCategory(p) {
    const c = this.one("SELECT * FROM categories WHERE id=?", p.id);
    ensure(c && c.revision === p.revision, "分类已更新");
    const usedByTransaction = this.one(
      "SELECT t.id FROM transactions t JOIN category_versions v ON v.id=t.category_version_id WHERE v.category_id=? LIMIT 1",
      p.id,
    );
    const usedByBudget = this.one(
      "SELECT b.id FROM budget_versions b, json_each(b.items) j WHERE json_extract(j.value,'$.category_id')=? LIMIT 1",
      p.id,
    );
    const usedByBill = this.one(
      "SELECT id FROM bills WHERE category_id=? LIMIT 1",
      p.id,
    );
    ensure(
      !usedByTransaction && !usedByBudget && !usedByBill,
      "该分类已有交易、预算或固定账单记录，不能彻底删除；请使用归档",
    );
    this.audit("category", p.id, c, null, "彻底删除未使用分类");
    this.run("DELETE FROM category_versions WHERE category_id=?", p.id);
    this.run("DELETE FROM categories WHERE id=?", p.id);
  }
  categories() {
    return this.all(
      "SELECT c.*,v.id version_id,v.name,v.group_name FROM categories c JOIN category_versions v ON v.category_id=c.id AND v.version=(SELECT MAX(version) FROM category_versions WHERE category_id=c.id) ORDER BY c.kind,v.group_name,v.name",
    );
  }
  ensureCycle(s) {
    date(s);
    let c = this.one("SELECT * FROM cycles WHERE start<=? AND end>?", s, s);
    if (c) return c;
    const rule = this.one(
      "SELECT * FROM cycle_rules WHERE effective_from<=? ORDER BY effective_from DESC LIMIT 1",
      s,
    );
    ensure(rule, "请先完成账本设置");
    let { start, end } = budgetPeriodRange(
      s,
      rule.basis ?? "SALARY",
      rule.payday,
    );
    if (start < rule.effective_from) start = rule.effective_from;
    const next = this.one(
      "SELECT effective_from FROM cycle_rules WHERE effective_from>? ORDER BY effective_from LIMIT 1",
      s,
    );
    if (next && end > next.effective_from) end = next.effective_from;
    const prev = this.one(
      "SELECT end FROM cycles WHERE end<=? ORDER BY end DESC LIMIT 1",
      s,
    );
    if (prev && start < prev.end) start = prev.end;
    const upcoming = this.one(
      "SELECT start FROM cycles WHERE start>? ORDER BY start LIMIT 1",
      s,
    );
    if (upcoming && end > upcoming.start) end = upcoming.start;
    const cycleId = id(),
      partial = this.settings().started > start ? 1 : 0;
    this.run(
      "INSERT INTO cycles(id,start,end,status,partial) VALUES(?,?,?,'DRAFT',?)",
      cycleId,
      start,
      end,
      partial,
    );
    const def = this.latestBudget("DEFAULT");
    const historical = end <= this.clock();
    this.insertBudget(
      "CYCLE",
      cycleId,
      historical ? [] : (def?.items ?? []),
      historical ? "历史补录：当时预算未知" : "个人默认预算",
      historical ? null : def?.id,
    );
    c = this.one("SELECT * FROM cycles WHERE id=?", cycleId);
    return c;
  }
  assertEditable(s, cycleId = null) {
    const c = cycleId
      ? this.one("SELECT * FROM cycles WHERE id=?", cycleId)
      : this.one("SELECT * FROM cycles WHERE start<=? AND end>?", s, s);
    ensure(
      c?.status !== "CLOSED",
      "涉及已结算周期，请先到预算页重新打开并说明原因",
    );
  }
  latestBudget(scope, cycleId = null) {
    const b = this.one(
      "SELECT * FROM budget_versions WHERE scope=? AND cycle_id IS ? ORDER BY version DESC LIMIT 1",
      scope,
      cycleId,
    );
    return b ? { ...b, items: JSON.parse(b.items) } : null;
  }
  insertBudget(scope, cycleId, items, reason, sourceId = null) {
    const latest = this.latestBudget(scope, cycleId),
      budgetId = id();
    this.run(
      "INSERT INTO budget_versions VALUES(?,?,?,?,?,?,?,?)",
      budgetId,
      scope,
      cycleId,
      (latest?.version ?? 0) + 1,
      json(items),
      safeNote(reason),
      sourceId,
      now(),
    );
    return { id: budgetId, items };
  }
  saveBudget(p) {
    const scope = p.scope === "DEFAULT" ? "DEFAULT" : "CYCLE",
      cycleId = scope === "CYCLE" ? p.cycle_id : null;
    if (cycleId) {
      ensure(
        this.one("SELECT id FROM cycles WHERE id=?", cycleId),
        "周期不存在",
      );
      this.assertEditable(null, cycleId);
    }
    const old = this.latestBudget(scope, cycleId);
    ensure(old?.id === p.expected_id, "预算已更新，请刷新");
    ensure(Array.isArray(p.items) && p.items.length <= 1000, "预算项目无效");
    const seen = new Set();
    const items = p.items.map((x) => {
      const c = this.one("SELECT * FROM categories WHERE id=?", x.category_id);
      ensure(c?.kind === "EXPENSE", "预算只支持支出分类");
      ensure(!seen.has(c.id), "预算分类不能重复");
      seen.add(c.id);
      const cv = this.one(
        "SELECT * FROM category_versions WHERE category_id=? ORDER BY version DESC LIMIT 1",
        c.id,
      );
      return {
        category_id: c.id,
        category_version_id: cv.id,
        amount_minor: minor(x.amount_minor, { zero: true }).toString(),
        enabled: x.enabled !== false,
        note: safeNote(x.note),
      };
    });
    const b = this.insertBudget(
      scope,
      cycleId,
      items,
      p.reason || "调整预算",
      old.id,
    );
    if (p.update_default && scope === "CYCLE")
      this.insertBudget(
        "DEFAULT",
        null,
        items,
        "本周期完整预算设为个人默认",
        b.id,
      );
    this.audit("budget", cycleId || "DEFAULT", old, b, p.reason);
    return b;
  }
  openCycle(p) {
    const c = this.one("SELECT * FROM cycles WHERE id=?", p.id);
    ensure(c && c.status === "DRAFT", "只有待设置周期可以创建预算");
    const old = this.latestBudget("CYCLE", c.id);
    let src = null;
    if (p.source === "previous")
      src = this.one(
        "SELECT b.* FROM budget_versions b JOIN cycles c ON b.cycle_id=c.id WHERE c.end<=? ORDER BY c.end DESC,b.version DESC LIMIT 1",
        c.start,
      );
    else if (p.source !== "blank") src = this.latestBudget("DEFAULT");
    const items = src
      ? typeof src.items === "string"
        ? JSON.parse(src.items)
        : src.items
      : [];
    this.insertBudget("CYCLE", c.id, items, "新周期预算", src?.id ?? old?.id);
    this.run(
      "UPDATE cycles SET status='OPEN',revision=revision+1 WHERE id=?",
      c.id,
    );
    this.audit(
      "cycle",
      c.id,
      c,
      this.one("SELECT * FROM cycles WHERE id=?", c.id),
    );
  }
  record(p) {
    ensure(
      !["OPENING", "ADJUSTMENT"].includes(p.kind),
      "请通过期初/余额校准入口记录",
    );
    return this.writeTx(p);
  }
  writeTx(p, old = null) {
    const kind = old?.kind ?? p.kind;
    ensure(
      [
        "INCOME",
        "EXPENSE",
        "TRANSFER",
        "REFUND",
        "OPENING",
        "ADJUSTMENT",
      ].includes(kind),
      "交易类型无效",
    );
    const s = date(p.date);
    ensure(s <= this.clock(), "未来事项请使用固定账单，不能计为已发生交易");
    const value = minor(p.amount_minor, {
      signed: ["OPENING", "ADJUSTMENT"].includes(kind),
      zero: kind === "OPENING",
    });
    const source = ["EXPENSE", "TRANSFER"].includes(kind) ? p.source_id : null,
      dest = ["INCOME", "TRANSFER", "REFUND", "OPENING", "ADJUSTMENT"].includes(
        kind,
      )
        ? p.destination_id
        : null;
    for (const a of [source, dest].filter(Boolean)) {
      const account = this.account(a, !!old);
      ensure(s >= account.start_date, "交易早于账户记账起点，请先扩展记账起点");
    }
    if (source === dest && kind === "TRANSFER")
      throw new Error("转出和转入账户不能相同");
    if (source && this.settings().allow_negative !== true) {
      const balances = this.balances(addDays(s, 1));
      const current = this.balances();
      let available = balances[source] ?? 0n,
        availableNow = current[source] ?? 0n;
      if (old && !old.deleted) {
        const effect =
          (old.source_id === source ? -BigInt(old.amount_minor) : 0n) +
          (old.destination_id === source ? BigInt(old.amount_minor) : 0n);
        if (old.date <= s) available -= effect;
        availableNow -= effect;
      }
      ensure(
        value <= available && value <= availableNow,
        "付款账户余额不足：请核对日期、期初余额及漏记收入；历史补录可在偏好设置开启允许负余额。",
      );
    }
    let cv = null,
      original = null;
    if (kind === "REFUND") {
      original = this.one(
        "SELECT * FROM transactions WHERE id=? AND kind='EXPENSE' AND deleted=0",
        p.original_id,
      );
      ensure(original, "请关联有效的原支出");
      ensure(s >= original.date, "退款日期不能早于消费");
      cv = original.category_version_id;
    } else if (["INCOME", "EXPENSE"].includes(kind)) {
      if (p.category_id === "__custom" || p.category_id === "__investment") {
        const name =
          p.category_id === "__investment"
            ? "理财收益"
            : label(p.custom_category);
        ensure(
          p.category_id !== "__investment" || kind === "INCOME",
          "理财收益属于收入分类",
        );
        const existing = this.categories().find(
          (c) => !c.archived && c.kind === kind && c.name === name,
        );
        p = {
          ...p,
          category_id:
            existing?.id ??
            this.saveCategory({
              name,
              group: kind === "INCOME" ? "收入" : "其他",
              kind,
            }).id,
        };
      }
      cv =
        p.category_version_id ||
        this.one(
          "SELECT id FROM category_versions WHERE category_id=? ORDER BY version DESC LIMIT 1",
          p.category_id,
        )?.id;
      const c = this.one(
        "SELECT c.* FROM categories c JOIN category_versions v ON v.category_id=c.id WHERE v.id=?",
        cv ?? "",
      );
      ensure(c && c.kind === kind && (!c.archived || old), "请选择有效分类");
    }
    const cycle = ["INCOME", "EXPENSE", "REFUND"].includes(kind)
      ? this.ensureCycle(s)
      : null;
    this.assertEditable(s, cycle?.id);
    if (old) this.assertEditable(old.date, old.cycle_id);
    const row = {
      id: old?.id ?? id(),
      kind,
      amount_minor: value.toString(),
      date: s,
      source_id: source ?? null,
      destination_id: dest ?? null,
      category_version_id: cv,
      cycle_id: cycle?.id ?? null,
      original_id: original?.id ?? null,
      salary: kind === "INCOME" && p.salary ? 1 : 0,
      note: safeNote(p.note),
      deleted: 0,
    };
    if (old)
      this.run(
        "UPDATE transactions SET amount_minor=?,date=?,source_id=?,destination_id=?,category_version_id=?,cycle_id=?,original_id=?,salary=?,note=?,revision=revision+1,updated_at=? WHERE id=?",
        value,
        s,
        row.source_id,
        row.destination_id,
        cv,
        row.cycle_id,
        row.original_id,
        row.salary,
        row.note,
        now(),
        row.id,
      );
    else
      this.run(
        "INSERT INTO transactions(id,kind,amount_minor,date,source_id,destination_id,category_version_id,cycle_id,original_id,salary,note,operation_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        row.id,
        kind,
        value,
        s,
        row.source_id,
        row.destination_id,
        cv,
        row.cycle_id,
        row.original_id,
        row.salary,
        row.note,
        this.operation,
        now(),
        now(),
      );
    this.markHistory(old, row);
    this.audit(
      "transaction",
      row.id,
      old,
      this.one("SELECT * FROM transactions WHERE id=?", row.id),
      p.reason,
    );
    return { id: row.id };
  }
  tx(txId) {
    const t = this.one("SELECT * FROM transactions WHERE id=?", txId);
    ensure(t, "交易不存在");
    return t;
  }
  edit(p) {
    const old = this.tx(p.id);
    ensure(!old.deleted && old.revision === p.revision, "交易已更新，请刷新");
    ensure(
      !["OPENING", "ADJUSTMENT"].includes(old.kind),
      "请用余额校准或记账起点入口处理",
    );
    const result = this.writeTx({ ...p, kind: old.kind }, old);
    if (old.kind === "EXPENSE")
      for (const r of this.all(
        "SELECT * FROM transactions WHERE original_id=? AND deleted=0",
        old.id,
      )) {
        this.assertEditable(r.date, r.cycle_id);
        this.run(
          "UPDATE transactions SET category_version_id=?,revision=revision+1 WHERE id=?",
          this.tx(old.id).category_version_id,
          r.id,
        );
        this.audit("transaction", r.id, r, this.tx(r.id), "原支出分类联动");
        this.markHistory(r, this.tx(r.id));
      }
    this.invalidateLinks(old.id);
    return result;
  }
  invalidateLinks(txId) {
    const bill = this.one(
      "SELECT * FROM bill_occurrences WHERE transaction_id=?",
      txId,
    );
    if (bill) {
      this.run(
        "UPDATE bill_occurrences SET status='PENDING',transaction_id=NULL WHERE id=?",
        bill.id,
      );
      this.audit(
        "bill_occurrence",
        bill.id,
        bill,
        this.one("SELECT * FROM bill_occurrences WHERE id=?", bill.id),
        "关联交易修订，请重新核对",
      );
    }
    const item = this.one(
      "SELECT * FROM allocation_items WHERE transaction_id=?",
      txId,
    );
    if (item) {
      this.run(
        "UPDATE allocation_items SET status='PENDING',transaction_id=NULL WHERE id=?",
        item.id,
      );
      this.run(
        "UPDATE allocation_plans SET status='PARTIAL',revision=revision+1 WHERE id=?",
        item.plan_id,
      );
    }
  }
  deleteTransaction(p) {
    const t = this.tx(p.id);
    ensure(!t.deleted && t.revision === p.revision, "交易已更新");
    ensure(t.kind !== "OPENING", "不能单独删除期初余额");
    ensure(
      !this.one(
        "SELECT id FROM receivables WHERE outbound_transaction_id=? UNION SELECT receivable_id id FROM receivable_repayments WHERE transaction_id=?",
        t.id,
        t.id,
      ),
      "待收款关联资金记录请在待收款页面处理",
    );
    const refs = this.all(
      "SELECT * FROM transactions WHERE original_id=? AND deleted=0",
      t.id,
    );
    ensure(!refs.length || p.with_refunds, "此支出有关联退款，请确认一并撤销");
    ensure(
      !this.one("SELECT id FROM allocation_plans WHERE salary_id=?", t.id),
      "此工资已有分配计划，请保留工资记录或先核实分配",
    );
    for (const x of [...refs, t]) {
      this.assertEditable(x.date, x.cycle_id);
      this.run(
        "UPDATE transactions SET deleted=1,revision=revision+1,updated_at=? WHERE id=?",
        now(),
        x.id,
      );
      this.invalidateLinks(x.id);
      this.audit(
        "transaction",
        x.id,
        x,
        this.tx(x.id),
        p.reason || "移入回收站",
      );
      this.markHistory(x, null);
    }
  }
  restoreTransaction(p) {
    const t = this.tx(p.id);
    ensure(t.deleted && t.revision === p.revision, "回收站记录已变更");
    this.assertEditable(t.date, t.cycle_id);
    for (const a of [t.source_id, t.destination_id].filter(Boolean))
      this.account(a, true);
    this.run(
      "UPDATE transactions SET deleted=0,revision=revision+1,updated_at=? WHERE id=?",
      now(),
      t.id,
    );
    this.audit("transaction", t.id, t, this.tx(t.id), "恢复交易");
    this.markHistory(null, t);
  }
  balances(until = null) {
    const result = {};
    const addMovements = (accountId = null, after = null) => {
      const clauses = [],
        params = [];
      if (accountId) {
        clauses.push("account_id=?");
        params.push(accountId);
      }
      if (after) {
        clauses.push("date>?");
        params.push(after);
      }
      if (until) {
        clauses.push("date<?");
        params.push(until);
      }
      const where = clauses.length ? " WHERE " + clauses.join(" AND ") : "";
      try {
        const q = this.db.prepare(
          "SELECT account_id,SUM(delta) delta FROM movements" +
            where +
            " GROUP BY account_id",
        );
        q.setReadBigInts(true);
        for (const row of q.all(...params))
          result[row.account_id] = (result[row.account_id] ?? 0n) + row.delta;
      } catch (e) {
        if (!e.message.includes("integer overflow")) throw e;
        for (const row of this.db
          .prepare("SELECT account_id,delta FROM movements" + where)
          .iterate(...params))
          result[row.account_id] =
            (result[row.account_id] ?? 0n) + BigInt(row.delta);
      }
    };
    addMovements();
    const supportsValuation = this.all("PRAGMA table_info(accounts)").some(
      (column) => column.name === "valuation_mode",
    );
    if (!supportsValuation) return result;
    for (const account of this.all(
      "SELECT id FROM accounts WHERE deleted=0 AND valuation_mode=1",
    )) {
      const valuation = this.one(
        "SELECT * FROM account_valuations WHERE account_id=?" +
          (until ? " AND date<?" : "") +
          " ORDER BY date DESC LIMIT 1",
        ...(until ? [account.id, until] : [account.id]),
      );
      if (!valuation) continue;
      let movement = 0n;
      const params = [
        valuation.operation_id,
        account.id,
        account.id,
        valuation.date,
        valuation.date,
      ];
      let sql =
        "SELECT t.source_id,t.destination_id,t.amount_minor FROM transactions t JOIN operations txop ON txop.id=t.operation_id JOIN operations valop ON valop.id=? WHERE t.deleted=0 AND (t.source_id=? OR t.destination_id=?) AND (t.date>? OR (t.date=? AND txop.rowid>valop.rowid))";
      if (until) {
        sql += " AND date<?";
        params.push(until);
      }
      for (const row of this.all(sql, ...params)) {
        if (row.destination_id === account.id)
          movement += BigInt(row.amount_minor);
        if (row.source_id === account.id) movement -= BigInt(row.amount_minor);
      }
      result[account.id] = BigInt(valuation.value_minor) + movement;
    }
    return result;
  }
  calibrate(p) {
    const a = this.account(p.account_id);
    ensure(!a.valuation_mode, "理财估值账户请使用更新估值");
    const actual = minor(p.actual_minor, { signed: true, zero: true });
    const delta = actual - (this.balances()[a.id] ?? 0n);
    ensure(delta !== 0n, "账面余额与实际一致，无需校准");
    label(p.reason, "校准原因");
    return this.writeTx({
      kind: "ADJUSTMENT",
      date: this.clock(),
      amount_minor: delta.toString(),
      destination_id: a.id,
      note: `余额校准至 ${decimal(actual)} 元；${p.reason}`,
      reason: p.reason,
    });
  }
  changeStart(p) {
    const a = this.account(p.account_id, true);
    ensure(a.revision === p.revision, "账户已更新");
    const s = date(p.start_date);
    ensure(s <= a.start_date, "扩展起点只能选择更早日期");
    label(p.reason, "修改原因");
    const opening = this.one(
      "SELECT * FROM transactions WHERE destination_id=? AND kind='OPENING' AND deleted=0",
      a.id,
    );
    this.assertEditable(opening.date);
    this.assertEditable(s);
    const n = minor(p.opening_minor, { signed: true, zero: true });
    this.run(
      "UPDATE accounts SET start_date=?,revision=revision+1 WHERE id=?",
      s,
      a.id,
    );
    this.run(
      "UPDATE transactions SET date=?,amount_minor=?,revision=revision+1,updated_at=? WHERE id=?",
      s,
      n,
      now(),
      opening.id,
    );
    this.audit(
      "transaction",
      opening.id,
      opening,
      this.tx(opening.id),
      p.reason,
    );
    this.audit("account", a.id, a, this.account(a.id, true), p.reason);
    this.markHistory(opening, this.tx(opening.id));
  }
  markHistory(before, after) {
    const s = [before?.date, after?.date].filter(Boolean).sort()[0];
    if (!s) return;
    this.run(
      "UPDATE settlements SET dirty=1 WHERE cycle_id IN(SELECT id FROM cycles WHERE end>?)",
      s,
    );
  }
  settle(p) {
    const c = this.one("SELECT * FROM cycles WHERE id=?", p.id);
    ensure(c && c.status === "OPEN", "只有开放周期可以结算");
    ensure(c.end <= addDays(this.clock(), 1), "尚未结束的工资周期不能结算");
    const report = this.report(c.start, c.end);
    const b = this.latestBudget("CYCLE", c.id);
    this.run(
      "INSERT INTO settlements VALUES(?,?,?,?,0,?)",
      id(),
      c.id,
      json({
        report,
        budget: b,
        balances: this.balances(c.end),
        data_revision: this.settings().revision,
      }),
      safeNote(p.note),
      now(),
    );
    this.run(
      "UPDATE cycles SET status='CLOSED',revision=revision+1 WHERE id=?",
      c.id,
    );
    this.audit(
      "cycle",
      c.id,
      c,
      this.one("SELECT * FROM cycles WHERE id=?", c.id),
      p.note,
    );
  }
  reopen(p) {
    const c = this.one("SELECT * FROM cycles WHERE id=?", p.id);
    ensure(c?.status === "CLOSED", "周期未结算");
    label(p.reason, "重新打开的原因");
    this.run(
      "UPDATE cycles SET status='OPEN',revision=revision+1 WHERE id=?",
      c.id,
    );
    this.audit(
      "cycle",
      c.id,
      c,
      this.one("SELECT * FROM cycles WHERE id=?", c.id),
      p.reason,
    );
  }
  setPayday(p) {
    const basis = p.basis ?? "SALARY";
    ensure(["SALARY", "CALENDAR_MONTH"].includes(basis), "预算周期口径无效");
    const payday = basis === "SALARY" ? Number(p.payday) : 1;
    budgetPeriodRange(this.clock(), basis, payday);
    const mode = p.mode ?? "NEXT_CYCLE";
    ensure(
      ["IMMEDIATE", "NEXT_CYCLE", "CUSTOM", "NEXT_WEEK"].includes(mode),
      "周期规则生效方式无效",
    );
    const current = this.ensureCycle(this.clock());
    ensure(
      !this.one("SELECT id FROM cycles WHERE start>=?", current.end),
      "已经创建未来周期，请待下周期再调整周期规则",
    );
    const effective =
      mode === "IMMEDIATE"
        ? this.clock()
        : mode === "CUSTOM"
          ? date(p.effective_from)
          : mode === "NEXT_WEEK"
            ? addDays(this.clock(), 7)
            : current.end;
    if (mode === "CUSTOM")
      ensure(effective > this.clock(), "指定生效日期必须晚于今天");
    const proposedEnd =
      mode === "IMMEDIATE"
        ? budgetPeriodRange(this.clock(), basis, payday).end
        : ["CUSTOM", "NEXT_WEEK"].includes(mode) && effective < current.end
          ? effective
          : current.end;
    ensure(current.start < proposedEnd, "预算周期结束日期无效");
    const changesCurrent = proposedEnd !== current.end;
    if (changesCurrent)
      ensure(
        !this.one("SELECT id FROM settlements WHERE cycle_id=?", current.id),
        "已有结算快照的周期不能重划边界，请选择下周期或更晚日期",
      );
    ensure(
      !this.one(
        "SELECT id FROM transactions WHERE cycle_id=? AND deleted=0 AND date>=?",
        current.id,
        proposedEnd,
      ),
      "调整会排除已有交易，请改为下周期或更晚日期生效",
    );
    const before = current;
    this.run("DELETE FROM cycle_rules WHERE effective_from>?", this.clock());
    if (changesCurrent)
      this.run(
        "UPDATE cycles SET end=?,revision=revision+1 WHERE id=?",
        proposedEnd,
        current.id,
      );
    const pending = this.one(
      "SELECT * FROM cycle_rules WHERE effective_from=?",
      effective,
    );
    if (pending)
      this.run(
        "UPDATE cycle_rules SET payday=?,basis=? WHERE id=?",
        payday,
        basis,
        pending.id,
      );
    else
      this.run(
        "INSERT INTO cycle_rules(id,effective_from,payday,basis) VALUES(?,?,?,?)",
        id(),
        effective,
        payday,
        basis,
      );
    this.setSettings({ payday, cycle_basis: basis });
    const reason =
      mode === "IMMEDIATE"
        ? "预算周期规则立即生效"
        : mode === "CUSTOM"
          ? "预算周期规则指定日期生效"
          : "预算周期规则下周期生效";
    this.audit(
      "cycle",
      current.id,
      before,
      this.one("SELECT * FROM cycles WHERE id=?", current.id),
      reason,
    );
    this.audit(
      "cycle_rule",
      effective,
      null,
      { basis, payday, effective_from: effective },
      reason,
    );
    return {
      effective_from: effective,
      cycle_end: proposedEnd,
      basis,
      payday,
      mode,
    };
  }
  adjustCycle(p) {
    const c = this.one("SELECT * FROM cycles WHERE id=?", p.id);
    ensure(c && c.status !== "CLOSED", "请先重新打开周期");
    ensure(
      !this.one("SELECT id FROM settlements WHERE cycle_id=?", c.id),
      "已有结算快照的周期不能重划边界，请仅修改下期工资日",
    );
    const start = date(p.start),
      end = date(p.end);
    ensure(
      start < end && start <= this.clock() && end > this.clock(),
      "当前周期必须包含今天，结束日期不计入本周期",
    );
    const previous = this.one(
      "SELECT * FROM cycles WHERE end<=? AND id!=? ORDER BY end DESC LIMIT 1",
      c.start,
      c.id,
    );
    const next = this.one(
      "SELECT * FROM cycles WHERE start>=? AND id!=? ORDER BY start LIMIT 1",
      c.end,
      c.id,
    );
    ensure(!previous || start === previous.end, "起点必须衔接已有上一周期");
    ensure(!next || end === next.start, "终点必须衔接已有下一周期");
    ensure(
      !this.one(
        "SELECT id FROM transactions WHERE cycle_id=? AND deleted=0 AND (date<? OR date>=?)",
        c.id,
        start,
        end,
      ),
      "调整会排除已有交易，请保留包含这些交易的范围",
    );
    ensure(
      !this.one("SELECT id FROM cycle_rules WHERE effective_from>=?", c.end),
      "请先让待生效工资日生效，再修改周期边界",
    );
    this.run(
      "UPDATE cycles SET start=?,end=?,revision=revision+1 WHERE id=?",
      start,
      end,
      c.id,
    );
    this.audit(
      "cycle",
      c.id,
      c,
      this.one("SELECT * FROM cycles WHERE id=?", c.id),
      safeNote(p.reason),
    );
    return { id: c.id };
  }
  saveSettings(p) {
    const old = this.settings();
    ensure(
      ["forest", "ocean", "violet", "amber", "rose", "slate"].includes(
        p.palette ?? old.palette ?? "forest",
      ),
      "配色选项无效",
    );
    ensure(
      ["system", "light", "dark"].includes(p.theme ?? old.theme),
      "主题无效",
    );
    ensure(
      ["zh-CN", "en"].includes(p.locale ?? old.locale ?? "zh-CN"),
      "语言选项无效",
    );
    const requestedVisibility = p.amount_visibility ?? old.amount_visibility;
    const amountVisibility = {
      master:
        typeof requestedVisibility?.master === "boolean"
          ? requestedVisibility.master
          : p.hide_amounts === undefined
            ? !old.hide_amounts
            : !p.hide_amounts,
      overview: {
        ...(old.amount_visibility?.overview ?? {}),
        ...(requestedVisibility?.overview ?? {}),
      },
      accounts: {
        ...(old.amount_visibility?.accounts ?? {}),
        ...(requestedVisibility?.accounts ?? {}),
      },
      account_summary:
        typeof requestedVisibility?.account_summary === "boolean"
          ? requestedVisibility.account_summary
          : old.amount_visibility?.account_summary !== false,
    };
    ensure(
      Object.keys(amountVisibility.overview).every(
        (key) =>
          ["budget", "income", "assets"].includes(key) &&
          typeof amountVisibility.overview[key] === "boolean",
      ),
      "总览金额显示设置无效",
    );
    ensure(
      typeof amountVisibility.account_summary === "boolean",
      "账户总资产显示设置无效",
    );
    ensure(
      Object.keys(amountVisibility.accounts).length <= 500 &&
        Object.entries(amountVisibility.accounts).every(
          ([key, value]) => key.length <= 100 && typeof value === "boolean",
        ),
      "账户金额显示设置无效",
    );
    const value = {
      theme: p.theme ?? old.theme,
      palette: p.palette ?? old.palette ?? "forest",
      hide_amounts: !amountVisibility.master,
      amount_visibility: amountVisibility,
      locale: p.locale ?? old.locale ?? "zh-CN",
      allow_negative:
        p.allow_negative === undefined
          ? !!old.allow_negative
          : p.allow_negative === true,
    };
    this.setSettings(value);
    this.audit("settings", "1", old, this.settings());
  }
  validate() {
    ensure(
      !this.one(
        `SELECT r.id FROM transactions r LEFT JOIN transactions o ON o.id=r.original_id WHERE r.kind='REFUND' AND r.deleted=0 AND (o.id IS NULL OR o.deleted=1 OR o.kind!='EXPENSE' OR r.date<o.date OR r.category_version_id!=o.category_version_id)`,
      ),
      "退款关联、日期或分类无效",
    );
    for (const row of this.all(
      "SELECT o.id,o.amount_minor FROM transactions o WHERE o.kind='EXPENSE' AND EXISTS(SELECT 1 FROM transactions r WHERE r.original_id=o.id AND r.deleted=0)",
    )) {
      let sum = 0n;
      for (const r of this.db
        .prepare(
          "SELECT amount_minor FROM transactions WHERE original_id=? AND deleted=0",
        )
        .iterate(row.id))
        sum += BigInt(r.amount_minor);
      ensure(sum <= BigInt(row.amount_minor), "累计退款不能超过原支出金额");
    }
    ensure(
      !this.one(
        `SELECT t.id FROM transactions t JOIN accounts a ON a.id=t.source_id OR a.id=t.destination_id WHERE t.deleted=0 AND (a.deleted=1 OR t.date<a.start_date)`,
      ),
      "账户状态或交易起点无效",
    );
    ensure(
      !this.one(
        "SELECT a.id FROM accounts a WHERE a.deleted=0 AND (SELECT COUNT(*) FROM transactions t WHERE t.destination_id=a.id AND t.kind='OPENING' AND t.deleted=0)!=1",
      ),
      "有效账户必须有且只有一个期初余额",
    );
    ensure(
      !this.one(
        "SELECT t.id FROM transactions t JOIN cycles c ON c.id=t.cycle_id WHERE t.deleted=0 AND (t.date<c.start OR t.date>=c.end)",
      ),
      "交易日期与预算周期不一致",
    );
    for (const n of Object.values(this.balances()))
      ensure(n <= MAX_MONEY && n >= -MAX_MONEY, "账户余额超出支持范围");
    for (const plan of this.all(
      "SELECT DISTINCT salary_id FROM allocation_plans",
    )) {
      const salary = this.tx(plan.salary_id);
      let allocated = 0n;
      for (const r of this.all(
        "SELECT i.amount_minor FROM allocation_items i JOIN allocation_plans p ON p.id=i.plan_id WHERE p.salary_id=? AND i.status='RECORDED'",
        salary.id,
      ))
        allocated += BigInt(r.amount_minor);
      ensure(
        !salary.deleted && salary.kind === "INCOME" && salary.salary,
        "分配计划必须关联有效工资收入",
      );
      ensure(allocated >= 0n && allocated <= MAX_MONEY, "分配金额超出支持范围");
    }
  }
  report(start, end, accountId = null) {
    date(start);
    date(end);
    ensure(start < end, "统计日期范围无效");
    const where =
        "t.deleted=0 AND t.date>=? AND t.date<?" +
        (accountId ? " AND (t.source_id=? OR t.destination_id=?)" : ""),
      args = accountId ? [start, end, accountId, accountId] : [start, end];
    const read = (sql, params = args) => {
      const statement = this.db.prepare(sql);
      statement.setReadBigInts(true);
      return statement.all(...params);
    };
    try {
      const sums = read(
        `SELECT kind,COALESCE(SUM(amount_minor),0) amount,COUNT(*) count FROM transactions t WHERE ${where} GROUP BY kind`,
      );
      const value = (k) => sums.find((x) => x.kind === k)?.amount ?? 0n;
      const income = value("INCOME"),
        expense = value("EXPENSE"),
        refund = value("REFUND"),
        net = expense - refund,
        saving = income - net;
      const groups = read(
        `SELECT v.category_id id,v.id version_id,v.name,v.group_name 'group',SUM(CASE WHEN t.kind='EXPENSE' THEN t.amount_minor ELSE 0 END) expense,SUM(CASE WHEN t.kind='REFUND' THEN t.amount_minor ELSE 0 END) refund FROM transactions t JOIN category_versions v ON v.id=t.category_version_id WHERE ${where} AND t.kind IN('EXPENSE','REFUND') GROUP BY v.id`,
      ).map((g) => ({ ...g, net: g.expense - g.refund }));
      const days = read(
        `SELECT t.date,SUM(CASE WHEN kind='INCOME' THEN amount_minor ELSE 0 END) income,SUM(CASE WHEN kind='EXPENSE' THEN amount_minor WHEN kind='REFUND' THEN -amount_minor ELSE 0 END) expense FROM transactions t WHERE ${where} GROUP BY t.date ORDER BY t.date`,
      );
      let transferIn = value("TRANSFER"),
        transferOut = value("TRANSFER");
      if (accountId) {
        const result = read(
          `SELECT SUM(CASE WHEN destination_id=? THEN amount_minor ELSE 0 END) incoming,SUM(CASE WHEN source_id=? THEN amount_minor ELSE 0 END) outgoing FROM transactions t WHERE ${where} AND kind='TRANSFER'`,
          [accountId, accountId, ...args],
        )[0];
        transferIn = result.incoming ?? 0n;
        transferOut = result.outgoing ?? 0n;
      }
      return JSON.parse(
        json({
          start,
          end,
          count: Number(sums.reduce((n, x) => n + x.count, 0n)),
          income,
          expense,
          refund,
          net,
          saving,
          rate: accountId ? null : rate(saving, income),
          transferIn,
          transferOut,
          groups,
          days,
        }),
      );
    } catch (e) {
      if (!e.message.includes("integer overflow")) throw e;
      return this.reportSlow(start, end, accountId);
    }
  }
  reportSlow(start, end, accountId = null) {
    date(start);
    date(end);
    ensure(start < end, "统计日期范围无效");
    let income = 0n,
      expense = 0n,
      refund = 0n,
      transferIn = 0n,
      transferOut = 0n;
    const groups = {},
      days = {};
    let count = 0;
    const rows = this.db.prepare(
      `SELECT t.*,v.category_id,v.name,v.group_name FROM transactions t LEFT JOIN category_versions v ON v.id=t.category_version_id WHERE t.deleted=0 AND t.date>=? AND t.date<? ${accountId ? "AND (t.source_id=? OR t.destination_id=?)" : ""} ORDER BY t.date`,
    );
    for (const t of accountId
      ? rows.iterate(start, end, accountId, accountId)
      : rows.iterate(start, end)) {
      const n = BigInt(t.amount_minor);
      count++;
      days[t.date] ??= { date: t.date, income: 0n, expense: 0n };
      if (t.kind === "INCOME") {
        income += n;
        days[t.date].income += n;
      }
      if (t.kind === "EXPENSE") {
        expense += n;
        days[t.date].expense += n;
      }
      if (t.kind === "REFUND") {
        refund += n;
        days[t.date].expense -= n;
      }
      if (t.kind === "TRANSFER") {
        if (!accountId || t.destination_id === accountId) transferIn += n;
        if (!accountId || t.source_id === accountId) transferOut += n;
      }
      if (["EXPENSE", "REFUND"].includes(t.kind)) {
        const key = t.category_version_id;
        groups[key] ??= {
          id: t.category_id,
          version_id: key,
          name: t.name,
          group: t.group_name,
          expense: 0n,
          refund: 0n,
        };
        groups[key][t.kind === "EXPENSE" ? "expense" : "refund"] += n;
      }
    }
    const net = expense - refund,
      saving = income - net;
    return JSON.parse(
      json({
        start,
        end,
        count,
        income,
        expense,
        refund,
        net,
        saving,
        rate: accountId ? null : rate(saving, income),
        transferIn,
        transferOut,
        groups: Object.values(groups).map((x) => ({
          ...x,
          net: x.expense - x.refund,
        })),
        days: Object.values(days),
      }),
    );
  }
  snapshot(p = {}) {
    const settings = this.settings();
    if (!settings.initialized)
      return {
        settings,
        today: this.clock(),
        accounts: [],
        categories: [],
        cycles: [],
      };
    const current = this.one(
      "SELECT * FROM cycles WHERE start<=? AND end>?",
      this.clock(),
      this.clock(),
    );
    const cycles = this.all("SELECT * FROM cycles ORDER BY start DESC");
    const cycle =
      cycles.find((c) => c.id === p.cycle_id) ?? current ?? cycles[0];
    const budget = this.latestBudget("CYCLE", cycle?.id);
    const balances = this.balances();
    const accounts = this.all(
      "SELECT a.*,t.name type_name FROM accounts a JOIN account_types t ON t.id=a.type_id WHERE a.deleted=0 ORDER BY a.archived,a.created_at",
    )
      .map((a) => ({
        ...a,
        roles: JSON.parse(a.roles),
        balance: String(balances[a.id] ?? 0n),
        last_valuation: a.valuation_mode
          ? this.one(
              "SELECT * FROM account_valuations WHERE account_id=? ORDER BY date DESC LIMIT 1",
              a.id,
            )
          : null,
      }))
      .sort((a, b) => {
        const order = settings.account_order ?? [];
        return (
          (order.indexOf(a.id) < 0 ? 9999 : order.indexOf(a.id)) -
          (order.indexOf(b.id) < 0 ? 9999 : order.indexOf(b.id))
        );
      });
    const start = p.start ?? cycle.start,
      end = p.end ?? cycle.end;
    const report = this.report(start, end, p.account_id || null);
    const cycleReport =
      !p.account_id && start === cycle.start && end === cycle.end
        ? report
        : this.report(cycle.start, cycle.end);
    const cats = this.categories();
    const actual = {};
    for (const g of cycleReport.groups)
      actual[g.id] = (actual[g.id] ?? 0n) + BigInt(g.net);
    const budgetRows = (budget?.items ?? []).map((x) => {
      const cv = this.one(
        "SELECT * FROM category_versions WHERE id=?",
        x.category_version_id,
      );
      const amount = x.enabled ? BigInt(x.amount_minor) : 0n;
      const used = actual[x.category_id] ?? 0n;
      delete actual[x.category_id];
      return {
        ...x,
        name: cv?.name ?? "历史分类",
        group: cv?.group_name ?? "",
        budget: String(amount),
        actual: String(used),
        remaining: String(amount - used),
        rate: rate(used, amount),
        state: budgetState(used, amount),
      };
    });
    for (const [cid, a] of Object.entries(actual)) {
      const c = cats.find((c) => c.id === cid);
      budgetRows.push({
        category_id: cid,
        name: c?.name ?? "历史分类",
        group: c?.group_name ?? "",
        budget: "0",
        actual: String(a),
        remaining: String(-a),
        state: budgetState(a, 0n),
        rate: null,
        enabled: false,
        amount_minor: "0",
      });
    }
    const totalBudget = budgetRows.reduce((n, x) => n + BigInt(x.budget), 0n);
    const remainingBudget = totalBudget - BigInt(cycleReport.net);
    const spendingAccount = accounts.find(
      (a) => a.id === settings.defaults?.SPENDING,
    );
    const spendingBalance = BigInt(spendingAccount?.balance ?? "0");
    const spendableNow =
      remainingBudget > 0n && spendingBalance > 0n
        ? remainingBudget < spendingBalance
          ? remainingBudget
          : spendingBalance
        : 0n;
    const filter = [p.deleted ? 1 : 0, start, end],
      clauses = ["t.deleted=?", "t.date>=?", "t.date<?"];
    if (p.account_id) {
      clauses.push("(t.source_id=? OR t.destination_id=?)");
      filter.push(p.account_id, p.account_id);
    }
    if (p.category_id) {
      clauses.push("v.category_id=?");
      filter.push(p.category_id);
    }
    if (p.category_version_id) {
      clauses.push("t.category_version_id=?");
      filter.push(p.category_version_id);
    }
    if (p.kind) {
      clauses.push("t.kind=?");
      filter.push(p.kind);
    }
    if (
      p.min_amount !== undefined &&
      p.min_amount !== null &&
      p.min_amount !== ""
    ) {
      clauses.push("ABS(t.amount_minor)>=?");
      filter.push(minor(p.min_amount, { zero: true }));
    }
    if (
      p.max_amount !== undefined &&
      p.max_amount !== null &&
      p.max_amount !== ""
    ) {
      clauses.push("ABS(t.amount_minor)<=?");
      filter.push(minor(p.max_amount, { zero: true }));
    }
    if (p.search) {
      clauses.push(
        "(t.note LIKE ? OR v.name LIKE ? OR a.name LIKE ? OR b.name LIKE ?)",
      );
      for (let i = 0; i < 4; i++)
        filter.push(`%${String(p.search).slice(0, 200)}%`);
    }
    const from =
      "FROM transactions t LEFT JOIN category_versions v ON v.id=t.category_version_id LEFT JOIN accounts a ON a.id=t.source_id LEFT JOIN accounts b ON b.id=t.destination_id WHERE " +
      clauses.join(" AND ");
    const countFrom = p.search
      ? from
      : "FROM transactions t LEFT JOIN category_versions v ON v.id=t.category_version_id WHERE " +
        clauses.join(" AND ");
    const total = this.one("SELECT COUNT(*) n " + countFrom, ...filter).n;
    const page = Math.max(0, Math.floor(Number(p.page) || 0));
    const transactionOrders = {
      date_desc: "t.date DESC,t.created_at DESC,t.id",
      date_asc: "t.date ASC,t.created_at ASC,t.id",
      amount_desc: "t.amount_minor DESC,t.date DESC,t.id",
      amount_asc: "t.amount_minor ASC,t.date DESC,t.id",
      category_asc:
        "COALESCE(v.group_name,''),COALESCE(v.name,''),t.date DESC,t.id",
      category_desc:
        "COALESCE(v.group_name,'') DESC,COALESCE(v.name,'') DESC,t.date DESC,t.id",
    };
    const transactionOrder =
      transactionOrders[p.sort] ?? transactionOrders.date_desc;
    const transactions = this.all(
      "SELECT t.*,v.category_id,v.name category_name,v.group_name,a.name source_name,b.name destination_name " +
        from +
        ` ORDER BY ${transactionOrder} LIMIT 100 OFFSET ?`,
      ...filter,
      page * 100,
    ).map((t) => {
      const receivable = this.one(
        "SELECT r.id receivable_id,r.person receivable_person,'LENT' receivable_direction FROM receivables r WHERE r.outbound_transaction_id=? UNION ALL SELECT r.id,r.person,'REPAID' FROM receivable_repayments p JOIN receivables r ON r.id=p.receivable_id WHERE p.transaction_id=? LIMIT 1",
        t.id,
        t.id,
      );
      return { ...t, ...receivable, amount_minor: String(t.amount_minor) };
    });
    if (p.analysis) {
      const length = Math.round(
        (new Date(end + "T00:00:00Z") - new Date(start + "T00:00:00Z")) /
          86400000,
      );
      report.previous = this.report(
        addDays(start, -length),
        start,
        p.account_id || null,
      );
      const stmt = this.db.prepare(
        "SELECT v.id,v.name,SUM(t.amount_minor) amount FROM transactions t JOIN category_versions v ON v.id=t.category_version_id WHERE t.deleted=0 AND t.kind='INCOME' AND t.date>=? AND t.date<? GROUP BY v.id ORDER BY amount DESC",
      );
      stmt.setReadBigInts(true);
      report.incomeGroups = stmt
        .all(start, end)
        .map((r) => ({ ...r, amount: String(r.amount) }));
    }
    const ledgerStart = this.one(
      "SELECT MIN(d) started FROM (SELECT MIN(date) d FROM transactions WHERE deleted=0 UNION ALL SELECT MIN(start_date) d FROM accounts WHERE deleted=0)",
    )?.started;
    return {
      settings,
      today: this.clock(),
      ledgerStartDate: ledgerStart || settings.started || this.clock(),
      accounts,
      accountTypes: this.all("SELECT * FROM account_types WHERE archived=0"),
      categories: cats,
      cycles,
      cycle,
      budget,
      budgetRows,
      totalBudget: String(totalBudget),
      remainingBudget: String(remainingBudget),
      spendingAccount: spendingAccount
        ? { id: spendingAccount.id, name: spendingAccount.name }
        : null,
      spendingBalance: String(spendingBalance),
      spendableNow: String(spendableNow),
      totalAssets: String(Object.values(balances).reduce((a, b) => a + b, 0n)),
      report,
      cycleReport,
      quickExpense: {
        today: this.report(this.clock(), addDays(this.clock(), 1)).net,
        days3: this.report(addDays(this.clock(), -2), addDays(this.clock(), 1))
          .net,
      },
      transactions,
      total,
      page,
      defaultBudget: this.latestBudget("DEFAULT"),
      bills: this.all("SELECT * FROM bills WHERE deleted=0 ORDER BY name").map(
        (b) => ({
          ...b,
          next_due: b.enabled ? this.nextBillDate(b) : null,
          amount_minor: String(b.amount_minor),
        }),
      ),
      occurrences: this.all(
        "SELECT * FROM bill_occurrences WHERE status='PENDING' ORDER BY COALESCE(snoozed_to,due_date) LIMIT 100",
      ).map((b) => ({ ...b, amount_minor: String(b.amount_minor) })),
      salaryIncomes: this.all(
        "SELECT t.*,a.name destination_name FROM transactions t JOIN accounts a ON a.id=t.destination_id WHERE t.cycle_id=? AND t.kind='INCOME' AND t.salary=1 AND t.deleted=0 ORDER BY t.date DESC,t.created_at DESC",
        cycle.id,
      ).map((t) => ({ ...t, amount_minor: String(t.amount_minor) })),
      plans: this.all(
        "SELECT * FROM allocation_plans WHERE deleted=0 ORDER BY created_at DESC LIMIT 30",
      ).map((p) => ({
        ...p,
        salary: this.one(
          "SELECT t.id,t.date,t.amount_minor,a.name destination_name FROM transactions t JOIN accounts a ON a.id=t.destination_id WHERE t.id=?",
          p.salary_id,
        ),
        data: JSON.parse(p.data),
        items: this.all(
          "SELECT * FROM allocation_items WHERE plan_id=?",
          p.id,
        ).map((i) => ({ ...i, amount_minor: String(i.amount_minor) })),
      })),
      settlements: this.all(
        "SELECT * FROM settlements WHERE cycle_id=? ORDER BY created_at DESC",
        cycle.id,
      ).map((s) => ({ ...s, data: JSON.parse(s.data) })),
      imports: this.all(
        "SELECT id,source,status,created_at FROM imports ORDER BY created_at DESC LIMIT 30",
      ),
      cycleRules: this.all(
        "SELECT * FROM cycle_rules ORDER BY effective_from DESC",
      ),
      receivables: this.all(
        "SELECT r.*,s.name source_account_name,d.name return_account_name FROM receivables r JOIN accounts s ON s.id=r.source_account_id LEFT JOIN accounts d ON d.id=r.default_return_account_id WHERE r.deleted=0 ORDER BY CASE r.status WHEN 'OPEN' THEN 0 ELSE 1 END,COALESCE(r.due_date,'9999-12-31'),r.created_at DESC",
      ).map((r) => ({
        ...r,
        principal_minor: String(r.principal_minor),
        outstanding_minor: String(r.outstanding_minor),
        repayments: this.all(
          "SELECT p.*,a.name destination_account_name FROM receivable_repayments p JOIN accounts a ON a.id=p.destination_account_id WHERE p.receivable_id=? ORDER BY p.date DESC,p.created_at DESC",
          r.id,
        ).map((p) => ({ ...p, amount_minor: String(p.amount_minor) })),
      })),
      receivableSummary: (() => {
        const rows = this.all(
          "SELECT outstanding_minor,due_date FROM receivables WHERE deleted=0 AND status='OPEN'",
        );
        return {
          outstanding: String(
            rows.reduce((sum, row) => sum + BigInt(row.outstanding_minor), 0n),
          ),
          open: rows.length,
          overdue: rows.filter(
            (row) => row.due_date && row.due_date < this.clock(),
          ).length,
          dueToday: rows.filter((row) => row.due_date === this.clock()).length,
        };
      })(),
      occurrenceHistory: this.all(
        "SELECT * FROM bill_occurrences WHERE status!='PENDING' ORDER BY due_date DESC LIMIT 100",
      ).map((b) => ({ ...b, amount_minor: String(b.amount_minor) })),
      refundTotals: Object.fromEntries(
        this.all(
          "SELECT original_id,SUM(amount_minor) amount FROM transactions WHERE kind='REFUND' AND deleted=0 GROUP BY original_id",
        ).map((r) => [r.original_id, String(r.amount)]),
      ),
      nextCycleMissing: !current,
    };
  }
  history(p) {
    ensure(
      ["transaction", "account", "category", "cycle", "budget"].includes(
        p.entity,
      ),
      "历史类型无效",
    );
    return this.all(
      "SELECT * FROM audit WHERE entity=? AND entity_id=? ORDER BY created_at DESC",
      p.entity,
      p.id,
    ).map((a) => ({
      ...a,
      before: a.before_data ? JSON.parse(a.before_data) : null,
      after: a.after_data ? JSON.parse(a.after_data) : null,
    }));
  }
  createReceivable(p) {
    const person = label(p.person);
    const lentDate = date(p.lent_date);
    ensure(lentDate <= this.clock(), "借出日期不能晚于今天");
    const dueDate = p.due_date ? date(p.due_date) : null;
    ensure(!dueDate || dueDate >= lentDate, "预计归还日期不能早于借出日期");
    const amount = minor(p.amount_minor);
    const account = this.account(p.source_account_id);
    ensure(lentDate >= account.start_date, "借出日期早于账户记账起点");
    if (this.settings().allow_negative !== true) {
      const historical = this.balances(addDays(lentDate, 1))[account.id] ?? 0n;
      const current = this.balances()[account.id] ?? 0n;
      ensure(amount <= historical && amount <= current, "借出账户余额不足");
    }
    if (p.default_return_account_id) this.account(p.default_return_account_id);
    const timestamp = now(),
      transactionId = id(),
      receivableId = id();
    this.run(
      "INSERT INTO transactions(id,kind,amount_minor,date,source_id,destination_id,category_version_id,cycle_id,original_id,salary,note,operation_id,created_at,updated_at) VALUES(?,'ADJUSTMENT',?,?,NULL,?,NULL,NULL,NULL,0,?,?,?,?)",
      transactionId,
      -amount,
      lentDate,
      account.id,
      safeNote("借给 " + person + (p.note ? " · " + p.note : "")),
      this.operation,
      timestamp,
      timestamp,
    );
    this.run(
      "INSERT INTO receivables(id,person,principal_minor,outstanding_minor,source_account_id,default_return_account_id,lent_date,due_date,status,note,outbound_transaction_id,revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,1,?,?)",
      receivableId,
      person,
      amount,
      amount,
      account.id,
      p.default_return_account_id || null,
      lentDate,
      dueDate,
      "OPEN",
      safeNote(p.note),
      transactionId,
      timestamp,
      timestamp,
    );
    this.audit(
      "receivable",
      receivableId,
      null,
      this.one("SELECT * FROM receivables WHERE id=?", receivableId),
      "新增待收款",
    );
    return { id: receivableId };
  }
  repayReceivable(p) {
    const row = this.one(
      "SELECT * FROM receivables WHERE id=? AND deleted=0",
      p.id,
    );
    ensure(row && row.status === "OPEN", "待收款已结清或不存在");
    ensure(row.revision === p.revision, "待收款已更新，请刷新");
    const amount = minor(p.amount_minor);
    ensure(amount <= BigInt(row.outstanding_minor), "归还金额不能超过待收金额");
    const paidDate = date(p.date);
    ensure(
      paidDate >= row.lent_date && paidDate <= this.clock(),
      "归还日期需在借出日期至今天之间",
    );
    const account = this.account(p.destination_account_id);
    ensure(paidDate >= account.start_date, "归还日期早于账户记账起点");
    const timestamp = now(),
      transactionId = id(),
      repaymentId = id();
    this.run(
      "INSERT INTO transactions(id,kind,amount_minor,date,source_id,destination_id,category_version_id,cycle_id,original_id,salary,note,operation_id,created_at,updated_at) VALUES(?,'ADJUSTMENT',?,?,NULL,?,NULL,NULL,NULL,0,?,?,?,?)",
      transactionId,
      amount,
      paidDate,
      account.id,
      safeNote(row.person + " 归还" + (p.note ? " · " + p.note : "")),
      this.operation,
      timestamp,
      timestamp,
    );
    this.run(
      "INSERT INTO receivable_repayments(id,receivable_id,amount_minor,destination_account_id,date,transaction_id,note,created_at) VALUES(?,?,?,?,?,?,?,?)",
      repaymentId,
      row.id,
      amount,
      account.id,
      paidDate,
      transactionId,
      safeNote(p.note),
      timestamp,
    );
    const outstanding = BigInt(row.outstanding_minor) - amount;
    this.run(
      "UPDATE receivables SET outstanding_minor=?,status=?,revision=revision+1,updated_at=? WHERE id=?",
      outstanding,
      outstanding === 0n ? "SETTLED" : "OPEN",
      timestamp,
      row.id,
    );
    this.audit(
      "receivable",
      row.id,
      row,
      this.one("SELECT * FROM receivables WHERE id=?", row.id),
      "登记归还",
    );
    return { id: repaymentId, settled: outstanding === 0n };
  }
  deleteReceivable(p) {
    const row = this.one(
      "SELECT * FROM receivables WHERE id=? AND deleted=0",
      p.id,
    );
    ensure(row, "待收款不存在或已撤销");
    ensure(row.revision === p.revision, "待收款已更新，请刷新");
    const timestamp = now();
    const transactionIds = [
      row.outbound_transaction_id,
      ...this.all(
        "SELECT transaction_id FROM receivable_repayments WHERE receivable_id=?",
        row.id,
      ).map((x) => x.transaction_id),
    ];
    for (const transactionId of transactionIds)
      this.run(
        "UPDATE transactions SET deleted=1,revision=revision+1,updated_at=? WHERE id=? AND deleted=0",
        timestamp,
        transactionId,
      );
    this.run(
      "UPDATE receivables SET deleted=1,revision=revision+1,updated_at=? WHERE id=?",
      timestamp,
      row.id,
    );
    this.audit(
      "receivable",
      row.id,
      row,
      this.one("SELECT * FROM receivables WHERE id=?", row.id),
      safeNote(p.reason || "撤销待收款"),
    );
    return { id: row.id, transactions: transactionIds.length };
  }
  saveBill(p) {
    const old = p.id
      ? this.one("SELECT * FROM bills WHERE id=? AND deleted=0", p.id)
      : null;
    if (p.id) ensure(old?.revision === p.revision, "账单已更新");
    this.account(p.account_id);
    ensure(
      this.one(
        "SELECT id FROM categories WHERE id=? AND archived=0 AND kind='EXPENSE'",
        p.category_id,
      ),
      "请选择支出分类",
    );
    const frequency = p.frequency;
    ensure(["MONTHLY", "WEEKLY"].includes(frequency), "频率无效");
    const day = Number(p.day);
    ensure(
      Number.isInteger(day) &&
        day >= 1 &&
        day <= (frequency === "MONTHLY" ? 31 : 7),
      "到期日无效",
    );
    const billId = old?.id ?? id();
    const values = [
      label(p.name),
      minor(p.amount_minor),
      p.account_id,
      p.category_id,
      frequency,
      day,
      date(p.start_date),
    ];
    if (old)
      this.run(
        "UPDATE bills SET name=?,amount_minor=?,account_id=?,category_id=?,frequency=?,day=?,start_date=?,revision=revision+1 WHERE id=?",
        ...values,
        billId,
      );
    else
      this.run(
        "INSERT INTO bills(id,name,amount_minor,account_id,category_id,frequency,day,start_date) VALUES(?,?,?,?,?,?,?,?)",
        billId,
        ...values,
      );
    this.audit(
      "bill",
      billId,
      old,
      this.one("SELECT * FROM bills WHERE id=?", billId),
    );
    this.materializeBills();
  }
  toggleBill(p) {
    const b = this.one("SELECT * FROM bills WHERE id=? AND deleted=0", p.id);
    ensure(b?.revision === p.revision, "账单已更新");
    this.run(
      "UPDATE bills SET enabled=?,revision=revision+1 WHERE id=?",
      b.enabled ? 0 : 1,
      b.id,
    );
    this.audit(
      "bill",
      b.id,
      b,
      this.one("SELECT * FROM bills WHERE id=?", b.id),
    );
  }
  deleteBill(p) {
    const b = this.one("SELECT * FROM bills WHERE id=? AND deleted=0", p.id);
    ensure(b?.revision === p.revision, "账单已更新或删除");
    this.run(
      "UPDATE bills SET enabled=0,deleted=1,revision=revision+1 WHERE id=?",
      b.id,
    );
    this.run(
      "UPDATE bill_occurrences SET status='SKIPPED' WHERE bill_id=? AND status='PENDING'",
      b.id,
    );
    this.audit(
      "bill",
      b.id,
      b,
      this.one("SELECT * FROM bills WHERE id=?", b.id),
      "删除固定账单规则",
    );
  }
  nextBillDate(b) {
    let next =
      b.start_date > this.clock() ? b.start_date : addDays(this.clock(), 1);
    for (let i = 0; i < 35; i++, next = addDays(next, 1)) {
      const d = new Date(next + "T00:00:00Z");
      if (
        b.frequency === "WEEKLY"
          ? ((d.getUTCDay() + 6) % 7) + 1 === b.day
          : next === monthDay(d.getUTCFullYear(), d.getUTCMonth(), b.day)
      )
        return next;
    }
    return null;
  }
  materializeBills() {
    for (const b of this.all(
      "SELECT * FROM bills WHERE enabled=1 AND deleted=0",
    )) {
      const last = this.one(
        "SELECT MAX(due_date) d FROM bill_occurrences WHERE bill_id=?",
        b.id,
      )?.d;
      const start = last ? addDays(last, 1) : b.start_date;
      for (let s = start; s <= this.clock(); s = addDays(s, 1)) {
        const d = new Date(`${s}T00:00:00Z`);
        const due =
          b.frequency === "WEEKLY"
            ? ((d.getUTCDay() + 6) % 7) + 1 === b.day
            : s === monthDay(d.getUTCFullYear(), d.getUTCMonth(), b.day);
        if (due)
          this.run(
            "INSERT OR IGNORE INTO bill_occurrences(id,bill_id,due_date,name,amount_minor,account_id,category_id,status,transaction_id) VALUES(?,?,?,?,?,?,?,'PENDING',NULL)",
            id(),
            b.id,
            s,
            b.name,
            b.amount_minor,
            b.account_id,
            b.category_id,
          );
      }
    }
  }
  processBill(p) {
    const b = this.one(
      "SELECT * FROM bill_occurrences WHERE id=? AND status='PENDING'",
      p.id,
    );
    ensure(b, "账单已处理，请刷新");
    if (p.skip) {
      this.run("UPDATE bill_occurrences SET status='SKIPPED' WHERE id=?", b.id);
      this.audit("bill_occurrence", b.id, b, { ...b, status: "SKIPPED" });
      return;
    }
    let txId = p.transaction_id;
    if (txId) {
      const t = this.tx(txId);
      ensure(
        !t.deleted && t.kind === "EXPENSE" && t.source_id === b.account_id,
        "关联支出账户不匹配",
      );
    } else
      txId = this.record({
        kind: "EXPENSE",
        amount_minor: p.amount_minor ?? String(b.amount_minor),
        date: p.date || this.clock(),
        source_id: b.account_id,
        category_id: b.category_id,
        note: b.name,
      }).id;
    this.run(
      "UPDATE bill_occurrences SET status='PAID',transaction_id=? WHERE id=?",
      txId,
      b.id,
    );
    this.audit(
      "bill_occurrence",
      b.id,
      b,
      this.one("SELECT * FROM bill_occurrences WHERE id=?", b.id),
    );
  }
  allocationQuote(p) {
    const salary = this.tx(p.salary_id);
    ensure(
      salary.kind === "INCOME" && salary.salary && !salary.deleted,
      "请选择有效工资收入",
    );
    const source = this.account(salary.destination_id),
      spending = this.account(p.spending_id),
      savings = p.savings_id ? this.account(p.savings_id) : null;
    ensure(
      source.id !== savings?.id || source.id === spending.id,
      "储蓄账户不能与工资源账户相同",
    );
    ensure(
      !savings || savings.id !== spending.id,
      "消费和储蓄请使用不同账户，或留在原账户",
    );
    const cycle = this.one("SELECT * FROM cycles WHERE id=?", salary.cycle_id),
      budget = this.latestBudget("CYCLE", cycle.id);
    const report = this.report(cycle.start, cycle.end),
      totalBudget = budget.items.reduce(
        (n, x) => n + (x.enabled ? BigInt(x.amount_minor) : 0n),
        0n,
      ),
      max = (a, b) => (a > b ? a : b),
      min = (a, b) => (a < b ? a : b),
      remainingBudget = max(0n, totalBudget - BigInt(report.net)),
      balances = this.balances(),
      sourceBalance = balances[source.id] ?? 0n,
      spendingBalance = balances[spending.id] ?? 0n,
      reserve = minor(p.reserve_minor ?? "0", { zero: true });
    let allocated = 0n;
    for (const row of this.all(
      "SELECT i.amount_minor FROM allocation_items i JOIN allocation_plans p ON p.id=i.plan_id JOIN transactions t ON t.id=p.salary_id WHERE t.cycle_id=? AND p.deleted=0 AND i.status='RECORDED'",
      cycle.id,
    ))
      allocated += BigInt(row.amount_minor);
    let cycleSalary = 0n;
    for (const row of this.all(
      "SELECT amount_minor FROM transactions WHERE cycle_id=? AND kind='INCOME' AND salary=1 AND deleted=0",
      cycle.id,
    ))
      cycleSalary += BigInt(row.amount_minor);
    const limitMode =
      p.limit_mode ?? (p.cap_minor != null ? "CUSTOM" : "CYCLE_SALARY");
    ensure(
      ["CYCLE_SALARY", "SOURCE_BALANCE", "CUSTOM"].includes(limitMode),
      "分配上限口径无效",
    );
    const cap =
      limitMode === "CYCLE_SALARY"
        ? cycleSalary
        : limitMode === "SOURCE_BALANCE"
          ? max(0n, sourceBalance)
          : minor(p.cap_minor, { zero: true });
    const countedAllocation = limitMode === "SOURCE_BALANCE" ? 0n : allocated;
    const available = min(
      max(0n, cap - countedAllocation),
      max(0n, sourceBalance - reserve),
    );
    const needed = max(0n, remainingBudget - max(0n, spendingBalance));
    const topup = source.id === spending.id ? 0n : min(needed, available);
    const saving =
      source.id === spending.id
        ? savings
          ? min(available, max(0n, sourceBalance - reserve - remainingBudget))
          : 0n
        : savings
          ? max(0n, available - topup)
          : 0n;
    const items = [];
    if (topup)
      items.push({
        source_id: source.id,
        destination_id: spending.id,
        amount_minor: String(topup),
        purpose: "SPENDING_TOPUP",
      });
    if (saving && savings && savings.id !== source.id)
      items.push({
        source_id: source.id,
        destination_id: savings.id,
        amount_minor: String(saving),
        purpose: "SAVINGS",
      });
    return {
      cycle_id: cycle.id,
      cycle_start: cycle.start,
      cycle_end: cycle.end,
      source_name: source.name,
      spending_name: spending.name,
      savings_name: savings?.name ?? "",
      selected_salary: String(salary.amount_minor),
      cycle_salary: String(cycleSalary),
      total_budget: String(totalBudget),
      net_spent: String(report.net),
      remaining_budget: String(remainingBudget),
      target: String(remainingBudget),
      source_balance: String(sourceBalance),
      spending_balance: String(spendingBalance),
      reserve: String(reserve),
      cap: String(cap),
      allocated: String(allocated),
      available: String(available),
      needed: String(needed),
      topup: String(topup),
      saving: String(saving),
      shortage: String(max(0n, needed - available)),
      limit_mode: limitMode,
      revision: this.settings().revision,
      items,
      input: { ...p, limit_mode: limitMode, cap_minor: String(cap) },
    };
  }
  saveAllocation(p) {
    ensure(
      p.expected_revision === this.settings().revision,
      "余额或预算已变化，请重新计算",
    );
    const salary = this.tx(p.salary_id);
    ensure(
      !this.one(
        "SELECT p.id FROM allocation_plans p JOIN transactions t ON t.id=p.salary_id WHERE t.cycle_id=? AND p.deleted=0 AND p.status IN('DRAFT','PARTIAL')",
        salary.cycle_id,
      ),
      "本周期已有未完成计划，请先完成或取消",
    );
    const q = this.allocationQuote(p);
    ensure(q.items.length, "无需转账，资金可以留在原账户");
    const planId = id();
    this.run(
      "INSERT INTO allocation_plans(id,salary_id,data,status,revision,created_at,deleted) VALUES(?,?,?,'DRAFT',1,?,0)",
      planId,
      p.salary_id,
      json(q),
      now(),
    );
    for (const x of q.items)
      this.run(
        "INSERT INTO allocation_items VALUES(?,?,?,?,?,NULL,'PENDING')",
        id(),
        planId,
        x.source_id,
        x.destination_id,
        BigInt(x.amount_minor),
      );
    this.audit("allocation", planId, null, q);
    return { id: planId };
  }
  confirmAllocation(p) {
    const item = this.one(
      "SELECT * FROM allocation_items WHERE id=? AND status='PENDING'",
      p.id,
    );
    ensure(item, "分配项已处理");
    const plan = this.one(
      "SELECT * FROM allocation_plans WHERE id=?",
      item.plan_id,
    );
    ensure(["DRAFT", "PARTIAL"].includes(plan.status), "分配计划已取消");
    let txId = p.transaction_id;
    if (txId) {
      const t = this.tx(txId);
      ensure(
        !t.deleted &&
          t.kind === "TRANSFER" &&
          t.source_id === item.source_id &&
          t.destination_id === item.destination_id &&
          t.amount_minor === item.amount_minor,
        "已有转账与分配项不匹配",
      );
    } else {
      const bal = this.balances()[item.source_id] ?? 0n;
      ensure(
        bal >= BigInt(item.amount_minor),
        "当前余额不足，请取消后重新计算",
      );
      txId = this.record({
        kind: "TRANSFER",
        amount_minor: String(item.amount_minor),
        date: p.date || this.clock(),
        source_id: item.source_id,
        destination_id: item.destination_id,
        note: "工资分配（用户确认已完成）",
      }).id;
    }
    this.run(
      "UPDATE allocation_items SET status='RECORDED',transaction_id=? WHERE id=?",
      txId,
      item.id,
    );
    const pending = this.one(
      "SELECT id FROM allocation_items WHERE plan_id=? AND status='PENDING'",
      plan.id,
    );
    this.run(
      "UPDATE allocation_plans SET status=?,revision=revision+1 WHERE id=?",
      pending ? "PARTIAL" : "COMPLETED",
      plan.id,
    );
    this.audit(
      "allocation_item",
      item.id,
      item,
      this.one("SELECT * FROM allocation_items WHERE id=?", item.id),
    );
  }
  confirmAllocationPlan(p) {
    const plan = this.one(
      "SELECT * FROM allocation_plans WHERE id=? AND deleted=0",
      p.id,
    );
    ensure(
      plan && ["DRAFT", "PARTIAL"].includes(plan.status),
      "分配计划已处理",
    );
    const items = this.all(
      "SELECT id FROM allocation_items WHERE plan_id=? AND status='PENDING' ORDER BY id",
      plan.id,
    );
    ensure(items.length, "没有待记录的分配项");
    for (const item of items)
      this.confirmAllocation({
        id: item.id,
        date: p.date || this.clock(),
      });
    return { recorded: items.length };
  }
  cancelAllocation(p) {
    const plan = this.one("SELECT * FROM allocation_plans WHERE id=?", p.id);
    ensure(plan, "计划不存在");
    this.run(
      "UPDATE allocation_items SET status='CANCELLED' WHERE plan_id=? AND status='PENDING'",
      p.id,
    );
    this.run(
      "UPDATE allocation_plans SET status='CANCELLED',revision=revision+1 WHERE id=?",
      p.id,
    );
    this.audit(
      "allocation",
      p.id,
      plan,
      this.one("SELECT * FROM allocation_plans WHERE id=?", p.id),
      "取消未完成分配",
    );
  }
  deleteAllocation(p) {
    const plan = this.one(
      "SELECT * FROM allocation_plans WHERE id=? AND deleted=0",
      p.id,
    );
    ensure(plan, "计划不存在");
    ensure(plan.status === "CANCELLED", "请先取消未完成的分配计划");
    this.run(
      "UPDATE allocation_plans SET deleted=1,revision=revision+1 WHERE id=?",
      plan.id,
    );
    this.audit(
      "allocation",
      plan.id,
      plan,
      this.one("SELECT * FROM allocation_plans WHERE id=?", plan.id),
      "隐藏已取消的分配计划",
    );
  }
  commitImport(p) {
    ensure(
      Array.isArray(p.rows) && p.rows.length <= 10000,
      "一次最多导入10000行",
    );
    const importId = id(),
      created = [];
    for (const row of p.rows) {
      if (row.skip) continue;
      const key = row.external_id
        ? this.one(
            "SELECT transaction_id FROM external_keys WHERE source=? AND account_key=? AND external_id=?",
            p.source || "CSV",
            row.source_id || row.destination_id || "",
            row.external_id,
          )
        : null;
      if (key) continue;
      if (row.external_id) {
        const own = this.one(
          "SELECT * FROM transactions WHERE id=?",
          row.external_id,
        );
        if (own) {
          ensure(!own.deleted, "此交易已在回收站，请从回收站恢复");
          ensure(
            own.date === row.date &&
              own.kind === row.kind &&
              BigInt(own.amount_minor) === BigInt(row.amount_minor) &&
              own.source_id === (row.source_id ?? null) &&
              own.destination_id === (row.destination_id ?? null),
            "交易ID与现有记录不一致",
          );
          continue;
        }
      }
      const t = this.record(row);
      created.push(t.id);
      if (row.external_id)
        this.run(
          "INSERT INTO external_keys VALUES(?,?,?,?)",
          p.source || "CSV",
          row.source_id || row.destination_id || "",
          row.external_id,
          t.id,
        );
    }
    this.run(
      "INSERT INTO imports VALUES(?,?,?,?,'COMMITTED',?)",
      importId,
      p.file_hash || "",
      p.source || "CSV",
      json({ created, rows: p.rows }),
      now(),
    );
    this.audit("import", importId, null, { created });
    return { id: importId, count: created.length };
  }
  revertImport(p) {
    const batch = this.one(
      "SELECT * FROM imports WHERE id=? AND status='COMMITTED'",
      p.id,
    );
    ensure(batch, "批次不可撤销");
    const ids = JSON.parse(batch.data).created;
    for (const txId of ids) {
      const t = this.tx(txId);
      ensure(
        t.revision === 1 && !t.deleted,
        "导入交易已有后续修改，不能整批撤销",
      );
      ensure(
        !this.one("SELECT id FROM transactions WHERE original_id=?", txId) &&
          !this.one(
            "SELECT id FROM bill_occurrences WHERE transaction_id=?",
            txId,
          ) &&
          !this.one(
            "SELECT id FROM allocation_items WHERE transaction_id=?",
            txId,
          ),
        "存在关联依赖，不能整批撤销",
      );
      this.assertEditable(t.date, t.cycle_id);
    }
    for (const txId of ids)
      this.deleteTransaction({ id: txId, revision: 1, reason: "撤销导入批次" });
    this.run("UPDATE imports SET status='REVERTED' WHERE id=?", batch.id);
    this.audit("import", batch.id, batch, { status: "REVERTED" });
  }
  async createBackup(
    directory = path.join(path.dirname(this.filename), "backups"),
    kind = "manual",
  ) {
    fs.mkdirSync(directory, { recursive: true });
    const name = `SalaryFlow-${now().replace(/[:.]/g, "-")}-${kind}-${id().slice(0, 8)}.sqlite`,
      file = path.join(directory, name),
      tmp = file + ".partial";
    try {
      await backup(this.db, tmp);
      const info = Store.verifyFile(tmp);
      fs.renameSync(tmp, file);
      const manifest = {
        format: 1,
        app_version: "0.5.0",
        schema_version: 1,
        created_at: now(),
        kind,
        checksum: hash(fs.readFileSync(file)),
        ...info,
      };
      fs.writeFileSync(file + ".json", json(manifest));
      return { file, manifest };
    } catch (e) {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      throw e;
    }
  }
  static verifyFile(file) {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      const schemaVersion = db
        .prepare("PRAGMA user_version")
        .get().user_version;
      ensure(
        schemaVersion >= 1 && schemaVersion <= currentSchema,
        "备份版本不受支持",
      );
      ensure(
        db
          .prepare("SELECT checksum FROM schema_migrations WHERE version=1")
          .get()?.checksum === hash(schema),
        "备份结构版本不匹配",
      );
      ensure(
        db.prepare("PRAGMA integrity_check").get().integrity_check === "ok",
        "数据库完整性检查失败",
      );
      ensure(!db.prepare("PRAGMA foreign_key_check").get(), "外键校验失败");
      const obj = Object.create(Store.prototype);
      obj.db = db;
      obj.validate();
      const settings = db.prepare("SELECT * FROM settings").get();
      return {
        schema_version: schemaVersion,
        revision: settings.revision,
        initialized: JSON.parse(settings.data).initialized,
        transactions: db
          .prepare("SELECT COUNT(*) n FROM transactions WHERE deleted=0")
          .get().n,
        accounts: db
          .prepare("SELECT COUNT(*) n FROM accounts WHERE deleted=0")
          .get().n,
      };
    } finally {
      db.close();
    }
  }
  async restore(file) {
    ensure(
      path.resolve(file) !== path.resolve(this.filename),
      "不能用当前正在使用的数据库覆盖自身",
    );
    const info = Store.verifyFile(file);
    const manifestPath = file + ".json";
    if (fs.existsSync(manifestPath)) {
      const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      ensure(m.checksum === hash(fs.readFileSync(file)), "备份校验和不匹配");
    }
    const safety = await this.createBackup(undefined, "pre-restore");
    const candidate = this.filename + ".restore-new",
      old = this.filename + ".restore-old",
      state = this.filename + ".restore-state.json";
    fs.copyFileSync(file, candidate);
    Store.verifyFile(candidate);
    this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    this.close();
    try {
      fs.writeFileSync(
        state,
        json({ phase: "prepared", old, candidate, safety: safety.file }),
      );
      fs.renameSync(this.filename, old);
      fs.renameSync(candidate, this.filename);
      this.open();
      this.validate();
      fs.unlinkSync(state);
      fs.unlinkSync(old);
      return { info, safety: safety.file };
    } catch (e) {
      this.close();
      if (fs.existsSync(old)) {
        if (fs.existsSync(this.filename))
          fs.renameSync(this.filename, this.filename + ".failed-" + Date.now());
        fs.renameSync(old, this.filename);
      }
      if (fs.existsSync(state)) fs.unlinkSync(state);
      this.open();
      throw e;
    }
  }
  recoverInterrupted() {
    const state = this.filename + ".restore-state.json";
    if (!fs.existsSync(state)) return;
    const old = this.filename + ".restore-old";
    if (fs.existsSync(old)) {
      if (fs.existsSync(this.filename))
        fs.renameSync(
          this.filename,
          this.filename + ".interrupted-" + Date.now(),
        );
      for (const suffix of ["-wal", "-shm"])
        if (fs.existsSync(this.filename + suffix))
          fs.renameSync(
            this.filename + suffix,
            this.filename + suffix + ".interrupted-" + Date.now(),
          );
      fs.renameSync(old, this.filename);
    }
    fs.unlinkSync(state);
  }
}
