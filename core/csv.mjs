import { parseMoney, decimal } from "./money.mjs";
import { createHash } from "node:crypto";
export function parseCSV(text) {
  if (Buffer.byteLength(text, "utf8") > 20 * 1024 * 1024)
    throw new Error("CSV文件最大20MB");
  const rows = [];
  let row = [],
    field = "",
    quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') {
      if (field) throw new Error("CSV引号格式错误");
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw new Error("CSV有未闭合的引号");
  row.push(field);
  if (row.some((x) => x !== "")) rows.push(row);
  if (rows.length > 10001) throw new Error("一次最多导入10000行");
  return rows;
}
export const headers = [
  "日期",
  "类型",
  "金额",
  "转出账户",
  "转入账户",
  "分类",
  "备注",
  "外部交易号",
  "原交易ID",
];
const kinds = {
  收入: "INCOME",
  工资: "INCOME",
  支出: "EXPENSE",
  转账: "TRANSFER",
  退款: "REFUND",
};
export function previewCSV(store, text, mapping = {}) {
  const matrix = parseCSV(text);
  if (matrix.length < 2) throw new Error("CSV至少需要表头和一行数据");
  const columns = matrix[0],
    cats = store.categories(),
    accounts = store.all(
      "SELECT * FROM accounts WHERE deleted=0 AND archived=0",
    );
  const find = (array, name, prop = "name") => {
    const matches = array.filter((x) => x[prop] === name);
    if (matches.length !== 1)
      throw new Error(`无法唯一匹配「${name}」，请检查名称`);
    return matches[0];
  };
  const rows = matrix.slice(1).map((cells, i) => {
    const get = (key) => cells[columns.indexOf(mapping[key] || key)] ?? "";
    try {
      const type = get("类型"),
        kind =
          kinds[type] || (Object.values(kinds).includes(type) ? type : null);
      if (!kind) throw new Error("类型应为收入/工资/支出/转账/退款");
      const p = {
        kind,
        date: get("日期"),
        amount_minor: parseMoney(get("金额")),
        source_id: ["EXPENSE", "TRANSFER"].includes(kind)
          ? find(accounts, get("转出账户")).id
          : null,
        destination_id: ["INCOME", "TRANSFER", "REFUND"].includes(kind)
          ? find(accounts, get("转入账户")).id
          : null,
        category_id: ["INCOME", "EXPENSE"].includes(kind)
          ? find(
              cats.filter((c) => c.kind === kind && !c.archived),
              get("分类"),
            ).id
          : null,
        salary: type === "工资",
        note: get("备注"),
        external_id: get("外部交易号"),
        original_id: get("原交易ID") || null,
      };
      const duplicate = store.one(
        "SELECT id FROM transactions WHERE deleted=0 AND date=? AND kind=? AND amount_minor=? AND source_id IS ? AND destination_id IS ?",
        p.date,
        p.kind,
        BigInt(p.amount_minor),
        p.source_id,
        p.destination_id,
      );
      return {
        line: i + 2,
        ...p,
        skip: false,
        warning: duplicate ? "疑似重复，请核对现有记录后选择保留或跳过" : "",
        error: "",
      };
    } catch (e) {
      return { line: i + 2, skip: true, error: e.message, raw: cells };
    }
  });
  return {
    columns,
    rows,
    file_hash: createHash("sha256").update(text).digest("hex"),
  };
}
export function escapeCell(value, protect = true) {
  let s = String(value ?? "");
  if (protect && /^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function exportCSV(store, start, end) {
  const rows = store.all(
    "SELECT t.*,a.name source,b.name destination,v.name category FROM transactions t LEFT JOIN accounts a ON a.id=t.source_id LEFT JOIN accounts b ON b.id=t.destination_id LEFT JOIN category_versions v ON v.id=t.category_version_id WHERE t.deleted=0 AND t.date>=? AND t.date<? ORDER BY t.date,t.id",
    start,
    end,
  );
  const labels = {
    INCOME: "收入",
    EXPENSE: "支出",
    TRANSFER: "转账",
    REFUND: "退款",
    OPENING: "期初",
    ADJUSTMENT: "校准",
  };
  return (
    "\uFEFF" +
    [
      headers.map((x) => escapeCell(x)).join(","),
      ...rows.map((t) =>
        [
          t.date,
          t.salary ? "工资" : labels[t.kind],
          decimal(t.amount_minor),
          t.source,
          t.destination,
          t.category,
          t.note,
          t.id,
          t.original_id,
        ]
          .map((x, i) => escapeCell(x, i !== 2))
          .join(","),
      ),
    ].join("\r\n")
  );
}
