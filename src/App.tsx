import { Trend, Composition } from "./Charts";
import { t as msg, tr, getLocale, changeLocale } from "./i18n";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  ChartNoAxesCombined,
  Settings2,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  ChevronLeft,
  Search,
  X,
  Check,
  ShieldCheck,
  Sun,
  Moon,
  Eye,
  EyeOff,
  Download,
  Upload,
  RotateCcw,
  History,
  Pencil,
  Trash2,
  CalendarDays,
  Landmark,
  MoreHorizontal,
  CircleHelp,
  CheckCircle2,
  Copy,
  Banknote,
  ArrowRight,
  Sparkles,
  Archive,
  FolderOpen,
  FileText,
} from "lucide-react";
import { Help } from "./Help";
import { amountVisible, budgetColor } from "../core/presentation.mjs";
import { decimal } from "../core/money.mjs";
import {
  isMoneyExpression,
  parseMoneyExpression,
} from "../core/money-expression.mjs";
import { timeRange, addDays } from "../core/dates.mjs";
type Data = Record<string, any>;
declare global {
  interface Window {
    salaryflow?: {
      invoke: (
        method: string,
        payload?: Data,
      ) => Promise<{
        ok: boolean;
        data?: any;
        error?: string;
      }>;
    };
  }
}
async function api(method: string, payload: Data = {}) {
  if (!window.salaryflow)
    throw new Error(
      msg("请通过薪流桌面应用打开，浏览器预览不会保存账务数据。"),
    );
  const r = await window.salaryflow.invoke(method, payload);
  if (!r.ok) throw new Error(msg(r.error || "操作失败"));
  return r.data;
}
const localized = (value: any) => msg(String(value ?? ""));
const money = (v: any) => {
  const s = decimal(v ?? "0"),
    [a, b] = s.split(".");
  return a.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + b;
};
const kinds: Data = {
  INCOME: msg("收入"),
  EXPENSE: msg("支出"),
  TRANSFER: msg("转账"),
  REFUND: msg("退款"),
  OPENING: msg("期初余额"),
  ADJUSTMENT: msg("余额校准"),
};
const roles: Data = {
  SALARY: msg("工资"),
  SPENDING: msg("消费"),
  SAVINGS: msg("储蓄"),
};
const pages = [
  { key: "overview", label: msg("总览"), icon: LayoutDashboard },
  { key: "transactions", label: msg("交易记录"), icon: ArrowLeftRight },
  { key: "budget", label: msg("预算与周期"), icon: Wallet },
  { key: "allocations", label: msg("工资分配"), icon: Sparkles },
  { key: "accounts", label: msg("我的账户"), icon: Landmark },
  { key: "analysis", label: msg("统计分析"), icon: ChartNoAxesCombined },
  { key: "settings", label: msg("设置与数据"), icon: Settings2 },
];
const ranges = [
  ["cycle", msg("工资周期")],
  ["week", msg("自然周")],
  ["month", msg("自然月")],
  ["quarter", msg("自然季度")],
  ["year", msg("自然年")],
  ["days7", msg("最近7天")],
  ["days30", msg("最近30天")],
  ["days90", msg("最近90天")],
  ["months3", msg("最近3个月")],
  ["months6", msg("最近6个月")],
  ["months12", msg("最近12个月")],
  ["custom", msg("自定义")],
];
type Field = {
  name: string;
  label: string;
  type?: string;
  options?: {
    value: string;
    label: string;
  }[];
  required?: boolean;
  hint?: string;
  explain?: string;
  visible?: (values: Data) => boolean;
  presets?: { label: string; value: string }[];
};
function TooltipPortal({
  anchor,
  text,
}: {
  anchor: HTMLElement | null;
  text: string;
}) {
  const [, redraw] = useState(0);
  useEffect(() => {
    const update = () => redraw((value) => value + 1);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, []);
  if (!anchor) return null;
  const box = anchor.getBoundingClientRect();
  const width = Math.min(320, Math.max(160, window.innerWidth - 24));
  const left = Math.min(
    Math.max(box.left + box.width / 2, 12 + width / 2),
    window.innerWidth - 12 - width / 2,
  );
  const above = box.top >= 96;
  return createPortal(
    <span
      className={`tooltip-portal ${above ? "above" : "below"}`}
      role="tooltip"
      style={{
        left,
        top: above ? box.top - 9 : box.bottom + 9,
        maxWidth: width,
      }}
    >
      {text}
    </span>,
    document.body,
  );
}
function HoverHint({ text, children }: { text: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  return (
    <span
      ref={anchor}
      className="hover-hint has-tooltip"
      aria-label={text}
      aria-expanded={open}
      data-open={open ? "true" : "false"}
      tabIndex={0}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && <TooltipPortal anchor={anchor.current} text={text} />}
    </span>
  );
}
function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  return (
    <span
      ref={anchor}
      className="help-tip has-tooltip"
      aria-label={text}
      aria-expanded={open}
      data-open={open ? "true" : "false"}
      tabIndex={0}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <CircleHelp size={15} />
      {open && <TooltipPortal anchor={anchor.current} text={text} />}
    </span>
  );
}
function Form({
  fields,
  initial = {},
  onSubmit,
  submit = msg("保存"),
  children,
}: {
  fields: Field[];
  initial?: Data;
  onSubmit: (p: Data, op: string) => Promise<any>;
  submit?: string;
  children?: ReactNode;
}) {
  const [values, setValues] = useState<Data>(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const op = useRef(crypto.randomUUID()),
    lock = useRef(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setError("");
        try {
          const submitted = { ...values };
          for (const field of fields)
            if (
              field.type === "money" &&
              String(submitted[field.name] ?? "").trim()
            )
              submitted[field.name] = decimal(
                parseMoneyExpression(submitted[field.name], {
                  signed: true,
                  zero: true,
                }),
              );
          await onSubmit(submitted, op.current);
        } catch (e: any) {
          setError(msg(e.message));
          op.current = crypto.randomUUID();
        } finally {
          setBusy(false);
          lock.current = false;
        }
      }}
    >
      <div className="form-grid">
        {fields
          .filter((f) => !f.visible || f.visible(values))
          .map((f) => (
            <label className={f.type === "textarea" ? "wide" : ""} key={f.name}>
              <span>
                {f.label}
                {f.explain && <InfoTip text={f.explain} />}
                {f.required !== false && f.type !== "checkbox" && (
                  <b className="required"> *</b>
                )}
              </span>
              {f.type === "select" ? (
                <select
                  value={values[f.name] ?? ""}
                  required={f.required !== false}
                  onChange={(e) =>
                    setValues({ ...values, [f.name]: e.target.value })
                  }
                >
                  <option value="">{msg("请选择")}</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  value={values[f.name] ?? ""}
                  onChange={(e) =>
                    setValues({ ...values, [f.name]: e.target.value })
                  }
                  maxLength={4000}
                />
              ) : f.type === "checkbox" ? (
                <div className="check-line">
                  <input
                    type="checkbox"
                    checked={!!values[f.name]}
                    onChange={(e) =>
                      setValues({ ...values, [f.name]: e.target.checked })
                    }
                  />
                  <span>{f.hint}</span>
                </div>
              ) : (
                <input
                  type={f.type === "money" ? "text" : f.type || "text"}
                  inputMode={f.type === "money" ? "decimal" : undefined}
                  value={values[f.name] ?? ""}
                  required={f.required !== false}
                  step={f.type === "number" ? "1" : undefined}
                  onChange={(e) =>
                    setValues({ ...values, [f.name]: e.target.value })
                  }
                  maxLength={
                    f.type === "money" || f.type === "text" || !f.type
                      ? 200
                      : undefined
                  }
                />
              )}{" "}
              {f.hint && f.type !== "checkbox" && <small>{f.hint}</small>}
              {f.type === "money" && isMoneyExpression(values[f.name]) && (
                <MoneyExpressionResult value={values[f.name]} />
              )}
              {f.presets && (
                <div className="quick-presets">
                  {f.presets.map((x) => (
                    <button
                      type="button"
                      key={x.label}
                      onClick={() =>
                        setValues({ ...values, [f.name]: x.value })
                      }
                    >
                      {x.label}
                    </button>
                  ))}
                </div>
              )}
            </label>
          ))}
      </div>
      {children}
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      <div className="form-actions">
        <span className="muted">
          <ShieldCheck size={14} />
          {msg("仅保存在此电脑")}
        </span>
        <button className="primary" disabled={busy}>
          {busy ? msg("正在保存…") : submit}
          <Check size={16} />
        </button>
      </div>
    </form>
  );
}
function MoneyExpressionResult({ value }: { value: string }) {
  try {
    return (
      <small className="money-expression-result">
        {msg("计算结果")}：¥{" "}
        {money(
          parseMoneyExpression(value, {
            signed: true,
            zero: true,
          }),
        )}
      </small>
    );
  } catch {
    return (
      <small className="money-expression-result error">
        {msg("请检查金额算式")}
      </small>
    );
  }
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const el = ref.current;
    const focus = el?.querySelector<HTMLElement>(
      "input,select,button,textarea",
    );
    focus?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && el) {
        const nodes = Array.from(
          el.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select,textarea,[tabindex="0"]',
          ),
        );
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop">
      <div
        ref={ref}
        className={"modal " + (wide ? "modal-wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label={msg("关闭")}
            title={msg("关闭")}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Empty({
  title = msg("暂无记录"),
  hint = msg("从第一笔真实记录开始，让每份收入都有去处。"),
  action,
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Wallet size={27} />
      </div>
      <h3>{title}</h3>
      <p>{hint}</p>
      {action}
    </div>
  );
}
export default function App() {
  const [data, setData] = useState<Data | null>(null),
    [page, setPage] = useState(
      sessionStorage.getItem("salaryflow.page") || "overview",
    ),
    [query, setQuery] = useState<Data>({}),
    [modal, setModal] = useState<{
      title: string;
      subtitle?: string;
      body: ReactNode;
      wide?: boolean;
    } | null>(null),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [settingsTab, setSettingsTab] = useState("general");
  const [range, setRange] = useState("cycle"),
    [anchor, setAnchor] = useState(""),
    [custom, setCustom] = useState({ start: "", end: "" });
  const requestNo = useRef(0);
  const [info, setInfo] = useState<Data | null>(null);
  const close = () => setModal(null);
  async function load(q: Data = query) {
    const seq = ++requestNo.current;
    setLoading(true);
    try {
      const d = await api("snapshot", { ...q, analysis: page === "analysis" });
      if (seq === requestNo.current) {
        if (d.settings.locale && d.settings.locale !== getLocale()) {
          localStorage.setItem("salaryflow.locale", d.settings.locale);
          window.location.reload();
          return;
        }
        setData(d);
        setError("");
        if (!anchor) setAnchor(d.today);
      }
    } catch (e: any) {
      setError(msg(e.message));
    } finally {
      if (seq === requestNo.current) setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [JSON.stringify(query), page]);
  useEffect(() => {
    if (!data) return;
    const theme = data.settings.theme;
    document.documentElement.dataset.palette =
      data.settings.palette || "forest";
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const set = () =>
      (document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme);
    set();
    media.addEventListener("change", set);
    return () => media.removeEventListener("change", set);
  }, [data?.settings.theme, data?.settings.palette]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (
        e.ctrlKey &&
        e.key.toLowerCase() === "n" &&
        !modal &&
        data?.settings.initialized
      ) {
        e.preventDefault();
        transaction();
      }
      if (e.ctrlKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setPage("transactions");
        setTimeout(
          () =>
            document
              .querySelector<HTMLInputElement>(".search-box input")
              ?.focus(),
          0,
        );
      }
    };
    document.addEventListener("keydown", f);
    return () => document.removeEventListener("keydown", f);
  }, [modal, data]);
  async function mutate(action: string, payload: Data = {}, op?: string) {
    const r = await api("command", {
      action,
      payload,
      operation_id: op || crypto.randomUUID(),
    });
    await load();
    setToast(msg("已保存，相关金额已更新"));
    return r;
  }
  async function act(fn: () => Promise<any>) {
    try {
      return await fn();
    } catch (e: any) {
      setToast(msg(e.message));
    }
  }
  const canShowAmount = (scope = "global", key = "") =>
    amountVisible(data?.settings, scope, key);
  const localAllowsAmount = (scope: string, key: string) => {
    const current = data?.settings.amount_visibility;
    if (scope === "overview") return current?.overview?.[key] !== false;
    if (scope === "account") return current?.accounts?.[key] !== false;
    if (scope === "accountSummary") return current?.account_summary !== false;
    return canShowAmount();
  };
  const fmt = (v: any, scope = "global", key = "") =>
    canShowAmount(scope, key) ? money(v) : "••••";
  async function toggleAmount(scope = "global", key = "") {
    const current = data?.settings.amount_visibility ?? {};
    const next = {
      master:
        typeof current.master === "boolean"
          ? current.master
          : !data?.settings.hide_amounts,
      overview: { ...(current.overview ?? {}) },
      accounts: { ...(current.accounts ?? {}) },
      account_summary: current.account_summary !== false,
    };
    if (scope === "global") next.master = !next.master;
    else if (scope === "overview")
      next.overview[key] = !localAllowsAmount(scope, key);
    else if (scope === "account")
      next.accounts[key] = !localAllowsAmount(scope, key);
    else if (scope === "accountSummary")
      next.account_summary = !localAllowsAmount(scope, key);
    await mutate("saveSettings", { amount_visibility: next });
  }
  const accounts = (data?.accounts || []).filter((a: Data) => !a.archived),
    cats = data?.categories || [];
  const accountOptions = accounts.map((a: Data) => ({
    value: a.id,
    label: localized(a.name),
  }));
  const selectField = (
    name: string,
    label: string,
    options: any[],
    required = true,
  ): Field => ({ name, label, type: "select", options, required });
  function confirm(
    title: string,
    description: string,
    fn: (p: Data, op: string) => Promise<any>,
    fields: Field[] = [],
    initial: Data = {},
  ) {
    setModal({
      title,
      subtitle: description,
      body: (
        <Form
          fields={fields}
          initial={initial}
          submit={msg("确认")}
          onSubmit={async (p, op) => {
            await fn(p, op);
            close();
          }}
        />
      ),
    });
  }
  function goto(key: string, q: Data = {}) {
    sessionStorage.setItem("salaryflow.page", key);
    setPage(key);
    setQuery(q);
    setRange("cycle");
  }
  async function showHistory(entity: string, id: string) {
    const history = await api("history", { entity, id });
    setModal({
      title: msg("修改历史"),
      subtitle: msg("每次修改保留独立记录，不重复计入收支"),
      wide: true,
      body: (
        <div className="history-list">
          {history.length ? (
            history.map((h: Data) => (
              <article key={h.id}>
                <div>
                  <b>{new Date(h.created_at).toLocaleString(getLocale())}</b>
                  <span>{h.reason || msg("保存记录")}</span>
                </div>
                <div className="history-diff">
                  <pre>
                    {JSON.stringify(h.before, null, 2) || msg("首次创建")}
                  </pre>
                  <ArrowRight size={18} />
                  <pre>{JSON.stringify(h.after, null, 2)}</pre>
                </div>
              </article>
            ))
          ) : (
            <Empty title={msg("暂无修改记录")} />
          )}
        </div>
      ),
    });
  }
  function transaction(
    kind = "EXPENSE",
    old: Data | null = null,
    original: Data | null = null,
  ) {
    const type = old?.kind || kind;
    const defaults = data?.settings.defaults || {};
    const relevant = cats.filter(
      (c: Data) =>
        !c.archived && c.kind === (type === "INCOME" ? "INCOME" : "EXPENSE"),
    );
    const refundable = original
      ? BigInt(original.amount_minor) -
        BigInt(data?.refundTotals?.[original.id] || "0")
      : 0n;
    const fields: Field[] = [
      {
        name: "amount",
        type: "money",
        label:
          type === "REFUND" ? msg("本次退款金额（元）") : msg("金额（元）"),
        hint:
          type === "REFUND"
            ? msg("快捷比例按剩余可退金额计算，向下取整到分")
            : msg("可输入金额或使用 + - * / ( ) 计算，结果四舍五入到分"),
        presets:
          type === "REFUND" && !old
            ? [25, 50, 75, 100].map((n) => ({
                label: n === 100 ? msg("全部剩余退款") : n + "%",
                value: decimal(String((refundable * BigInt(n)) / 100n)),
              }))
            : undefined,
      },
      { name: "date", label: msg("实际发生日期"), type: "date" },
    ];
    if (["EXPENSE", "TRANSFER"].includes(type))
      fields.push(
        selectField(
          "source_id",
          type === "TRANSFER" ? msg("转出账户") : msg("付款账户"),
          accountOptions,
        ),
      );
    if (["INCOME", "TRANSFER", "REFUND"].includes(type))
      fields.push(
        selectField(
          "destination_id",
          type === "TRANSFER" ? msg("转入账户") : msg("收款账户"),
          accountOptions,
        ),
      );
    if (["EXPENSE", "INCOME"].includes(type))
      fields.push(
        selectField("category_id", msg("分类"), [
          ...relevant.map((c: Data) => ({
            value: c.id,
            label: `${localized(c.group_name)} / ${localized(c.name)}`,
          })),
          { value: "__custom", label: msg("其他 / 自定义名称") },
          ...(type === "INCOME"
            ? [{ value: "__investment", label: msg("理财收益（实际到账）") }]
            : []),
        ]),
      );
    if (["EXPENSE", "INCOME"].includes(type))
      fields.push({
        name: "custom_category",
        label: msg("自定义分类名称"),
        visible: (v) => v.category_id === "__custom",
      });
    if (type === "INCOME")
      fields.push({
        name: "salary",
        label: msg("工资收入"),
        type: "checkbox",
        hint: msg("用于工资分配助手"),
        explain: msg(
          "勾选后，这笔收入可用于生成消费、储蓄账户之间的分配计划；只有确认现实转账后才记账，不会自动转账。理财收益请勿勾选工资。",
        ),
        required: false,
      });
    fields.push({
      name: "note",
      label: msg("备注"),
      type: "textarea",
      required: false,
    });
    if (old)
      fields.push({ name: "reason", label: msg("修改原因"), required: false });
    const initial = {
      amount: old ? decimal(old.amount_minor) : "",
      date: old?.date || data?.today,
      source_id: old?.source_id || defaults.SPENDING || accounts[0]?.id,
      destination_id:
        old?.destination_id ||
        (type === "INCOME"
          ? defaults.SALARY
          : type === "REFUND"
            ? original?.source_id
            : defaults.SAVINGS) ||
        accounts[0]?.id,
      category_id: old?.category_id || relevant[0]?.id,
      note: old?.note || "",
      salary: !!old?.salary,
    };
    setModal({
      title: old
        ? msg("修改交易")
        : type === "REFUND"
          ? msg("记录关联退款")
          : msg("记一笔"),
      subtitle:
        type === "TRANSFER"
          ? msg("内部转账只改变资金位置，不计收入或支出")
          : type === "REFUND"
            ? tr(
                "原支出 {0} 元；按实际退款日冲减预算",
                fmt(original?.amount_minor),
              )
            : msg("实际日期决定统计范围和预算周期"),
      body: (
        <>
          {type === "REFUND" && original && (
            <p className="tip">
              {msg("剩余可退")}：¥ {fmt(String(refundable))}
            </p>
          )}
          {type === "INCOME" && (
            <p className="tip">
              {msg(
                "理财收益只记录实际到账的利息、分红或已实现收益；本金转移请记转账，赎回本金不能重复计为收入。",
              )}
            </p>
          )}
          <div className="segmented transaction-tabs">
            {!old &&
              !original &&
              ["EXPENSE", "INCOME", "TRANSFER"].map((k) => (
                <button
                  key={k}
                  className={type === k ? "active" : ""}
                  onClick={() => transaction(k)}
                >
                  {kinds[k]}
                </button>
              ))}
          </div>
          <Form
            key={type + old?.id}
            fields={fields}
            initial={initial}
            onSubmit={async (p, op) => {
              const result = await mutate(
                old ? "edit" : "record",
                {
                  ...p,
                  kind: type,
                  id: old?.id,
                  revision: old?.revision,
                  amount_minor: parseMoneyExpression(p.amount),
                  original_id: original?.id ?? old?.original_id,
                },
                op,
              );
              close();
              if (!old && type === "INCOME" && p.salary)
                goto("allocations", { cycle_id: result.cycle_id });
            }}
          />
        </>
      ),
    });
  }
  function editAccount(a: Data | null = null) {
    setModal({
      title: a ? msg("编辑账户") : msg("新增账户"),
      subtitle: msg("账户类型描述载体，用途角色可多选。账户数量不受限制。"),
      body: (
        <Form
          initial={{
            ...a,
            type_name: a?.type_name || msg("银行卡"),
            opening: a ? "0.00" : "0.00",
            start_date: a?.start_date || data?.today,
            SALARY: a?.roles.includes("SALARY"),
            SPENDING: a?.roles.includes("SPENDING"),
            SAVINGS: a?.roles.includes("SAVINGS"),
          }}
          fields={[
            { name: "name", label: msg("账户名称") },
            {
              name: "type_name",
              label: msg("账户类型"),
              hint: msg("例如银行卡、现金、第三方支付；支持自定义"),
            },
            ...(!a
              ? [
                  {
                    name: "opening",
                    type: "money",
                    label: msg("期初余额（元）"),
                  },
                  {
                    name: "start_date",
                    label: msg("余额基准日"),
                    type: "date",
                  },
                ]
              : []),
            ...Object.entries(roles).map(([key, v]) => ({
              name: key,
              label: v + msg("用途"),
              type: "checkbox",
              hint: msg("可与其他用途同时选择"),
              required: false,
            })),
            {
              name: "valuation_mode",
              label: msg("按估值管理余额"),
              type: "checkbox",
              hint: msg(
                "适合理财账户：市值涨跌通过估值更新，不计为收入或支出；不能设为工资或消费账户。",
              ),
              required: false,
            },
            {
              name: "hidden",
              label: msg("隐藏账户"),
              type: "checkbox",
              hint: msg("不影响全账本资产统计"),
              required: false,
            },
            {
              name: "note",
              label: msg("备注"),
              type: "textarea",
              required: false,
            },
          ]}
          onSubmit={async (p, op) => {
            await mutate(
              "saveAccount",
              {
                ...p,
                id: a?.id,
                revision: a?.revision,
                roles: Object.keys(roles).filter((r) => p[r]),
                opening_minor: parseMoneyExpression(p.opening || "0", {
                  signed: true,
                  zero: true,
                }),
              },
              op,
            );
            close();
          }}
        />
      ),
    });
  }
  function updateValuation(a: Data) {
    confirm(
      msg("更新理财账户估值"),
      msg(
        "填写当日收盘后或当前看到的总市值。估值会包含保存前已记录的当日流水；之后新记的同日转账继续叠加。同一天再次保存会更新当天估值。",
      ),
      async (p, op) =>
        mutate(
          "saveValuation",
          {
            account_id: a.id,
            date: p.date,
            value_minor: parseMoneyExpression(p.value, { zero: true }),
            note: p.note,
          },
          op,
        ),
      [
        { name: "date", label: msg("估值日期"), type: "date" },
        { name: "value", type: "money", label: msg("账户总市值（元）") },
        {
          name: "note",
          label: msg("估值说明"),
          type: "textarea",
          required: false,
        },
      ],
      {
        date: data?.today,
        value: decimal(a.balance),
        note: "",
      },
    );
  }
  function categoryForm(c: Data | null = null) {
    setModal({
      title: c ? msg("修改分类") : msg("新增分类"),
      subtitle: msg("新名称用于以后记录，历史名称按版本保留"),
      body: (
        <Form
          initial={
            c
              ? { ...c, group: c.group_name }
              : { kind: "EXPENSE", group: msg("日常生活") }
          }
          fields={[
            { name: "name", label: msg("分类名称") },
            { name: "group", label: msg("上级分组") },
            ...(!c
              ? [
                  selectField("kind", msg("分类类型"), [
                    { value: "EXPENSE", label: msg("支出") },
                    { value: "INCOME", label: msg("收入") },
                  ]),
                ]
              : []),
          ]}
          onSubmit={async (p, op) => {
            await mutate(
              "saveCategory",
              { ...p, id: c?.id, revision: c?.revision },
              op,
            );
            close();
          }}
        />
      ),
    });
  }
  function budgetEditor(defaults = false) {
    setModal({
      title: defaults ? msg("个人默认预算") : msg("调整本周期预算"),
      subtitle: defaults
        ? msg("仅用于以后新建周期，不改变既有周期")
        : msg("初始预算与每次调整都会保留历史"),
      wide: true,
      body: (
        <BudgetEditor
          data={data!}
          defaults={defaults}
          onSave={async (p) => {
            await mutate("saveBudget", p);
            close();
          }}
        />
      ),
    });
  }
  function billForm(b: Data | null = null) {
    setModal({
      title: b ? msg("修改固定账单") : msg("新增固定账单"),
      subtitle: msg("到期生成待办，确认实际支付后才计入支出"),
      body: (
        <Form
          initial={{
            ...b,
            amount: decimal(b?.amount_minor || "0"),
            frequency: b?.frequency || "MONTHLY",
            day: b?.day || 10,
            start_date: b?.start_date || data?.today,
            account_id: b?.account_id || data?.settings.defaults.SPENDING,
            category_id:
              b?.category_id ||
              cats.find((c: Data) => c.kind === "EXPENSE")?.id,
          }}
          fields={[
            { name: "name", label: msg("账单名称") },
            { name: "amount", type: "money", label: msg("预计金额（元）") },
            selectField("account_id", msg("付款账户"), accountOptions),
            selectField(
              "category_id",
              msg("分类"),
              cats
                .filter((c: Data) => c.kind === "EXPENSE" && !c.archived)
                .map((c: Data) => ({ value: c.id, label: localized(c.name) })),
            ),
            selectField("frequency", msg("频率"), [
              { value: "MONTHLY", label: msg("每月") },
              { value: "WEEKLY", label: msg("每周") },
            ]),
            {
              name: "day",
              label: msg("到期日"),
              type: "number",
              hint: msg("每月1—31；每周1—7，周一为1"),
            },
            { name: "start_date", label: msg("开始日期"), type: "date" },
          ]}
          onSubmit={async (p, op) => {
            await mutate(
              "saveBill",
              {
                ...p,
                id: b?.id,
                revision: b?.revision,
                amount_minor: parseMoneyExpression(p.amount),
              },
              op,
            );
            close();
          }}
        />
      ),
    });
  }
  function payBill(b: Data) {
    confirm(
      msg("确认账单支付"),
      tr("{0} · 到期日 {1}。仅在实际支付后确认。", b.name, b.due_date),
      async (p, op) =>
        mutate(
          "processBill",
          {
            id: b.id,
            amount_minor: parseMoneyExpression(p.amount),
            date: p.date,
            transaction_id: p.transaction_id || undefined,
          },
          op,
        ),
      [
        { name: "amount", type: "money", label: msg("实际金额（元）") },
        { name: "date", label: msg("实际日期"), type: "date" },
        {
          name: "transaction_id",
          label: msg("或关联已记录的支出ID"),
          required: false,
          hint: msg("交易详情可复制ID，避免重复记账"),
        },
      ],
      { amount: decimal(b.amount_minor), date: data?.today },
    );
  }
  function allocation(salary: Data) {
    setModal({
      title: msg("工资分配助手"),
      subtitle: msg(
        "先计算建议，在银行完成后逐项确认。本应用不会执行银行转账。",
      ),
      wide: true,
      body: (
        <Allocation
          salary={salary}
          data={data!}
          onDone={async () => {
            await load();
            close();
          }}
        />
      ),
    });
  }
  async function importCSV() {
    const p = await api("importChoose");
    if (!p) return;
    setModal({
      title: msg("导入 CSV"),
      subtitle: msg(
        "先检查字段、错误和疑似重复，再确认导入；数据会在提交前自动备份",
      ),
      wide: true,
      body: (
        <ImportPreview
          initial={p}
          onDone={async () => {
            await load();
            close();
            setToast(msg("导入完成"));
          }}
        />
      ),
    });
  }
  async function restore() {
    const r = await api("restorePreview");
    if (!r) return;
    confirm(
      msg("恢复完整账本"),
      tr(
        "备份含 {0} 个账户、{1} 笔有效记录。此操作会替换当前账本；替换前会自动保存当前安全副本。",
        r.info.accounts,
        r.info.transactions,
      ),
      async () => {
        await api("restoreConfirm", { token: r.token });
        setQuery({});
        await load({});
        setToast(msg("账本恢复完成"));
      },
    );
  }
  function details(t: Data) {
    setModal({
      title: kinds[t.kind] + msg("详情"),
      subtitle: t.date + " · " + (t.category_name || msg("账户资金变动")),
      body: (
        <>
          <div className="detail-amount">¥ {fmt(t.amount_minor)}</div>
          <dl>
            <dt>{msg("付款账户")}</dt>
            <dd>{t.source_name || "—"}</dd>
            <dt>{msg("收款账户")}</dt>
            <dd>{t.destination_name || "—"}</dd>
            <dt>{msg("分类")}</dt>
            <dd>
              {t.group_name
                ? `${localized(t.group_name)} / ${localized(t.category_name)}`
                : msg("不计预算")}
            </dd>
            <dt>{msg("备注")}</dt>
            <dd>{t.note || "—"}</dd>
            <dt>{msg("交易ID")}</dt>
            <dd className="mono">
              {t.id}{" "}
              <button
                className="icon-button"
                aria-label={msg("复制交易ID")}
                title={msg("复制交易ID")}
                onClick={() => {
                  navigator.clipboard.writeText(t.id);
                  setToast(msg("交易ID已复制"));
                }}
              >
                <Copy size={14} />
              </button>
            </dd>
          </dl>
          <div className="detail-actions">
            <button onClick={() => act(() => showHistory("transaction", t.id))}>
              <History size={16} />
              {msg("修改历史")}
            </button>
            {!t.deleted &&
              ["INCOME", "EXPENSE", "TRANSFER", "REFUND"].includes(t.kind) && (
                <button onClick={() => transaction(t.kind, t)}>
                  <Pencil size={16} />
                  {msg("修改")}
                </button>
              )}
            {t.kind === "EXPENSE" && !t.deleted && (
              <button onClick={() => transaction("REFUND", null, t)}>
                <RotateCcw size={16} />
                {msg("退款")}
              </button>
            )}
            {t.salary && !t.deleted && (
              <button onClick={() => allocation(t)}>
                <Sparkles size={16} />
                {msg("工资分配")}
              </button>
            )}
            {t.deleted ? (
              <button
                onClick={() =>
                  confirm(
                    msg("恢复交易"),
                    msg("恢复时会重新校验退款、周期和账户状态。"),
                    async (_, op) =>
                      mutate(
                        "restoreTransaction",
                        { id: t.id, revision: t.revision },
                        op,
                      ),
                  )
                }
              >
                <RotateCcw size={16} />
                {msg("恢复")}
              </button>
            ) : (
              t.kind !== "OPENING" && (
                <button
                  className="danger"
                  onClick={() =>
                    confirm(
                      msg("移入回收站"),
                      msg(
                        "余额与相关预算将重新计算。关联账单或分配项将退回待处理。",
                      ),
                      async (p, op) =>
                        mutate(
                          "deleteTransaction",
                          {
                            id: t.id,
                            revision: t.revision,
                            with_refunds: p.with_refunds,
                            reason: p.reason,
                          },
                          op,
                        ),
                      [
                        {
                          name: "with_refunds",
                          label: msg("同时撤销关联退款"),
                          type: "checkbox",
                          required: false,
                          hint: msg("如有退款，需一并撤销以避免孤立记录"),
                        },
                        {
                          name: "reason",
                          label: msg("删除原因"),
                          required: false,
                        },
                      ],
                    )
                  }
                >
                  <Trash2 size={16} />
                  {msg("删除")}
                </button>
              )
            )}
          </div>
        </>
      ),
    });
  }
  function TransactionTable({
    rows,
    compact = false,
  }: {
    rows: Data[];
    compact?: boolean;
  }) {
    return rows.length ? (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{msg("交易 / 分类")}</th>
              <th>{msg("账户")}</th>
              <th>{msg("日期")}</th>
              <th className="align-right">{msg("金额")}</th>
              {!compact && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr
                key={t.id}
                onClick={() => details(t)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") details(t);
                }}
              >
                <td>
                  <div className="transaction-name">
                    <span
                      className={"transaction-icon " + t.kind.toLowerCase()}
                    >
                      {t.kind === "INCOME" || t.kind === "REFUND" ? (
                        <ArrowDownLeft size={18} />
                      ) : t.kind === "TRANSFER" ? (
                        <ArrowLeftRight size={18} />
                      ) : (
                        <ArrowUpRight size={18} />
                      )}
                    </span>
                    <div>
                      <strong>
                        {t.kind === "TRANSFER"
                          ? msg("账户转账")
                          : t.category_name || kinds[t.kind]}
                      </strong>
                      <small>{t.note || kinds[t.kind]}</small>
                    </div>
                  </div>
                </td>
                <td className="muted">
                  {t.kind === "TRANSFER"
                    ? `${t.source_name} → ${t.destination_name}`
                    : t.source_name || t.destination_name}
                </td>
                <td className="muted mono">{t.date}</td>
                <td
                  className={
                    "align-right money " +
                    (["INCOME", "REFUND"].includes(t.kind) ? "positive" : "")
                  }
                >
                  {t.kind === "EXPENSE"
                    ? "−"
                    : ["INCOME", "REFUND"].includes(t.kind)
                      ? "+"
                      : ""}
                  ¥ {fmt(t.amount_minor)}
                </td>
                {!compact && (
                  <td>
                    <ChevronRight size={15} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty
        action={
          <button className="primary" onClick={() => transaction()}>
            <Plus size={16} />
            {msg("记一笔")}
          </button>
        }
      />
    );
  }
  if (!data)
    return (
      <div className="loading-screen">
        <div className="brand-mark">
          <Wallet size={26} />
        </div>
        <h2>{msg("薪流 SalaryFlow")}</h2>
        <p>{error || msg("正在打开本地账本…")}</p>
        {error && <button onClick={() => load()}>{msg("重新尝试")}</button>}
      </div>
    );
  if (!data.settings.initialized)
    return (
      <>
        <Onboarding onDone={() => load({})} onRestore={() => act(restore)} />
        {modal && (
          <Modal
            title={modal.title}
            subtitle={modal.subtitle}
            wide={modal.wide}
            onClose={close}
          >
            {modal.body}
          </Modal>
        )}
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </>
    );
  const s = data.cycleReport;
  const plannedIncome = data.settings.expected_income?.[data.cycle.id];
  const headerSub: Data = {
    overview: msg("每一份收入，都有清晰的去处。"),
    transactions: msg("真实记录每一笔，让账目始终清楚。"),
    budget: msg("预算先行，为生活留出从容。"),
    accounts: msg("钱在哪里，一目了然。"),
    allocations: msg("工资到账后，补足生活资金，再安排储蓄与理财。"),
    analysis: msg("用真实记录，看见财务的变化。"),
    settings: msg("你的数据，由你掌握。"),
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Wallet size={24} />
          </span>
          <div>
            <strong>{msg("薪流")}</strong>
            <small>SalaryFlow</small>
          </div>
        </div>
        <div className="workspace-label">{msg("个人财务空间")}</div>
        <nav>
          {pages.map((p) => (
            <button
              key={p.key}
              className={page === p.key ? "selected" : ""}
              onClick={() => goto(p.key)}
            >
              <p.icon size={19} />
              <span>{p.label}</span>
              {page === p.key && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <ShieldCheck size={17} />
            <div>
              <strong>{msg("安心，留在本地")}</strong>
              <small>{msg("离线可用 · 无需登录")}</small>
            </div>
          </div>
          <div className="profile">
            <span>{msg("我")}</span>
            <div>
              <strong>{msg("我的账本")}</strong>
              <small>
                {msg("人民币 · ")}
                {(data.cycleRules.find(
                  (r: Data) => r.effective_from <= data.today,
                )?.basis ?? "SALARY") === "SALARY"
                  ? msg("工资周期")
                  : msg("自然月")}
              </small>
            </div>
            <button
              className="icon-button"
              onClick={() => goto("settings")}
              aria-label={msg("打开设置")}
              title={msg("打开设置")}
            >
              <Settings2 size={17} />
            </button>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            {msg("我的账本")}
            <ChevronRight size={13} />{" "}
            <b>{pages.find((p) => p.key === page)?.label}</b>
          </div>
          <div className="top-actions">
            <span className="local-status">
              <span />
              {loading ? msg("正在更新") : msg("数据已保存在本地")}
            </span>
            <button
              className="icon-button"
              aria-label={msg("全局金额显示开关")}
              title={msg(
                "总开关：关闭时所有金额均隐藏；打开后仍需相应卡片或账户允许显示",
              )}
              onClick={() => act(() => toggleAmount())}
            >
              {canShowAmount() ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
            <button
              className="icon-button"
              aria-label={msg("切换主题")}
              title={msg("切换主题")}
              onClick={() =>
                act(() =>
                  mutate("saveSettings", {
                    theme:
                      document.documentElement.dataset.theme === "dark"
                        ? "light"
                        : "dark",
                  }),
                )
              }
            >
              {document.documentElement.dataset.theme === "dark" ? (
                <Sun size={18} />
              ) : (
                <Moon size={18} />
              )}
            </button>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {page === "overview"
                  ? msg("把生活，安排得刚刚好")
                  : msg("薪流 · 个人现金流管理")}
              </p>
              <h1>
                {page === "overview"
                  ? msg("财务总览")
                  : pages.find((p) => p.key === page)?.label}
              </h1>
              <p>{headerSub[page]}</p>
            </div>
            <div className="heading-actions">
              {!["settings", "accounts"].includes(page) && (
                <select
                  className="cycle-select"
                  value={data.cycle.id}
                  onChange={(e) => {
                    setRange("cycle");
                    setQuery({
                      ...query,
                      cycle_id: e.target.value,
                      page: 0,
                      start: undefined,
                      end: undefined,
                    });
                  }}
                >
                  {data.cycles.map((c: Data) => (
                    <option key={c.id} value={c.id}>
                      {c.start} — {addDays(c.end, -1)}
                    </option>
                  ))}
                </select>
              )}
              <button className="primary" onClick={() => transaction()}>
                <Plus size={18} />
                {msg("记一笔")}
              </button>
            </div>
          </div>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          {data.cycle.status === "DRAFT" &&
            ["overview", "budget"].includes(page) && (
              <div className="notice">
                <CalendarDays size={19} />
                <div>
                  <b>{msg("这个工资周期等待设置")}</b>
                  <span>{msg("可以先记账，再确认本周期预算。")}</span>
                </div>
                <button
                  onClick={() =>
                    confirm(
                      msg("创建周期预算"),
                      msg("选择预算来源，实际交易不会被复制。"),
                      async (p, op) =>
                        mutate(
                          "openCycle",
                          { id: data.cycle.id, source: p.source },
                          op,
                        ),
                      [
                        selectField("source", msg("预算来源"), [
                          { value: "default", label: msg("个人默认预算") },
                          { value: "previous", label: msg("复制上一周期") },
                          { value: "blank", label: msg("空白预算") },
                        ]),
                      ],
                      { source: "default" },
                    )
                  }
                >
                  {msg("设置预算")}
                  <ArrowRight size={15} />
                </button>
              </div>
            )}
          {page === "overview" && (
            <>
              <div className="overview-top">
                <section
                  className="hero-card"
                  style={{
                    background: budgetColor(
                      data.cycleReport.net,
                      data.totalBudget,
                    ).replace("65% 38%", "65% 28%"),
                  }}
                >
                  <div className="hero-top">
                    <span>
                      <span className="live-dot" />
                      {msg("本周期剩余预算")}
                    </span>
                    <div className="card-head-actions">
                      <button
                        className="card-amount-toggle"
                        aria-label={msg("切换本周期预算卡金额")}
                        title={msg(
                          "仅控制本周期预算卡；全局金额显示关闭时仍会隐藏",
                        )}
                        onClick={() =>
                          act(() => toggleAmount("overview", "budget"))
                        }
                      >
                        {localAllowsAmount("overview", "budget") ? (
                          <Eye size={16} />
                        ) : (
                          <EyeOff size={16} />
                        )}
                      </button>
                      <span className="tag ghost">
                        {data.cycle.status === "CLOSED"
                          ? msg("已结算")
                          : msg("进行中")}
                      </span>
                    </div>
                  </div>
                  <div className="hero-number">
                    <span>¥</span>
                    {fmt(data.remainingBudget, "overview", "budget")}
                  </div>
                  <p>{msg("预算余额是计划额度；消费账户余额是实际资金。")}</p>
                  <div className="budget-reality">
                    <span>
                      <small>
                        {data.spendingAccount
                          ? localized(data.spendingAccount.name) + msg("余额")
                          : msg("主要消费账户未设置")}
                      </small>
                      <strong>
                        ¥ {fmt(data.spendingBalance, "overview", "budget")}
                      </strong>
                    </span>
                    <span>
                      <small>
                        {msg("当前可安心支出")}
                        <InfoTip
                          text={msg(
                            "取本周期剩余预算与主要消费账户可用余额中较小的非负值",
                          )}
                        />
                      </small>
                      <strong>
                        ¥ {fmt(data.spendableNow, "overview", "budget")}
                      </strong>
                    </span>
                  </div>
                  <div className="hero-bottom">
                    <div>
                      <small>{msg("本周期预算")}</small>
                      <strong>
                        ¥ {fmt(data.totalBudget, "overview", "budget")}
                      </strong>
                    </div>
                    <div>
                      <small>{msg("已用净支出")}</small>
                      <strong>¥ {fmt(s.net, "overview", "budget")}</strong>
                    </div>
                    <button
                      onClick={() =>
                        goto("budget", { cycle_id: data.cycle.id })
                      }
                      aria-label={msg("查看预算")}
                      title={msg("查看预算")}
                    >
                      <ArrowUpRight size={23} />
                    </button>
                  </div>
                </section>
                <section className="summary-card">
                  <div className="metric-label">
                    <span className="mini-icon green">
                      <ArrowDownLeft size={19} />
                    </span>
                    {msg("本周期收入")}
                    <button
                      className="card-amount-toggle"
                      aria-label={msg("切换本周期收入卡金额")}
                      title={msg(
                        "仅控制本周期收入卡；全局金额显示关闭时仍会隐藏",
                      )}
                      onClick={() =>
                        act(() => toggleAmount("overview", "income"))
                      }
                    >
                      {localAllowsAmount("overview", "income") ? (
                        <Eye size={16} />
                      ) : (
                        <EyeOff size={16} />
                      )}
                    </button>
                  </div>
                  <h2>¥ {fmt(s.income, "overview", "income")}</h2>
                  <div className="mini-divider" />
                  <div className="metric-label">
                    {msg("本周期净结余")}
                    <span className="muted">{msg("收入 − 净支出")}</span>
                  </div>
                  <strong className="medium-number">
                    ¥ {fmt(s.saving, "overview", "income")}
                  </strong>
                  <div className="metric-foot">
                    <span>{msg("储蓄率")}</span>
                    <b className="positive">
                      {s.rate === null ? "—" : s.rate + "%"}
                    </b>
                  </div>
                </section>
                <section className="summary-card assets-summary">
                  <div className="metric-label">
                    <span className="mini-icon blue">
                      <Landmark size={19} />
                    </span>
                    {msg("账户总资产")}
                    <button
                      className="card-amount-toggle"
                      aria-label={msg("切换账户总资产卡金额")}
                      title={msg(
                        "仅控制账户总资产卡；全局金额显示关闭时仍会隐藏",
                      )}
                      onClick={() =>
                        act(() => toggleAmount("overview", "assets"))
                      }
                    >
                      {localAllowsAmount("overview", "assets") ? (
                        <Eye size={16} />
                      ) : (
                        <EyeOff size={16} />
                      )}
                    </button>
                  </div>
                  <h2>¥ {fmt(data.totalAssets, "overview", "assets")}</h2>
                  <p className="muted">
                    {msg("包含全部账户，隐藏与归档不影响合计")}
                  </p>
                  <div className="asset-stack">
                    {accounts.slice(0, 3).map((a: Data, i: number) => (
                      <span
                        key={a.id}
                        style={{
                          background: ["#dcebe6", "#e6e6f2", "#f3e7d7"][i],
                        }}
                      >
                        {a.name.slice(0, 1)}
                      </span>
                    ))}
                    <small>
                      {accounts.length}
                      {msg("个在用账户")}
                    </small>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => goto("accounts")}
                  >
                    {msg("查看我的账户")}
                    <ArrowRight size={15} />
                  </button>
                </section>
              </div>
              <div className="two-column">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>{msg("预算进行时")}</h3>
                      <p>{msg("把握节奏，留一点余地")}</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() =>
                        goto("budget", { cycle_id: data.cycle.id })
                      }
                    >
                      {msg("全部预算")}
                      <ChevronRight size={15} />
                    </button>
                  </div>
                  <div className="budget-preview">
                    {[...data.budgetRows]
                      .sort((a, b) =>
                        Number(BigInt(b.actual) - BigInt(a.actual)),
                      )
                      .filter(
                        (x: Data) =>
                          BigInt(x.budget) > 0n || BigInt(x.actual) !== 0n,
                      )
                      .slice(0, 5)
                      .map((b: Data, i: number) => (
                        <div className="budget-preview-row" key={b.category_id}>
                          <span className={"category-tile tile-" + (i % 4)}>
                            <Wallet size={17} />
                          </span>
                          <div className="budget-track">
                            <div>
                              <strong>{b.name}</strong>
                              <span>
                                <b>¥ {fmt(b.actual)}</b>
                                <small> / {fmt(b.budget)}</small>
                              </span>
                            </div>
                            <div className="progress">
                              <span
                                className={b.state === "超出预算" ? "over" : ""}
                                style={{
                                  background: budgetColor(b.actual, b.budget),
                                  width:
                                    Math.max(
                                      0,
                                      Math.min(100, Number(b.rate) || 0),
                                    ) + "%",
                                }}
                              />
                            </div>
                          </div>
                          <span
                            className={
                              "tag " +
                              (b.state === "超出预算" ? "warn" : "neutral")
                            }
                          >
                            {msg(b.state)}
                          </span>
                        </div>
                      ))}
                  </div>
                  {!data.budgetRows.length && (
                    <Empty
                      title={msg("还没有设置预算")}
                      hint={msg("从个人默认预算开始，也可以创建空白预算。")}
                    />
                  )}
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>{msg("本期待办")}</h3>
                      <p>{msg("重要的小事，不遗漏")}</p>
                    </div>
                    <div className="row-actions">
                      <span className="count-tag">
                        {
                          data.occurrences.filter(
                            (b: Data) =>
                              (b.snoozed_to || b.due_date) <= data.today,
                          ).length
                        }
                      </span>
                      <button onClick={() => billForm()}>
                        <Plus size={15} />
                        {msg("新增账单")}
                      </button>
                      <button
                        onClick={() => {
                          goto("settings");
                          setSettingsTab("bills");
                        }}
                      >
                        {msg("查看全部")}
                      </button>
                    </div>
                  </div>
                  {data.occurrences.some(
                    (b: Data) => (b.snoozed_to || b.due_date) <= data.today,
                  ) ? (
                    <div className="bill-list">
                      {data.occurrences
                        .filter(
                          (b: Data) =>
                            (b.snoozed_to || b.due_date) <= data.today,
                        )
                        .slice(0, 4)
                        .map((b: Data) => (
                          <div className="bill-row" key={b.id}>
                            <span className="bill-date">
                              {b.due_date.slice(5).replace("-", "/")}
                            </span>
                            <div>
                              <strong>{b.name}</strong>
                              <small>¥ {fmt(b.amount_minor)}</small>
                            </div>
                            <button onClick={() => payBill(b)}>
                              {msg("确认")}
                            </button>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="calm-empty">
                      <CheckCircle2 size={34} />
                      <h3>{msg("暂时没有待付账单")}</h3>
                      <p>
                        {msg("为房租、订阅设置固定账单，")}
                        <br />
                        {msg("到期后再确认实际支出。")}
                      </p>
                      <button
                        className="text-button"
                        onClick={() => billForm()}
                      >
                        <Plus size={15} />
                        {msg("添加固定账单")}
                      </button>
                    </div>
                  )}
                  <div className="tip">
                    <CircleHelp size={16} />
                    <span>
                      {msg("转入储蓄账户是资金移动，不会重复增加净结余。")}
                    </span>
                  </div>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>{msg("最近交易")}</h3>
                    <p>{msg("每个数字，都有来处")}</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => goto("transactions")}
                  >
                    {msg("查看全部")}
                    <ChevronRight size={15} />
                  </button>
                </div>
                <TransactionTable
                  rows={data.transactions.slice(0, 5)}
                  compact
                />
              </section>
              <div className="page-foot">
                <ShieldCheck size={14} />
                {msg("数据仅存储于本机 · 截至")}
                {data.today}
                {data.cycle.partial ? msg("· 本周期记录可能不完整") : ""}
              </div>
            </>
          )}
          {page === "transactions" && (
            <>
              <section className="panel">
                <div className="filters">
                  <div className="search-box">
                    <Search size={17} />
                    <input
                      placeholder={msg("搜索备注、分类或账户…")}
                      value={query.search || ""}
                      onChange={(e) =>
                        setQuery({ ...query, search: e.target.value, page: 0 })
                      }
                    />
                  </div>
                  <select
                    aria-label={msg("筛选交易类型")}
                    title={msg("筛选交易类型")}
                    value={query.kind || ""}
                    onChange={(e) =>
                      setQuery({ ...query, kind: e.target.value, page: 0 })
                    }
                  >
                    <option value="">{msg("全部类型")}</option>
                    {Object.entries(kinds).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={msg("筛选账户")}
                    title={msg("筛选账户")}
                    value={query.account_id || ""}
                    onChange={(e) =>
                      setQuery({
                        ...query,
                        account_id: e.target.value,
                        page: 0,
                      })
                    }
                  >
                    <option value="">{msg("全部账户")}</option>
                    {data.accounts.map((a: Data) => (
                      <option key={a.id} value={a.id}>
                        {localized(a.name)}
                      </option>
                    ))}
                  </select>
                  <button
                    className={query.deleted ? "danger" : ""}
                    onClick={() =>
                      setQuery({ ...query, deleted: !query.deleted, page: 0 })
                    }
                  >
                    <Trash2 size={15} />
                    {query.deleted ? msg("查看正常交易") : msg("回收站")}
                  </button>
                  <button
                    onClick={() =>
                      setQuery({
                        ...query,
                        start: "1900-01-01",
                        end: "2199-12-31",
                        page: 0,
                      })
                    }
                  >
                    {msg("全部日期")}
                  </button>
                </div>
                {(query.category_id || query.category_version_id) && (
                  <div className="inline-notice">
                    {msg("按分类筛选中")}
                    <button
                      onClick={() =>
                        setQuery({
                          ...query,
                          category_id: undefined,
                          category_version_id: undefined,
                        })
                      }
                    >
                      {msg("清除分类筛选")}
                    </button>
                  </div>
                )}
                <TransactionTable rows={data.transactions} />
                <div className="table-footer">
                  <span>
                    {msg("共")}
                    {data.total}
                    {msg("笔 ·")}
                    {query.start || data.cycle.start} —{" "}
                    {addDays(query.end || data.cycle.end, -1)}
                  </span>
                  <div>
                    <HoverHint
                      text={
                        data.page
                          ? msg("查看上一页交易")
                          : msg("已经是第一页，没有上一页。")
                      }
                    >
                      <button
                        disabled={!data.page}
                        aria-label={msg("上一页")}
                        onClick={() =>
                          setQuery({ ...query, page: data.page - 1 })
                        }
                      >
                        <ChevronLeft size={16} />
                      </button>
                    </HoverHint>
                    <span>{data.page + 1}</span>
                    <HoverHint
                      text={
                        (data.page + 1) * 100 >= data.total
                          ? msg("已经是最后一页，没有下一页。")
                          : msg("查看下一页交易")
                      }
                    >
                      <button
                        disabled={(data.page + 1) * 100 >= data.total}
                        aria-label={msg("下一页")}
                        onClick={() =>
                          setQuery({ ...query, page: data.page + 1 })
                        }
                      >
                        <ChevronRight size={16} />
                      </button>
                    </HoverHint>
                  </div>
                </div>
              </section>
            </>
          )}
          {page === "budget" && (
            <>
              <div className="panel setting-row">
                <span>
                  {msg("周期可在这里调整，历史交易不会静默重新分组。")}
                </span>
                <button
                  onClick={() => {
                    goto("settings");
                    setSettingsTab("general");
                  }}
                >
                  {msg("修改工资日")}
                </button>
                <button
                  onClick={() =>
                    confirm(
                      msg("更正当前周期边界"),
                      msg(
                        "仅允许未结算且包含全部现有交易的边界；结束日期不计入本周期，必须衔接相邻周期。",
                      ),
                      async (p, op) =>
                        mutate("adjustCycle", { ...p, id: data.cycle.id }, op),
                      [
                        { name: "start", label: msg("开始日期"), type: "date" },
                        {
                          name: "end",
                          label: msg("结束日期（不含）"),
                          type: "date",
                        },
                        { name: "reason", label: msg("修改原因") },
                      ],
                      { start: data.cycle.start, end: data.cycle.end },
                    )
                  }
                >
                  {msg("更正当前周期边界")}
                </button>
              </div>
              {plannedIncome != null && (
                <div className="inline-notice">
                  {msg("计划净结余 ¥")}
                  {fmt(BigInt(plannedIncome) - BigInt(data.totalBudget))}
                  {msg("· 预期收入 ¥")}
                  {fmt(plannedIncome)}
                  {msg("− 当前预算（不计实际收支）")}
                </div>
              )}
              <div className="section-actions">
                <span className="tag neutral">
                  {data.cycle.status === "CLOSED"
                    ? msg("已结算")
                    : data.cycle.status === "DRAFT"
                      ? msg("待设置")
                      : msg("开放周期")}
                </span>
                <button
                  onClick={() =>
                    confirm(
                      msg("设置预期收入"),
                      msg("用于计划净结余，不会写入实际收入。留空可清除。"),
                      async (p, op) =>
                        mutate(
                          "setExpectedIncome",
                          {
                            cycle_id: data.cycle.id,
                            amount_minor: p.amount
                              ? parseMoneyExpression(p.amount, { zero: true })
                              : null,
                          },
                          op,
                        ),
                      [
                        {
                          name: "amount",
                          type: "money",
                          label: msg("本周期预计收入（元）"),
                          required: false,
                        },
                      ],
                      {
                        amount:
                          plannedIncome == null ? "" : decimal(plannedIncome),
                      },
                    )
                  }
                >
                  {msg("预期收入")}
                </button>
                <button onClick={() => budgetEditor(true)}>
                  {msg("个人默认预算")}
                </button>
                <button
                  onClick={() =>
                    act(async () => {
                      const history = await api("budgetHistory", {
                        cycle_id: data.cycle.id,
                      });
                      setModal({
                        title: msg("预算修改历史"),
                        wide: true,
                        body: (
                          <div className="history-list">
                            {history.map((b: Data) => (
                              <article key={b.id}>
                                <h3>
                                  {msg("版本")}
                                  {b.version} · {b.reason}
                                </h3>
                                <small>
                                  {new Date(b.created_at).toLocaleString(
                                    getLocale(),
                                  )}
                                </small>
                                <p>
                                  {msg("总预算 ¥")}
                                  {fmt(
                                    b.items.reduce(
                                      (n: bigint, x: Data) =>
                                        n +
                                        (x.enabled
                                          ? BigInt(x.amount_minor)
                                          : 0n),
                                      0n,
                                    ),
                                  )}{" "}
                                  · {b.items.length}
                                  {msg("个项目")}
                                </p>
                              </article>
                            ))}
                          </div>
                        ),
                      });
                    })
                  }
                >
                  <History size={16} />
                  {msg("预算历史")}
                </button>
                {data.cycle.status === "CLOSED" ? (
                  <button
                    onClick={() =>
                      confirm(
                        msg("重新打开周期"),
                        msg("历史结算快照会保留；修改后可以重新结算。"),
                        async (p, op) =>
                          mutate(
                            "reopen",
                            { id: data.cycle.id, reason: p.reason },
                            op,
                          ),
                        [{ name: "reason", label: msg("原因") }],
                      )
                    }
                  >
                    {msg("重新打开")}
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      confirm(
                        msg("周期结算"),
                        tr(
                          "请先核对账户、待付账单和分配项。当前净结余 ¥{0}，结算不会产生交易。",
                          fmt(s.saving),
                        ),
                        async (p, op) =>
                          mutate(
                            "settle",
                            { id: data.cycle.id, note: p.note },
                            op,
                          ),
                        [
                          {
                            name: "note",
                            label: msg("周期复盘"),
                            type: "textarea",
                            required: false,
                          },
                        ],
                      )
                    }
                  >
                    {msg("结算本周期")}
                  </button>
                )}
                <HoverHint
                  text={
                    data.cycle.status === "CLOSED"
                      ? msg(
                          "本周期已经结算。请先重新打开周期，再调整本周期预算。",
                        )
                      : msg(
                          "修改当前周期的分类预算；可选择同时更新个人默认预算。",
                        )
                  }
                >
                  <button
                    className="primary"
                    disabled={data.cycle.status === "CLOSED"}
                    onClick={() => budgetEditor()}
                  >
                    <Pencil size={16} />
                    {msg("调整预算")}
                  </button>
                </HoverHint>
              </div>
              <div className="stat-strip">
                {[
                  [msg("当前总预算"), data.totalBudget],
                  [msg("已用净支出"), s.net],
                  [msg("剩余预算"), data.remainingBudget],
                ].map(([name, v]) => (
                  <div key={name}>
                    <small>{name}</small>
                    <strong>¥ {fmt(v)}</strong>
                  </div>
                ))}
              </div>
              <section className="panel">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{msg("分类")}</th>
                        <th className="align-right">{msg("预算")}</th>
                        <th className="align-right">{msg("实际")}</th>
                        <th className="align-right">{msg("剩余")}</th>
                        <th>{msg("执行率")}</th>
                        <th>{msg("状态")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.budgetRows.map((b: Data) => (
                        <tr
                          key={b.category_id}
                          onClick={() =>
                            goto("transactions", {
                              cycle_id: data.cycle.id,
                              category_id: b.category_id,
                            })
                          }
                        >
                          <td>
                            <strong>{b.name}</strong>
                            <small className="block muted">{b.group}</small>
                          </td>
                          <td className="align-right money">{fmt(b.budget)}</td>
                          <td className="align-right money">{fmt(b.actual)}</td>
                          <td
                            className={
                              "align-right money " +
                              (BigInt(b.remaining) < 0n ? "negative" : "")
                            }
                          >
                            <span
                              style={{ color: budgetColor(b.actual, b.budget) }}
                            >
                              {fmt(b.remaining)}
                            </span>
                          </td>
                          <td>{b.rate === null ? "—" : b.rate + "%"}</td>
                          <td>
                            <span
                              className={
                                "tag " +
                                (b.state === "超出预算" ? "warn" : "neutral")
                              }
                            >
                              {msg(b.state)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              {data.settlements.length > 0 && (
                <section className="panel spaced">
                  <div className="panel-heading">
                    <h3>{msg("结算快照")}</h3>
                  </div>
                  {data.settlements.map((x: Data) => (
                    <div className="setting-row" key={x.id}>
                      <div>
                        <b>
                          {new Date(x.created_at).toLocaleString(getLocale())}
                        </b>
                        <p>
                          {x.note || msg("周期结算")}
                          {x.dirty
                            ? msg("· 受历史修订影响，当前值请以实时统计为准")
                            : ""}
                        </p>
                      </div>
                      <strong>
                        {msg("当时净结余 ¥")}
                        {fmt(x.data.report.saving)}
                      </strong>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
          {page === "allocations" && (
            <AllocationCenter
              data={data}
              onAllocate={allocation}
              onRecordSalary={() => transaction("INCOME")}
              mutate={mutate}
              ask={confirm}
              format={fmt}
            />
          )}
          {page === "accounts" && (
            <>
              <div className="section-actions">
                <div className="asset-total">
                  <small>{msg("全部账户总资产")}</small>
                  <div className="asset-total-value">
                    <strong>¥ {fmt(data.totalAssets, "accountSummary")}</strong>
                    <button
                      className="card-amount-toggle"
                      aria-label={msg("切换全部账户总资产金额")}
                      title={msg(
                        "仅控制“我的账户”页总资产；全局金额显示关闭时仍会隐藏",
                      )}
                      onClick={() => act(() => toggleAmount("accountSummary"))}
                    >
                      {localAllowsAmount("accountSummary", "") ? (
                        <Eye size={17} />
                      ) : (
                        <EyeOff size={17} />
                      )}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() =>
                    confirm(
                      msg("主要账户设置"),
                      msg(
                        "每个用途可以有多个账户，这里只设置新增时的默认选择。",
                      ),
                      async (p, op) => mutate("setDefaults", p, op),
                      Object.keys(roles).map((r) =>
                        selectField(
                          r,
                          msg("主要") + roles[r] + msg("账户"),
                          accounts
                            .filter((a: Data) => a.roles.includes(r))
                            .map((a: Data) => ({
                              value: a.id,
                              label: localized(a.name),
                            })),
                          false,
                        ),
                      ),
                      data.settings.defaults,
                    )
                  }
                >
                  {msg("设置主要账户")}
                </button>
                <button className="primary" onClick={() => editAccount()}>
                  <Plus size={16} />
                  {msg("新增账户")}
                </button>
              </div>
              <div className="account-grid">
                {data.accounts.map((a: Data, i: number) => (
                  <section
                    key={a.id}
                    className={
                      "account-card account-" +
                      (i % 3) +
                      (a.archived ? " archived" : "")
                    }
                  >
                    <div className="account-card-top">
                      <span className="bank-symbol">
                        <Landmark size={23} />
                      </span>
                      <span>{localized(a.type_name)}</span>
                      <div className="account-head-actions">
                        <button
                          className="icon-button"
                          aria-label={msg("切换账户金额") + a.name}
                          title={msg(
                            "仅控制此账户；全局金额显示关闭时仍会隐藏",
                          )}
                          onClick={() =>
                            act(() => toggleAmount("account", a.id))
                          }
                        >
                          {localAllowsAmount("account", a.id) ? (
                            <Eye size={17} />
                          ) : (
                            <EyeOff size={17} />
                          )}
                        </button>
                        <button
                          className="icon-button"
                          aria-label={msg("编辑") + a.name}
                          title={msg("编辑") + a.name}
                          onClick={() => editAccount(a)}
                        >
                          <Pencil size={17} />
                        </button>
                      </div>
                    </div>
                    <h3>
                      {localized(a.name)}
                      {!!a.archived && <small>{msg("（已归档）")}</small>}
                    </h3>
                    <p>
                      {a.roles
                        .map(
                          (r: string) =>
                            (data.settings.defaults[r] === a.id
                              ? msg("主要")
                              : "") + roles[r],
                        )
                        .join(" · ") || msg("尚未设置用途")}
                      {a.hidden ? msg("· 已隐藏") : ""}
                    </p>
                    <strong className="account-balance">
                      ¥ {fmt(a.balance, "account", a.id)}
                    </strong>
                    <div className="account-date">
                      {a.valuation_mode
                        ? a.last_valuation
                          ? msg("最新估值") + " " + a.last_valuation.date
                          : msg("尚未录入估值，当前按流水余额显示")
                        : msg("余额基准日") + a.start_date}
                    </div>
                    <div className="account-tools">
                      <HoverHint
                        text={
                          i === 0
                            ? msg("这个账户已经排在最前面，不能继续上移。")
                            : msg("将这个账户向前移动一位。")
                        }
                      >
                        <button
                          disabled={i === 0}
                          onClick={() =>
                            act(async () => {
                              const ids = data.accounts.map((x: Data) => x.id);
                              [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                              await mutate("orderAccounts", { ids });
                            })
                          }
                        >
                          {msg("上移")}
                        </button>
                      </HoverHint>
                      <button
                        onClick={() =>
                          goto("transactions", {
                            account_id: a.id,
                            start: "1900-01-01",
                            end: "2199-12-31",
                          })
                        }
                      >
                        {msg("交易明细")}
                        <ChevronRight size={14} />
                      </button>
                      {a.valuation_mode ? (
                        <HoverHint
                          text={msg(
                            "录入某日账户总市值。市值涨跌只改变资产余额，不计为收入或支出。",
                          )}
                        >
                          <button onClick={() => updateValuation(a)}>
                            {msg("更新估值")}
                          </button>
                        </HoverHint>
                      ) : (
                        <HoverHint
                          text={msg(
                            "将账面余额调整为实际余额；产生的差额属于校准，不计收入、支出或预算。",
                          )}
                        >
                          <button
                            onClick={() =>
                              confirm(
                                msg("余额校准"),
                                tr(
                                  "当前账面余额 ¥{0}。差额将作为单独调整记录，不计收入与支出。",
                                  fmt(a.balance, "account", a.id),
                                ),
                                async (p, op) =>
                                  mutate(
                                    "calibrate",
                                    {
                                      account_id: a.id,
                                      actual_minor: parseMoneyExpression(
                                        p.actual,
                                        {
                                          signed: true,
                                          zero: true,
                                        },
                                      ),
                                      reason: p.reason,
                                    },
                                    op,
                                  ),
                                [
                                  {
                                    name: "actual",
                                    type: "money",
                                    label: msg("银行实际余额（元）"),
                                  },
                                  { name: "reason", label: msg("校准原因") },
                                ],
                                { actual: decimal(a.balance) },
                              )
                            }
                          >
                            {msg("校准")}
                          </button>
                        </HoverHint>
                      )}
                      <HoverHint
                        text={msg(
                          "把账户记账起点向更早日期扩展，需要填写新起点当时的真实余额。",
                        )}
                      >
                        <button
                          onClick={() =>
                            confirm(
                              msg("扩展记账起点"),
                              msg(
                                "需要提供更早日期开始前的真实余额。不会把历史消费重复叠加在原期初之上。",
                              ),
                              async (p, op) =>
                                mutate(
                                  "changeStart",
                                  {
                                    account_id: a.id,
                                    revision: a.revision,
                                    start_date: p.start_date,
                                    opening_minor: parseMoneyExpression(
                                      p.opening,
                                      {
                                        signed: true,
                                        zero: true,
                                      },
                                    ),
                                    reason: p.reason,
                                  },
                                  op,
                                ),
                              [
                                {
                                  name: "start_date",
                                  label: msg("更早基准日"),
                                  type: "date",
                                },
                                {
                                  name: "opening",
                                  type: "money",
                                  label: msg("当时的期初余额（元）"),
                                },
                                { name: "reason", label: msg("原因") },
                              ],
                              { start_date: a.start_date },
                            )
                          }
                        >
                          {msg("起点")}
                        </button>
                      </HoverHint>
                      <HoverHint
                        text={
                          a.archived
                            ? msg(
                                "恢复后账户会重新出现在日常选择中，历史记录始终保留。",
                              )
                            : msg(
                                "归档后账户不再用于新交易，但余额和历史记录仍保留在总资产中。",
                              )
                        }
                      >
                        <button
                          onClick={() =>
                            confirm(
                              a.archived
                                ? msg("恢复账户")
                                : msg("归档/删除账户"),
                              msg(
                                "归档保留全部历史；仅有零期初且未使用的账户可以删除。",
                              ),
                              async (p, op) =>
                                mutate(
                                  "archiveAccount",
                                  {
                                    id: a.id,
                                    revision: a.revision,
                                    remove: p.remove,
                                  },
                                  op,
                                ),
                              [
                                {
                                  name: "remove",
                                  label: msg("删除未使用账户"),
                                  type: "checkbox",
                                  required: false,
                                  hint: msg("有历史数据时请保持不勾选"),
                                },
                              ],
                            )
                          }
                        >
                          {a.archived ? msg("恢复") : msg("归档")}
                        </button>
                      </HoverHint>
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}
          {page === "analysis" && (
            <>
              <section className="panel range-panel">
                <CalendarDays size={18} />
                <select
                  aria-label={msg("统计时间口径")}
                  title={msg("统计时间口径")}
                  value={range}
                  onChange={(e) => {
                    const m = e.target.value;
                    setRange(m);
                    if (m === "cycle")
                      setQuery({ ...query, start: undefined, end: undefined });
                    else if (m !== "custom")
                      setQuery({ ...query, ...timeRange(m, anchor) });
                  }}
                >
                  {ranges.map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={anchor}
                  onChange={(e) => {
                    setAnchor(e.target.value);
                    if (
                      range !== "cycle" &&
                      range !== "custom" &&
                      e.target.value
                    )
                      act(async () =>
                        setQuery({
                          ...query,
                          ...timeRange(range, e.target.value),
                        }),
                      );
                  }}
                />
                {range === "custom" && (
                  <>
                    <input
                      aria-label={msg("开始日期")}
                      title={msg("开始日期")}
                      type="date"
                      value={custom.start}
                      onChange={(e) =>
                        setCustom({ ...custom, start: e.target.value })
                      }
                    />
                    <span>{msg("至")}</span>
                    <input
                      aria-label={msg("结束日期")}
                      title={msg("结束日期")}
                      type="date"
                      value={custom.end}
                      onChange={(e) =>
                        setCustom({ ...custom, end: e.target.value })
                      }
                    />
                    <button
                      onClick={() =>
                        act(async () =>
                          setQuery({
                            ...query,
                            ...timeRange("custom", anchor, custom),
                          }),
                        )
                      }
                    >
                      {msg("应用")}
                    </button>
                  </>
                )}
                <span className="muted">
                  {data.report.start} — {addDays(data.report.end, -1)}
                </span>
                <button
                  onClick={() =>
                    act(async () => {
                      const r = await api("export", {
                        format: "csv",
                        start: data.report.start,
                        end: data.report.end,
                      });
                      if (r) setToast(msg("已导出：") + r.file);
                    })
                  }
                >
                  <Download size={16} />
                  {msg("导出明细")}
                </button>
              </section>
              <section className="tip">
                {msg(
                  "当前范围无数据时，请切换时间范围。期初、校准和内部转账不属于收支。",
                )}
              </section>
              <div className="analysis-stats">
                {[
                  [msg("收入"), data.report.income],
                  [msg("毛支出"), data.report.expense],
                  [msg("退款"), data.report.refund],
                  [msg("净支出"), data.report.net],
                  [msg("净结余"), data.report.saving],
                ].map(([n, v]) => (
                  <div key={n}>
                    <small>{n}</small>
                    <strong>¥ {fmt(v)}</strong>
                  </div>
                ))}
                <div>
                  <small>{msg("储蓄率")}</small>
                  <strong>
                    {data.report.rate === null ? "—" : data.report.rate + "%"}
                  </strong>
                </div>
              </div>
              <Composition
                report={data.report}
                accounts={data.accounts}
                hidden={!canShowAmount()}
                onCategory={(id) =>
                  goto("transactions", {
                    start: data.report.start,
                    end: data.report.end,
                    category_version_id: id,
                  })
                }
              />
              <div className="two-column">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>{msg("收支趋势")}</h3>
                      <p>{msg("按实际发生日期统计")}</p>
                    </div>
                    <span className="legend">
                      <i />
                      {msg("收入")}
                      <i />
                      {msg("净支出")}
                    </span>
                  </div>
                  <Trend
                    today={data.today}
                    days={data.report.days}
                    start={data.report.start}
                    end={data.report.end}
                    hidden={!canShowAmount()}
                  />
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>{msg("支出构成")}</h3>
                      <p>{msg("毛支出占比 · 退款单独列示")}</p>
                    </div>
                  </div>
                  <div className="category-bars">
                    {[...data.report.groups]
                      .sort((a, b) =>
                        Number(BigInt(b.expense) - BigInt(a.expense)),
                      )
                      .slice(0, 7)
                      .map((g: Data) => (
                        <button
                          className="category-bar"
                          key={g.version_id}
                          onClick={() =>
                            goto("transactions", {
                              start: data.report.start,
                              end: data.report.end,
                              category_version_id: g.version_id,
                            })
                          }
                        >
                          <div>
                            <b>{g.name}</b>
                            <span>¥ {fmt(g.expense)}</span>
                          </div>
                          <div className="progress">
                            <span
                              style={{
                                width:
                                  (Number(data.report.expense) > 0
                                    ? (Number(g.expense) /
                                        Number(data.report.expense)) *
                                      100
                                    : 0) + "%",
                              }}
                            />
                          </div>
                        </button>
                      ))}
                    {!data.report.groups.length && (
                      <Empty
                        title={msg("此范围没有支出")}
                        hint={msg("记录支出后，将在这里看到分类构成。")}
                      />
                    )}
                  </div>
                </section>
              </div>
              <div className="two-column">
                <section className="panel analysis-extra">
                  <h3>{msg("与前一等长区间比较")}</h3>
                  <p className="muted">
                    {data.report.previous?.start} —{" "}
                    {data.report.previous &&
                      addDays(data.report.previous.end, -1)}
                  </p>
                  <table>
                    <thead>
                      <tr>
                        <th>{msg("指标")}</th>
                        <th>{msg("本期")}</th>
                        <th>{msg("前期")}</th>
                        <th>{msg("变化金额")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        [msg("收入"), "income"],
                        [msg("净支出"), "net"],
                        [msg("净结余"), "saving"],
                      ].map(([label, key]) => (
                        <tr key={key}>
                          <td>{label}</td>
                          <td>{fmt(data.report[key])}</td>
                          <td>{fmt(data.report.previous?.[key])}</td>
                          <td>
                            {fmt(
                              String(
                                BigInt(data.report[key]) -
                                  BigInt(data.report.previous?.[key] || 0),
                              ),
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
                <section className="panel analysis-extra">
                  <h3>{msg("收入结构")}</h3>
                  {(data.report.incomeGroups || []).map((g: Data) => (
                    <div className="setting-row" key={g.id}>
                      <span>{g.name}</span>
                      <strong>¥ {fmt(g.amount)}</strong>
                    </div>
                  ))}
                  {!data.report.incomeGroups?.length && (
                    <Empty title={msg("本范围暂无收入")} />
                  )}
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <h3>{msg("分类明细")}</h3>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>{msg("分类（发生时名称）")}</th>
                      <th className="align-right">{msg("毛支出")}</th>
                      <th className="align-right">{msg("退款")}</th>
                      <th className="align-right">{msg("净支出")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.report.groups.map((g: Data) => (
                      <tr
                        key={g.version_id}
                        onClick={() =>
                          goto("transactions", {
                            start: data.report.start,
                            end: data.report.end,
                            category_version_id: g.version_id,
                          })
                        }
                      >
                        <td>
                          {g.group} / {g.name}
                        </td>
                        <td className="align-right">{fmt(g.expense)}</td>
                        <td className="align-right">{fmt(g.refund)}</td>
                        <td className="align-right">{fmt(g.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )}
          {page === "settings" && (
            <>
              <div className="settings-tabs">
                {[
                  ["general", msg("偏好设置")],
                  ["help", msg("帮助与使用手册")],
                  ["categories", msg("收支分类")],
                  ["bills", msg("固定账单")],
                  ["data", msg("数据管理")],
                ].map(([k, v]) => (
                  <button
                    className={settingsTab === k ? "active" : ""}
                    key={k}
                    onClick={() => {
                      setSettingsTab(k);
                      if (k === "data")
                        act(async () => setInfo(await api("dataInfo")));
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
              {settingsTab === "help" && <Help />}
              {settingsTab === "general" && (
                <section className="panel">
                  <div className="setting-row">
                    <div>
                      <h3>{msg("余额不足保护")}</h3>
                      <p>
                        {msg(
                          "默认阻止余额不足的新支出和转账。仅在补录真实历史时开启允许负余额，并及时核对账目。",
                        )}
                      </p>
                    </div>
                    <label>
                      <input
                        type="checkbox"
                        checked={!!data.settings.allow_negative}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          confirm(
                            msg("更改余额保护"),
                            msg(
                              "允许负余额不会增加实际资金，也不代表银行授信。",
                            ),
                            async (_, op) =>
                              mutate(
                                "saveSettings",
                                { allow_negative: checked },
                                op,
                              ),
                          );
                        }}
                      />
                      {msg("允许负余额（历史补录）")}
                    </label>
                  </div>
                  <div className="setting-row">
                    <div>
                      <h3>
                        {getLocale() === "en" ? "Color palette" : "界面配色"}
                      </h3>
                      <p>
                        {getLocale() === "en"
                          ? "Works with light and dark modes. Budget warning colors remain independent."
                          : "配色与浅色/深色模式独立，预算预警色不受配色影响。"}
                      </p>
                    </div>
                    <div className="palette-options">
                      {[
                        ["forest", "森绿", "Forest", "#24745b"],
                        ["ocean", "海蓝", "Ocean", "#2563a2"],
                        ["violet", "鸢紫", "Violet", "#7952ac"],
                        ["amber", "暖琥珀", "Amber", "#99621e"],
                        ["rose", "玫瑰", "Rose", "#a4476c"],
                        ["slate", "石墨", "Slate", "#546775"],
                      ].map(([key, zh, en, color]) => (
                        <button
                          key={key}
                          aria-pressed={
                            (data.settings.palette || "forest") === key
                          }
                          onClick={() =>
                            act(() => mutate("saveSettings", { palette: key }))
                          }
                        >
                          <i style={{ background: color }} />
                          {getLocale() === "en" ? en : zh}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="setting-row">
                    <div>
                      <h3>{msg("外观主题")}</h3>
                      <p>{msg("浅色、深色，或跟随 Windows 系统")}</p>
                    </div>
                    <select
                      value={data.settings.theme}
                      onChange={(e) =>
                        act(() =>
                          mutate("saveSettings", {
                            theme: e.target.value,
                          }),
                        )
                      }
                    >
                      <option value="system">{msg("跟随系统")}</option>
                      <option value="light">{msg("浅色")}</option>
                      <option value="dark">{msg("深色")}</option>
                    </select>
                  </div>
                  <div className="setting-row">
                    <div>
                      <h3>{msg("预算周期口径")}</h3>
                      <p>
                        {msg(
                          "预算按所选周期管理；统计分析始终按交易实际发生日期筛选。",
                        )}
                      </p>
                      <p>
                        {msg("当前规则：")}
                        {(data.cycleRules.find(
                          (r: Data) => r.effective_from <= data.today,
                        )?.basis ?? "SALARY") === "SALARY"
                          ? msg("按工资周期")
                          : msg("按自然月")}
                        {(data.cycleRules.find(
                          (r: Data) => r.effective_from <= data.today,
                        )?.basis ?? "SALARY") === "SALARY"
                          ? " · " +
                            msg("每月") +
                            (data.cycleRules.find(
                              (r: Data) => r.effective_from <= data.today,
                            )?.payday ?? data.settings.payday) +
                            msg("日起算")
                          : " · " + msg("每月1日起算")}
                      </p>
                      {data.cycleRules
                        .filter((r: Data) => r.effective_from > data.today)
                        .map((r: Data) => (
                          <p key={r.id}>
                            {msg("待生效")}：{r.effective_from} ·{" "}
                            {r.basis === "CALENDAR_MONTH"
                              ? msg("按自然月")
                              : msg("按工资周期，每月") +
                                r.payday +
                                msg("日起算")}
                          </p>
                        ))}
                    </div>
                    <button
                      onClick={() => {
                        const active =
                          data.cycleRules.find(
                            (r: Data) => r.effective_from <= data.today,
                          ) ?? {};
                        confirm(
                          msg("修改预算周期规则"),
                          msg(
                            "可立即应用、从下一个周期开始，或指定未来日期。若边界内已有交易，应用会阻止不安全的重划。",
                          ),
                          async (p, op) =>
                            mutate(
                              "setPayday",
                              {
                                basis: p.basis,
                                payday:
                                  p.basis === "SALARY" ? Number(p.payday) : 1,
                                mode: p.mode,
                                effective_from:
                                  p.mode === "CUSTOM"
                                    ? p.effective_from
                                    : undefined,
                              },
                              op,
                            ),
                          [
                            selectField("basis", msg("预算周期口径"), [
                              {
                                value: "SALARY",
                                label: msg("按工资周期"),
                              },
                              {
                                value: "CALENDAR_MONTH",
                                label: msg("按自然月"),
                              },
                            ]),
                            {
                              name: "payday",
                              label: msg("工资周期起始日（1—31）"),
                              type: "number",
                              visible: (v) => v.basis === "SALARY",
                            },
                            selectField("mode", msg("生效方式"), [
                              {
                                value: "IMMEDIATE",
                                label: msg("立即应用于当前周期"),
                              },
                              {
                                value: "NEXT_CYCLE",
                                label: msg("下一个周期开始生效"),
                              },
                              {
                                value: "CUSTOM",
                                label: msg("指定日期开始生效"),
                              },
                            ]),
                            {
                              name: "effective_from",
                              label: msg("指定生效日期"),
                              type: "date",
                              visible: (v) => v.mode === "CUSTOM",
                            },
                          ],
                          {
                            basis: active.basis ?? "SALARY",
                            payday: active.payday ?? data.settings.payday,
                            mode: "NEXT_CYCLE",
                            effective_from: addDays(data.today, 1),
                          },
                        );
                      }}
                    >
                      {msg("修改周期规则")}
                    </button>
                  </div>
                  <div className="setting-row">
                    <div>
                      <h3>{msg("界面语言")}</h3>
                      <p>{msg("切换界面语言，不改变账本数据。")}</p>
                    </div>
                    <select
                      aria-label="Interface language"
                      value={getLocale()}
                      onChange={(e) =>
                        act(() =>
                          changeLocale(e.target.value as "zh-CN" | "en"),
                        )
                      }
                    >
                      <option value="zh-CN">简体中文</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <div className="setting-row">
                    <div>
                      <h3>{msg("关于薪流")}</h3>
                      <button onClick={() => setSettingsTab("help")}>
                        <CircleHelp size={16} />
                        {msg("帮助与使用手册")}
                      </button>
                      <p>
                        {msg(
                          "SalaryFlow 0.6.2 · 本地个人预算、现金流与理财资产",
                        )}
                      </p>
                      <p>
                        {msg(
                          "支持人民币资产账户、工资周期/自然月预算及理财估值；信用卡负债、多币种、银行直连和云同步尚未实现。",
                        )}
                      </p>
                    </div>
                    <p>{msg("由 XRosen26 使用 Codex 完成。")}</p>
                    <ShieldCheck size={32} className="positive" />
                  </div>
                </section>
              )}
              {settingsTab === "categories" && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>{msg("收支分类")}</h3>
                      <p>{msg("名称、分组可修改；历史版本始终保留")}</p>
                    </div>
                    <button className="primary" onClick={() => categoryForm()}>
                      <Plus size={16} />
                      {msg("新增分类")}
                    </button>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>{msg("分类")}</th>
                        <th>{msg("分组")}</th>
                        <th>{msg("类型")}</th>
                        <th>{msg("状态")}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {cats.map((c: Data) => (
                        <tr key={c.id}>
                          <td>{localized(c.name)}</td>
                          <td>{localized(c.group_name)}</td>
                          <td>{kinds[c.kind]}</td>
                          <td>{c.archived ? msg("已归档") : msg("使用中")}</td>
                          <td className="row-actions">
                            <HoverHint
                              text={
                                c.archived
                                  ? msg(
                                      "该分类已归档。请先点击“恢复”，再修改名称或分组。",
                                    )
                                  : msg(
                                      "修改分类名称或分组；历史交易仍保留当时的分类版本。",
                                    )
                              }
                            >
                              <button
                                disabled={!!c.archived}
                                onClick={() => categoryForm(c)}
                              >
                                <Pencil size={14} />
                                {msg("修改")}
                              </button>
                            </HoverHint>
                            <button
                              onClick={() =>
                                act(() =>
                                  mutate("archiveCategory", {
                                    id: c.id,
                                    revision: c.revision,
                                  }),
                                )
                              }
                            >
                              {c.archived ? msg("恢复") : msg("归档")}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
              {settingsTab === "bills" && (
                <>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h3>{msg("到期待办")}</h3>
                        <p>
                          {msg("实际支付后确认，可关联已有支出，避免重复记录")}
                        </p>
                      </div>
                      <button className="primary" onClick={() => billForm()}>
                        <Plus size={16} />
                        {msg("新增账单")}
                      </button>
                    </div>
                    {data.occurrences.map((b: Data) => (
                      <div className="setting-row" key={b.id}>
                        <div>
                          <h3>{b.name}</h3>
                          <p>
                            {msg("到期")}
                            {b.due_date}
                            {b.snoozed_to
                              ? msg("· 延期提醒至") + b.snoozed_to
                              : ""}{" "}
                            · ¥ {fmt(b.amount_minor)}
                          </p>
                        </div>
                        <div className="row-actions">
                          <button
                            onClick={() =>
                              confirm(
                                msg("延期提醒"),
                                msg("仅改变提醒日期，不计入收入或支出。"),
                                async (p, op) =>
                                  mutate(
                                    "snoozeBill",
                                    { id: b.id, date: p.date },
                                    op,
                                  ),
                                [
                                  {
                                    name: "date",
                                    label: msg("下次提醒日期"),
                                    type: "date",
                                  },
                                ],
                                { date: addDays(data.today, 7) },
                              )
                            }
                          >
                            {msg("延期")}
                          </button>
                          <button
                            onClick={() =>
                              confirm(
                                msg("跳过本次账单"),
                                msg("不生成支出；下次账单不受影响。"),
                                async (_, op) =>
                                  mutate(
                                    "processBill",
                                    { id: b.id, skip: true },
                                    op,
                                  ),
                              )
                            }
                          >
                            {msg("跳过")}
                          </button>
                          <button
                            className="primary"
                            onClick={() => payBill(b)}
                          >
                            {msg("确认支付")}
                          </button>
                        </div>
                      </div>
                    ))}
                    {!data.occurrences.length && (
                      <Empty
                        title={msg("没有待处理账单")}
                        hint={msg(
                          "应用启动时会补齐到期提醒，不会自动扣款或记账。",
                        )}
                      />
                    )}
                  </section>
                  <section className="panel spaced">
                    <h3>{msg("处理历史")}</h3>
                    <p>
                      {msg(
                        "已支付可在交易中查看或撤销；撤销支付后账单重新变为待办。",
                      )}
                    </p>
                    {data.occurrenceHistory.map((b: Data) => (
                      <div className="setting-row" key={b.id}>
                        <span>
                          {b.due_date} · {b.name}
                        </span>
                        <span>
                          {b.status === "PAID" ? msg("已支付") : msg("已跳过")}
                        </span>
                        {b.transaction_id && (
                          <button
                            onClick={() =>
                              goto("transactions", {
                                search: b.name,
                                start: b.due_date,
                                end: addDays(data.today, 1),
                              })
                            }
                          >
                            {msg("查看交易")}
                          </button>
                        )}
                      </div>
                    ))}
                    {!data.occurrenceHistory.length && (
                      <Empty title={msg("暂无处理历史")} />
                    )}
                  </section>
                  <section className="panel spaced">
                    <div className="panel-heading">
                      <h3>{msg("固定账单规则")}</h3>
                      <p>
                        {msg(
                          "规则在到期后生成可确认的待办；未来计划尚未产生支出。",
                        )}
                      </p>
                    </div>
                    {data.bills.map((b: Data) => (
                      <div className="setting-row" key={b.id}>
                        <div>
                          <h3>{b.name}</h3>
                          <p>
                            {b.frequency === "MONTHLY"
                              ? msg("每月")
                              : msg("每周")}{" "}
                            {b.day}
                            {msg("日 · ¥")}
                            {fmt(b.amount_minor)} ·{" "}
                            {b.enabled ? msg("启用") : msg("停用")}{" "}
                            {b.next_due &&
                              ` · ${msg("下次到期")} ${b.next_due}`}
                          </p>
                        </div>
                        <div className="row-actions">
                          <button onClick={() => billForm(b)}>
                            {msg("修改")}
                          </button>
                          <button
                            onClick={() =>
                              act(() =>
                                mutate("toggleBill", {
                                  id: b.id,
                                  revision: b.revision,
                                }),
                              )
                            }
                          >
                            {b.enabled ? msg("停用") : msg("启用")}
                          </button>
                        </div>
                      </div>
                    ))}
                  </section>
                </>
              )}
              {settingsTab === "data" && (
                <>
                  <div className="data-cards">
                    <section className="panel data-card">
                      <span className="mini-icon green">
                        <Download size={23} />
                      </span>
                      <h3>{msg("导出与迁移")}</h3>
                      <p>
                        {msg(
                          "CSV用于查看账目；完整 JSON 包含账本、预算版本和修改历史。",
                        )}
                      </p>
                      <div>
                        <button
                          onClick={() =>
                            act(async () => {
                              const r = await api("export", { format: "csv" });
                              if (r) setToast(msg("已导出：") + r.file);
                            })
                          }
                        >
                          {msg("导出 CSV")}
                        </button>
                        <button
                          onClick={() =>
                            act(async () => {
                              const r = await api("export", { format: "json" });
                              if (r) setToast(msg("已导出：") + r.file);
                            })
                          }
                        >
                          {msg("完整 JSON")}
                        </button>
                      </div>
                    </section>
                    <section className="panel data-card">
                      <span className="mini-icon blue">
                        <Upload size={23} />
                      </span>
                      <h3>{msg("导入历史交易")}</h3>
                      <p>
                        {msg(
                          "支持字段映射、预览和重复提示。账户与分类名称需要明确匹配。",
                        )}
                      </p>
                      <div>
                        <button onClick={() => act(importCSV)}>
                          {msg("导入 CSV")}
                        </button>
                        <button
                          onClick={() =>
                            act(() => api("export", { format: "template" }))
                          }
                        >
                          {msg("下载模板")}
                        </button>
                      </div>
                    </section>
                    <section className="panel data-card">
                      <span className="mini-icon amber">
                        <ShieldCheck size={23} />
                      </span>
                      <h3>{msg("备份与恢复")}</h3>
                      <button
                        onClick={() =>
                          act(async () => {
                            await api("chooseDataDirectory");
                            setInfo(await api("dataInfo"));
                          })
                        }
                      >
                        {msg("迁移数据目录")}
                      </button>
                      <button
                        onClick={() =>
                          confirm(
                            msg("清理界面缓存"),
                            msg(
                              "只清理浏览器渲染缓存，不删除交易、设置、审计和备份。",
                            ),
                            async () => {
                              await api("clearCache");
                              setToast(msg("缓存已清理"));
                            },
                          )
                        }
                      >
                        {msg("清理界面缓存")}
                      </button>
                      <p>
                        {msg(
                          "完整 SQLite 一致性快照。恢复前先保留当前账本的安全副本。",
                        )}
                      </p>
                      <div>
                        <button
                          onClick={() =>
                            act(async () => {
                              const r = await api("backup");
                              setToast(msg("备份完成：") + r.file);
                              setInfo(await api("dataInfo"));
                            })
                          }
                        >
                          {msg("立即备份")}
                        </button>
                        <button onClick={() => act(restore)}>
                          {msg("恢复备份")}
                        </button>
                      </div>
                    </section>
                  </div>
                  <section className="panel spaced">
                    <div className="setting-row">
                      <div>
                        <h3>{msg("本地数据目录")}</h3>
                        <p className="mono wrap">
                          {info?.directory || msg("正在读取…")}
                        </p>
                        <p>
                          {msg("数据库与备份为未加密本地文件，请妥善保管。")}
                        </p>
                      </div>
                      <button onClick={() => act(() => api("openDataFolder"))}>
                        <FolderOpen size={16} />
                        {msg("打开目录")}
                      </button>
                    </div>
                    <div className="setting-row">
                      <div>
                        <h3>{msg("自动备份")}</h3>
                        <p className="mono wrap">{info?.backup_directory}</p>
                        <p>
                          {msg(
                            "应用运行期间保存日快照，保留30份日备份与12份月备份。",
                          )}
                        </p>
                        {info?.status.error ? (
                          <p className="negative">
                            {msg("最近备份失败：")}
                            {info.status.error}
                          </p>
                        ) : (
                          <p>
                            {msg("最近成功：")}
                            {info?.status.date || msg("首次自动备份待完成")}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          act(async () => {
                            await api("setBackupDirectory");
                            setInfo(await api("dataInfo"));
                          })
                        }
                      >
                        {msg("选择备份目录")}
                      </button>
                    </div>
                  </section>
                  <section className="panel spaced danger-zone">
                    <div className="setting-row">
                      <div>
                        <h3>{msg("重新开始")}</h3>
                        <p>
                          {msg(
                            "永久清空当前账本中的账户、交易、预算、待办、设置与修改历史，随后回到首次设置。",
                          )}
                        </p>
                      </div>
                      <button
                        className="danger-button"
                        onClick={() =>
                          confirm(
                            msg("永久清空账本"),
                            msg(
                              "此操作无法撤销。请输入“重新开始”；如需彻底删除旧数据，请同时勾选删除应用管理的备份。",
                            ),
                            async (p) => {
                              const phrase =
                                getLocale() === "en"
                                  ? "START OVER"
                                  : "重新开始";
                              if (p.confirm !== phrase)
                                throw new Error(
                                  msg("请输入“重新开始”确认清空账本"),
                                );
                              await api("resetLedger", {
                                confirm: p.confirm,
                                delete_backups: p.delete_backups === true,
                              });
                            },
                            [
                              {
                                name: "confirm",
                                label: msg("确认文字"),
                                hint: msg("请输入：重新开始"),
                              },
                              {
                                name: "delete_backups",
                                label: msg("删除应用管理的本地备份"),
                                type: "checkbox",
                                required: false,
                                hint: msg("勾选后将无法再用这些备份恢复旧账本"),
                              },
                            ],
                          )
                        }
                      >
                        <Trash2 size={16} />
                        {msg("清空账本")}
                      </button>
                    </div>
                  </section>
                  <section className="panel spaced">
                    <div className="panel-heading">
                      <h3>{msg("导入批次")}</h3>
                    </div>
                    {data.imports.map((i: Data) => (
                      <div className="setting-row" key={i.id}>
                        <div>
                          <h3>{i.source}</h3>
                          <p>
                            {new Date(i.created_at).toLocaleString(getLocale())}{" "}
                            ·{" "}
                            {i.status === "REVERTED"
                              ? msg("已撤销")
                              : msg("已导入")}
                          </p>
                        </div>
                        {i.status === "COMMITTED" && (
                          <button
                            onClick={() =>
                              confirm(
                                msg("撤销导入批次"),
                                msg(
                                  "仅当导入交易未修改、未被引用且周期可编辑时才能整批撤销。",
                                ),
                                async (_, op) =>
                                  mutate("revertImport", { id: i.id }, op),
                              )
                            }
                          >
                            {msg("撤销批次")}
                          </button>
                        )}
                      </div>
                    ))}
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </main>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
          <button
            onClick={() => setToast("")}
            aria-label={msg("关闭提示")}
            title={msg("关闭提示")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <Modal
          title={modal.title}
          subtitle={modal.subtitle}
          wide={modal.wide}
          onClose={close}
        >
          {modal.body}
        </Modal>
      )}
    </div>
  );
}
function Onboarding({
  onDone,
  onRestore,
}: {
  onDone: () => Promise<void>;
  onRestore: () => void;
}) {
  const [step, setStep] = useState(0),
    [basis, setBasis] = useState("SALARY"),
    [payday, setPayday] = useState("10"),
    [start, setStart] = useState(new Date().toLocaleDateString("en-CA")),
    [blank, setBlank] = useState(false),
    [accounts, setAccounts] = useState<Data[]>([
      { name: msg("日常消费"), opening: "0.00", roles: ["SPENDING"] },
      { name: msg("长期储蓄"), opening: "0.00", roles: ["SAVINGS"] },
      { name: msg("工资账户"), opening: "0.00", roles: ["SALARY"] },
      {
        name: msg("理财账户"),
        opening: "0.00",
        roles: ["SAVINGS"],
        type_name: msg("投资/理财"),
        valuation_mode: true,
      },
    ]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="onboarding">
      <aside>
        <div className="brand">
          <span className="brand-mark">
            <Wallet size={25} />
          </span>
          <div>
            <strong>{msg("薪流")}</strong>
            <small>SalaryFlow</small>
          </div>
        </div>
        <div>
          <p className="eyebrow">{msg("让每一份收入都有去处")}</p>
          <h1>
            {msg("从一份清晰的计划，")}
            <br />
            {msg("开始从容的生活。")}
          </h1>
          <p>
            {msg("预算、消费、储蓄，一目了然。")}
            <br />
            {msg("你的财务数据，安心留在自己的电脑里。")}
          </p>
          <div className="onboarding-art">
            <div>
              <span>{msg("为当下留出生活")}</span>
              <Wallet size={22} />
            </div>
            <div>
              <span>{msg("为未来积累底气")}</span>
              <Sparkles size={22} />
            </div>
            <div>
              <span>{msg("每一步，都看得见")}</span>
              <ChartNoAxesCombined size={22} />
            </div>
          </div>
        </div>
        <span className="onboarding-security">
          <ShieldCheck size={16} />
          {msg("本地 SQLite · 无需账号 · 离线可用")}
        </span>
      </aside>
      <section>
        <div className="setup-progress">
          {[msg("工资周期"), msg("我的账户"), msg("预算起点")].map((x, i) => (
            <span key={x} className={step >= i ? "active" : ""}>
              <b>{step > i ? <Check size={13} /> : i + 1}</b>
              {x}
            </span>
          ))}
        </div>
        <div className="setup-body">
          <p className="eyebrow">
            {msg("首次设置 ·")}
            {step + 1} / 3
          </p>
          <h2>
            {
              [
                msg("先设置你的收入节奏"),
                msg("告诉薪流，钱在哪里"),
                msg("为新周期准备一份预算"),
              ][step]
            }
          </h2>
          <p className="muted">
            {
              [
                msg("工资迟发或分多次到账，也不会打乱预算周期。"),
                msg("下面只是可编辑的账户建议，请换成你真实使用的账户。"),
                msg("推荐值只是起点；每个金额以后都可以修改。"),
              ][step]
            }
          </p>
          {step === 0 && (
            <div className="setup-fields">
              <label>
                {msg("预算周期口径")}
                <select
                  value={basis}
                  onChange={(e) => setBasis(e.target.value)}
                >
                  <option value="SALARY">{msg("按工资周期")}</option>
                  <option value="CALENDAR_MONTH">{msg("按自然月")}</option>
                </select>
                <small>
                  {basis === "SALARY"
                    ? msg("工资到账日作为每个预算周期的起点。")
                    : msg("每个预算周期固定为自然月1日至月底。")}
                </small>
              </label>
              {basis === "SALARY" && (
                <label>
                  {msg("每月工资日")}
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={payday}
                    onChange={(e) => setPayday(e.target.value)}
                  />
                  <small>{msg("默认每月10日；短月自动取月底。")}</small>
                </label>
              )}
              <label>
                {msg("开始记账日期")}
                <input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
                <small>{msg("下一步填写这一天开始前的真实余额。")}</small>
              </label>
              <button className="text-button" onClick={onRestore}>
                <RotateCcw size={15} />
                {msg("已有账本？从完整备份恢复")}
              </button>
            </div>
          )}
          {step === 1 && (
            <div className="setup-accounts">
              {accounts.map((a, i) => (
                <div className="setup-account" key={i}>
                  <div>
                    <label>
                      {msg("账户名称")}
                      <input
                        aria-label={msg("账户名称") + (i + 1)}
                        value={a.name}
                        onChange={(e) =>
                          setAccounts(
                            accounts.map((x, n) =>
                              n === i ? { ...x, name: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      {msg("期初余额（元）")}
                      <input
                        aria-label={msg("期初余额") + (i + 1)}
                        inputMode="decimal"
                        title={msg(
                          "可输入金额或使用 + - * / ( ) 计算，结果四舍五入到分",
                        )}
                        value={a.opening}
                        onChange={(e) =>
                          setAccounts(
                            accounts.map((x, n) =>
                              n === i ? { ...x, opening: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      className="icon-button"
                      aria-label={msg("移除账户")}
                      title={msg("移除账户")}
                      onClick={() =>
                        setAccounts(accounts.filter((_, n) => n !== i))
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="role-checks">
                    {Object.keys(roles).map((r) => (
                      <label key={r}>
                        <input
                          type="checkbox"
                          checked={a.roles.includes(r)}
                          onChange={(e) =>
                            setAccounts(
                              accounts.map((x, n) =>
                                n === i
                                  ? {
                                      ...x,
                                      roles: e.target.checked
                                        ? [...x.roles, r]
                                        : x.roles.filter(
                                            (v: string) => v !== r,
                                          ),
                                    }
                                  : x,
                              ),
                            )
                          }
                        />
                        {roles[r]}
                        {msg("用途")}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button
                onClick={() =>
                  setAccounts([
                    ...accounts,
                    { name: "", opening: "0.00", roles: [] },
                  ])
                }
              >
                <Plus size={16} />
                {msg("新增一个账户")}
              </button>
            </div>
          )}
          {step === 2 && (
            <div className="setup-budgets">
              <button
                className={!blank ? "selected" : ""}
                onClick={() => setBlank(false)}
              >
                <span>
                  <Sparkles size={22} />
                  <b>{msg("使用推荐预算")}</b>
                  <small>
                    {msg("20个项目 · 固定生活、餐饮、日常、成长与备用")}
                  </small>
                </span>
                <strong>
                  ¥ 6,310<small>{msg("/ 工资周期")}</small>
                </strong>
                {!blank && <CheckCircle2 size={21} />}
              </button>
              <button
                className={blank ? "selected" : ""}
                onClick={() => setBlank(true)}
              >
                <span>
                  <FileText size={22} />
                  <b>{msg("从空白开始")}</b>
                  <small>{msg("按自己的生活方式，逐项建立预算")}</small>
                </span>
                {blank && <CheckCircle2 size={21} />}
              </button>
              <div className="tip">
                <CircleHelp size={18} />
                <span>
                  {msg(
                    "设置完成后，可修改当前周期预算，并选择是否保存为个人默认。初始余额不会计入收入。",
                  )}
                </span>
              </div>
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <div className="setup-footer">
            {step > 0 ? (
              <button onClick={() => setStep(step - 1)}>
                <ChevronLeft size={16} />
                {msg("上一步")}
              </button>
            ) : (
              <span className="muted">{msg("大约需要 3 分钟")}</span>
            )}
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setError("");
                try {
                  if (step === 0) {
                    if (
                      basis === "SALARY" &&
                      (!Number.isInteger(Number(payday)) ||
                        Number(payday) < 1 ||
                        Number(payday) > 31)
                    )
                      throw new Error(msg("工资日应为1—31"));
                    if (!start) throw new Error(msg("请选择开始日期"));
                  }
                  if (step === 1) {
                    if (!accounts.length)
                      throw new Error(msg("请至少添加一个账户"));
                    for (const a of accounts) {
                      if (!a.name.trim())
                        throw new Error(msg("请填写账户名称"));
                      parseMoneyExpression(a.opening, {
                        signed: true,
                        zero: true,
                      });
                    }
                  }
                  if (step < 2) setStep(step + 1);
                  else {
                    setBusy(true);
                    await api("command", {
                      action: "initialize",
                      operation_id: crypto.randomUUID(),
                      payload: {
                        basis,
                        payday: basis === "SALARY" ? Number(payday) : 1,
                        start_date: start,
                        blank,
                        accounts: accounts.map((a) => ({
                          ...a,
                          opening_minor: parseMoneyExpression(a.opening, {
                            signed: true,
                            zero: true,
                          }),
                        })),
                      },
                    });
                    await onDone();
                  }
                } catch (e: any) {
                  setError(msg(e.message));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy
                ? msg("正在创建…")
                : step === 2
                  ? msg("开启我的账本")
                  : msg("下一步")}
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
function BudgetEditor({
  data,
  defaults,
  onSave,
}: {
  data: Data;
  defaults: boolean;
  onSave: (p: Data) => Promise<void>;
}) {
  const budget = defaults ? data.defaultBudget : data.budget;
  const [items, setItems] = useState<Data[]>(
      budget.items.map((x: Data) => ({
        ...x,
        amount: decimal(x.amount_minor),
      })),
    ),
    [update, setUpdate] = useState(false),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [add, setAdd] = useState("");
  const available = data.categories.filter(
    (c: Data) =>
      c.kind === "EXPENSE" &&
      !c.archived &&
      !items.some((x) => x.category_id === c.id),
  );
  const addCategoryHint = available.length
    ? msg("请先在左侧选择一个尚未加入预算的支出分类。")
    : msg(
        "现有可用支出分类已全部加入预算。要创建新分类，请前往“设置与数据 → 收支分类 → 新增分类”。",
      );
  return (
    <div>
      <div className="budget-editor-list">
        {items.map((x, i) => {
          const c = data.categories.find((c: Data) => c.id === x.category_id);
          return (
            <div className="budget-editor-row" key={x.category_id}>
              <input
                aria-label={msg("启用") + localized(c?.name)}
                type="checkbox"
                checked={x.enabled}
                onChange={(e) =>
                  setItems(
                    items.map((v, n) =>
                      n === i ? { ...v, enabled: e.target.checked } : v,
                    ),
                  )
                }
              />
              <span>
                <b>{localized(c?.name)}</b>
                <small>{localized(c?.group_name)}</small>
              </span>
              <input
                aria-label={localized(c?.name) + msg("预算")}
                inputMode="decimal"
                title={msg(
                  "可输入金额或使用 + - * / ( ) 计算，结果四舍五入到分",
                )}
                value={x.amount}
                onChange={(e) =>
                  setItems(
                    items.map((v, n) =>
                      n === i ? { ...v, amount: e.target.value } : v,
                    ),
                  )
                }
              />
              <span>{msg("元")}</span>
            </div>
          );
        })}
      </div>
      <div className="row-actions spaced">
        <select
          value={add}
          aria-label={msg("选择新增预算分类")}
          title={addCategoryHint}
          onChange={(e) => setAdd(e.target.value)}
        >
          <option value="">{msg("选择新增预算分类")}</option>
          {available.map((c: Data) => (
            <option key={c.id} value={c.id}>
              {localized(c.group_name)} / {localized(c.name)}
            </option>
          ))}
        </select>
        <HoverHint text={addCategoryHint}>
          <button
            disabled={!add}
            onClick={() => {
              const c = available.find((c: Data) => c.id === add);
              setItems([
                ...items,
                {
                  category_id: c.id,
                  category_version_id: c.version_id,
                  amount: "0.00",
                  enabled: true,
                  note: "",
                },
              ]);
              setAdd("");
            }}
          >
            <Plus size={15} />
            {msg("添加")}
          </button>
        </HoverHint>
      </div>
      <label className="spaced block">
        {msg("变更说明")}
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={msg("例如：本期增加旅行安排")}
        />
      </label>
      {!defaults && (
        <label className="check-line spaced">
          <input
            type="checkbox"
            checked={update}
            onChange={(e) => setUpdate(e.target.checked)}
          />
          {msg("同时将当前完整预算保存为个人默认（其他周期不变）")}
        </label>
      )}
      {error && <div className="error">{error}</div>}
      <div className="form-actions">
        <span className="muted">{msg("停用后，历史支出仍然计入实际金额")}</span>
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await onSave({
                scope: defaults ? "DEFAULT" : "CYCLE",
                cycle_id: defaults ? undefined : data.cycle.id,
                expected_id: budget.id,
                items: items.map((x) => ({
                  ...x,
                  amount_minor: parseMoneyExpression(x.amount, { zero: true }),
                })),
                update_default: update,
                reason,
              });
            } catch (e: any) {
              setError(msg(e.message));
            } finally {
              setBusy(false);
            }
          }}
        >
          {msg("保存预算")}
          <Check size={16} />
        </button>
      </div>
    </div>
  );
}
function AllocationCenter({
  data,
  onAllocate,
  onRecordSalary,
  mutate,
  ask,
  format,
}: {
  data: Data;
  onAllocate: (salary: Data) => void;
  onRecordSalary: () => void;
  mutate: (action: string, payload?: Data, op?: string) => Promise<any>;
  ask: (
    title: string,
    description: string,
    fn: (p: Data, op: string) => Promise<any>,
    fields?: Field[],
    initial?: Data,
  ) => void;
  format: (value: any, scope?: string, key?: string) => string;
}) {
  const accountName = (id: string) =>
    data.accounts.find((a: Data) => a.id === id)?.name ?? msg("历史账户");
  const status: Data = {
    DRAFT: msg("待执行"),
    PARTIAL: msg("部分完成"),
    COMPLETED: msg("已完成"),
    CANCELLED: msg("已取消"),
  };
  return (
    <div className="allocation-center">
      <section className="panel allocation-guide">
        <div>
          <span className="mini-icon green">
            <Sparkles size={22} />
          </span>
          <div>
            <h3>{msg("工资到账后的资金安排")}</h3>
            <p>
              {msg(
                "依据本周期剩余预算和主要消费账户余额，先计算需要补入的生活资金，再把可分配余款安排到储蓄或理财账户。",
              )}
            </p>
          </div>
        </div>
        <div className="allocation-formula">
          <span>{msg("剩余预算")}</span>
          <ArrowRight size={15} />
          <span>{msg("减去消费账户余额")}</span>
          <ArrowRight size={15} />
          <span>{msg("得到建议补足")}</span>
          <ArrowRight size={15} />
          <span>{msg("余款转入储蓄")}</span>
        </div>
        <p className="tip">
          <CircleHelp size={16} />
          {msg(
            "薪流不会连接银行或执行真实转账。你在银行完成转账后，可逐项记录，或点击“我已完成银行转账，记录全部”。",
          )}
        </p>
      </section>

      <section className="panel spaced">
        <div className="panel-heading">
          <div>
            <h3>{msg("选择本周期工资收入")}</h3>
            <p>
              {data.cycle.start} — {addDays(data.cycle.end, -1)}
            </p>
          </div>
          <button className="primary" onClick={onRecordSalary}>
            <Plus size={16} />
            {msg("记录工资收入")}
          </button>
        </div>
        <div className="salary-picker">
          {data.salaryIncomes.map((salary: Data) => {
            const existing = data.plans.find(
              (plan: Data) => plan.salary_id === salary.id,
            );
            return (
              <article key={salary.id}>
                <div>
                  <b>{salary.date}</b>
                  <span>{salary.destination_name}</span>
                </div>
                <strong>¥ {format(salary.amount_minor)}</strong>
                {existing ? (
                  <span className="tag neutral">{status[existing.status]}</span>
                ) : (
                  <button onClick={() => onAllocate(salary)}>
                    {msg("计算分配建议")}
                    <ArrowRight size={15} />
                  </button>
                )}
              </article>
            );
          })}
        </div>
        {!data.salaryIncomes.length && (
          <Empty
            title={msg("本周期还没有工资收入")}
            hint={msg("记录收入时勾选“工资收入”，即可在这里生成分配方案。")}
            action={
              <button onClick={onRecordSalary}>{msg("记录工资收入")}</button>
            }
          />
        )}
      </section>

      <section className="panel spaced">
        <div className="panel-heading">
          <div>
            <h3>{msg("工资分配计划")}</h3>
            <p>{msg("计划与实际内部转账分开保存，避免重复记账。")}</p>
          </div>
        </div>
        {!data.plans.length && (
          <Empty
            title={msg("还没有分配计划")}
            hint={msg("先从上方选择一笔工资收入。")}
          />
        )}
        {data.plans.map((plan: Data) => {
          const q = plan.data;
          const pending = plan.items.filter(
            (item: Data) => item.status === "PENDING",
          );
          return (
            <div className="plan" key={plan.id}>
              <div className="plan-heading">
                <div>
                  <h3>
                    {msg("工资分配")} · {plan.salary?.date ?? ""}
                  </h3>
                  <p>
                    {plan.salary?.destination_name} · ¥{" "}
                    {format(plan.salary?.amount_minor ?? "0")}
                  </p>
                </div>
                <span className="tag neutral">{status[plan.status]}</span>
                {pending.length > 0 && (
                  <HoverHint
                    text={msg(
                      "只在银行转账已经全部完成后使用；这里会批量记录内部转账，不会向银行发起转账。",
                    )}
                  >
                    <button
                      className="primary"
                      onClick={() =>
                        ask(
                          msg("记录全部分配转账"),
                          msg(
                            "仅在你已经通过银行完成下列全部转账后确认。薪流会一次性创建对应内部转账记录。",
                          ),
                          async (p, op) =>
                            mutate(
                              "confirmAllocationPlan",
                              { id: plan.id, date: p.date },
                              op,
                            ),
                          [
                            {
                              name: "date",
                              label: msg("实际转账日期"),
                              type: "date",
                            },
                          ],
                          { date: data.today },
                        )
                      }
                    >
                      <Check size={16} />
                      {msg("我已完成银行转账，记录全部")}
                    </button>
                  </HoverHint>
                )}
              </div>
              <div className="allocation-summary">
                {[
                  [msg("本周期预算"), q.total_budget],
                  [msg("本周期净支出"), q.net_spent],
                  [msg("剩余预算"), q.remaining_budget ?? q.target],
                  [msg("当时消费账户余额"), q.spending_balance],
                  [msg("分配上限"), q.cap],
                  [msg("实际可分配"), q.available],
                  [msg("建议补入消费账户"), q.topup],
                  [msg("建议转入储蓄/理财"), q.saving],
                ].map(([label, value]) => (
                  <div key={label}>
                    <small>{label}</small>
                    <strong>¥ {format(value ?? "0")}</strong>
                  </div>
                ))}
              </div>
              {plan.items.map((item: Data) => (
                <div className="allocation-row" key={item.id}>
                  <span>
                    {accountName(item.source_id)}
                    <ArrowRight size={14} />
                    {accountName(item.destination_id)}
                  </span>
                  <strong>¥ {format(item.amount_minor)}</strong>
                  {item.status === "PENDING" ? (
                    <HoverHint
                      text={msg(
                        "银行转账已完成但尚未记账时选择记录；如果已经记过转账，则填写交易ID进行关联。",
                      )}
                    >
                      <button
                        onClick={() =>
                          ask(
                            msg("确认已完成转账"),
                            msg(
                              "请以银行实际转账为准；若已手动记账，可关联已有转账ID。",
                            ),
                            async (p, op) =>
                              mutate(
                                "confirmAllocation",
                                {
                                  id: item.id,
                                  date: p.date,
                                  transaction_id: p.transaction_id || undefined,
                                },
                                op,
                              ),
                            [
                              {
                                name: "date",
                                label: msg("实际日期"),
                                type: "date",
                              },
                              {
                                name: "transaction_id",
                                label: msg("关联已有转账ID（可选）"),
                                required: false,
                              },
                            ],
                            { date: data.today },
                          )
                        }
                      >
                        {msg("记录 / 关联")}
                      </button>
                    </HoverHint>
                  ) : (
                    <span className="muted">
                      {item.status === "RECORDED"
                        ? msg("已记录")
                        : msg("已取消")}
                    </span>
                  )}
                </div>
              ))}
              <div className="plan-actions">
                {["DRAFT", "PARTIAL"].includes(plan.status) && (
                  <HoverHint
                    text={msg(
                      "取消所有尚未完成的计划项；已经记录的真实转账不会撤销。",
                    )}
                  >
                    <button
                      onClick={() =>
                        ask(
                          msg("取消剩余分配"),
                          msg("已记录的真实转账保留，仅取消尚未完成的计划项。"),
                          async (_, op) =>
                            mutate("cancelAllocation", { id: plan.id }, op),
                        )
                      }
                    >
                      {msg("取消剩余")}
                    </button>
                  </HoverHint>
                )}
                {plan.status === "CANCELLED" && (
                  <HoverHint
                    text={msg(
                      "只把已取消计划从列表中隐藏；已经记录的转账仍保留在交易记录中。",
                    )}
                  >
                    <button
                      onClick={() =>
                        ask(
                          msg("删除已取消计划"),
                          msg(
                            "计划将从列表隐藏；已经记录的真实转账仍保留在交易记录中。",
                          ),
                          async (_, op) =>
                            mutate("deleteAllocation", { id: plan.id }, op),
                        )
                      }
                    >
                      <Trash2 size={15} />
                      {msg("删除计划")}
                    </button>
                  </HoverHint>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function Allocation({
  salary,
  data,
  onDone,
}: {
  salary: Data;
  data: Data;
  onDone: () => Promise<void>;
}) {
  const [quote, setQuote] = useState<Data | null>(null),
    [error, setError] = useState("");
  const show = (value: any) =>
    amountVisible(data.settings) ? money(value) : "••••";
  const source = data.accounts.find(
    (account: Data) => account.id === salary.destination_id,
  );
  const accountOptions = data.accounts
    .filter((account: Data) => !account.archived)
    .map((account: Data) => ({
      value: account.id,
      label:
        account.name +
        " · ¥ " +
        show(account.balance) +
        (account.valuation_mode ? " · " + msg("按估值管理") : ""),
    }));
  return (
    <>
      <div className="allocation-context">
        <div>
          <small>{msg("所选工资")}</small>
          <strong>¥ {show(salary.amount_minor)}</strong>
          <span>{salary.date}</span>
        </div>
        <div>
          <small>{msg("工资到账账户")}</small>
          <strong>{source?.name ?? msg("历史账户")}</strong>
          <span>
            {msg("当前余额")} ¥ {show(source?.balance ?? "0")}
          </span>
        </div>
        <div>
          <small>{msg("计算依据")}</small>
          <strong>{msg("剩余预算优先")}</strong>
          <span>{msg("先补消费账户，余款再安排储蓄")}</span>
        </div>
      </div>
      <p className="tip allocation-tip">
        <CircleHelp size={17} />
        {msg(
          "“本周期工资总额”会汇总本周期所有标记为工资的有效收入，并随各周期实际工资变化；“源账户当前余额”适合工资卡通常清零的用法；自定义金额由你输入。",
        )}
      </p>
      <Form
        fields={[
          {
            name: "spending_id",
            label: msg("主要消费账户"),
            type: "select",
            options: accountOptions,
            explain: msg(
              "本周期剩余预算是计划；消费账户余额是真实资金。建议补足额＝剩余预算－消费账户余额，最低为0。",
            ),
          },
          {
            name: "savings_id",
            label: msg("储蓄或理财账户（可留空）"),
            type: "select",
            required: false,
            options: accountOptions,
            hint: msg("留空时，补足消费账户后的余款继续留在工资账户。"),
          },
          {
            name: "reserve",
            type: "money",
            label: msg("工资账户保留金额（元）"),
            hint: msg("分配完成后希望仍留在工资账户的最低金额。"),
          },
          {
            name: "limit_mode",
            label: msg("分配上限口径"),
            type: "select",
            options: [
              {
                value: "CYCLE_SALARY",
                label: msg("本周期工资总额"),
              },
              {
                value: "SOURCE_BALANCE",
                label: msg("源账户当前余额"),
              },
              {
                value: "CUSTOM",
                label: msg("其他金额（手动输入）"),
              },
            ],
          },
          {
            name: "cap",
            type: "money",
            label: msg("自定义分配上限（元）"),
            visible: (values) => values.limit_mode === "CUSTOM",
          },
        ]}
        initial={{
          spending_id: data.settings.defaults.SPENDING,
          savings_id: data.settings.defaults.SAVINGS,
          reserve: "0.00",
          limit_mode: "CYCLE_SALARY",
          cap: decimal(salary.amount_minor),
        }}
        submit={msg("计算分配建议")}
        onSubmit={async (values) => {
          setError("");
          setQuote(
            await api("allocationQuote", {
              ...values,
              salary_id: salary.id,
              reserve_minor: parseMoneyExpression(values.reserve, {
                zero: true,
              }),
              cap_minor:
                values.limit_mode === "CUSTOM"
                  ? parseMoneyExpression(values.cap, { zero: true })
                  : undefined,
            }),
          );
        }}
      />
      {quote && (
        <div className="quote">
          <div className="quote-heading">
            <div>
              <h3>{msg("分配建议")}</h3>
              <p>
                {quote.cycle_start} — {addDays(quote.cycle_end, -1)}
              </p>
            </div>
            <span className="tag neutral">
              {
                {
                  CYCLE_SALARY: msg("上限：本周期工资总额"),
                  SOURCE_BALANCE: msg("上限：源账户当前余额"),
                  CUSTOM: msg("上限：用户输入"),
                }[quote.limit_mode as string]
              }
            </span>
          </div>
          <div className="quote-calculation">
            {[
              [msg("本周期预算"), quote.total_budget],
              [msg("本周期净支出"), quote.net_spent],
              [msg("本周期剩余预算"), quote.remaining_budget],
              [msg("消费账户当前余额"), quote.spending_balance],
              [msg("需要补足消费账户"), quote.needed],
              [msg("本周期工资总额"), quote.cycle_salary],
              [msg("源账户当前余额"), quote.source_balance],
              [msg("工资账户保留"), quote.reserve],
              [msg("所选分配上限"), quote.cap],
              [msg("扣除已分配后可用"), quote.available],
            ].map(([label, value]) => (
              <div key={label}>
                <small>{label}</small>
                <strong>¥ {show(value)}</strong>
              </div>
            ))}
          </div>
          <div className="quote-result">
            <div>
              <small>{msg("建议转入消费账户")}</small>
              <strong>¥ {show(quote.topup)}</strong>
              <span>
                {quote.source_name} → {quote.spending_name}
              </span>
            </div>
            <div>
              <small>{msg("建议转入储蓄/理财")}</small>
              <strong>¥ {show(quote.saving)}</strong>
              <span>
                {quote.savings_name
                  ? quote.source_name + " → " + quote.savings_name
                  : msg("未选择账户，余款留在工资账户")}
              </span>
            </div>
            <div>
              <small>{msg("尚未补足的预算资金")}</small>
              <strong>¥ {show(quote.shortage)}</strong>
              <span>{msg("上限或源账户余额不足时才会出现")}</span>
            </div>
          </div>
          <p className="muted">
            {msg(
              "保存只生成计划，不会操作银行。实际完成转账后，到“工资分配”页逐项记录或一次记录全部。",
            )}
          </p>
          {error && <p className="error">{error}</p>}
          <HoverHint
            text={msg(
              "只保存这份分配建议，不会发起银行转账，也不会立即生成交易记录。",
            )}
          >
            <button
              className="primary"
              onClick={async () => {
                try {
                  await api("command", {
                    action: "saveAllocation",
                    payload: {
                      ...quote.input,
                      expected_revision: quote.revision,
                    },
                    operation_id: crypto.randomUUID(),
                  });
                  await onDone();
                } catch (e: any) {
                  setError(msg(e.message));
                }
              }}
            >
              {msg("保存分配计划")}
            </button>
          </HoverHint>
        </div>
      )}
    </>
  );
}
function ImportPreview({
  initial,
  onDone,
}: {
  initial: Data;
  onDone: () => Promise<void>;
}) {
  const [preview, setPreview] = useState(initial),
    [mapping, setMapping] = useState<Data>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <details>
        <summary>{msg("字段映射（自定义列名）")}</summary>
        <div className="form-grid spaced">
          {[
            "日期",
            "类型",
            "金额",
            "转出账户",
            "转入账户",
            "分类",
            "备注",
            "外部交易号",
            "原交易ID",
          ].map((k) => (
            <label key={k}>
              {k}
              <select
                value={mapping[k] || k}
                onChange={(e) =>
                  setMapping({ ...mapping, [k]: e.target.value })
                }
              >
                {[...new Set([k, ...preview.columns])].map((h: any) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <button
          className="spaced"
          onClick={async () => {
            try {
              setPreview(
                await api("importPreview", { token: initial.token, mapping }),
              );
            } catch (e: any) {
              setError(msg(e.message));
            }
          }}
        >
          {msg("重新预览")}
        </button>
      </details>
      <p className="muted">
        {msg("共")}
        {preview.rows.length}
        {msg("行，")}
        {preview.rows.filter((r: Data) => !r.skip && !r.error).length}
        {msg("行将导入。错误行保持排除；疑似重复需要主动核对。")}
      </p>
      <div className="import-table table-wrap">
        <table>
          <thead>
            <tr>
              <th>{msg("导入")}</th>
              <th>{msg("行号")}</th>
              <th>{msg("日期")}</th>
              <th>{msg("金额")}</th>
              <th>{msg("检查结果")}</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((r: Data, i: number) => (
              <tr key={i}>
                <td>
                  <HoverHint
                    text={
                      r.error
                        ? msg(
                            "该行存在错误，不能导入。请根据右侧原因修正源文件后重新选择。",
                          )
                        : msg("勾选决定这一行是否随本批次导入。")
                    }
                  >
                    <input
                      aria-label={msg("导入第") + r.line + msg("行")}
                      disabled={!!r.error}
                      type="checkbox"
                      checked={!r.skip && !r.error}
                      onChange={(e) =>
                        setPreview({
                          ...preview,
                          rows: preview.rows.map((x: Data, n: number) =>
                            n === i ? { ...x, skip: !e.target.checked } : x,
                          ),
                        })
                      }
                    />
                  </HoverHint>
                </td>
                <td>{r.line}</td>
                <td>{r.date || "—"}</td>
                <td>{r.amount_minor ? money(r.amount_minor) : "—"}</td>
                <td
                  className={
                    r.error ? "negative" : r.warning ? "warning" : "positive"
                  }
                >
                  {msg(r.error || r.warning || "") || msg("格式已识别")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tip">
        <CircleHelp size={16} />
        <span>
          {msg(
            "提交时会再次验证周期、账户起点、退款关系与唯一号；任意有效行失败时整批回滚。期初与校准请使用完整备份迁移。",
          )}
        </span>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <span>{msg("错误行不会悄悄写入账本")}</span>
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await api("importCommit", {
                token: initial.token,
                operation_id: crypto.randomUUID(),
                payload: {
                  rows: preview.rows.filter((x: Data) => !x.error),
                  file_hash: preview.file_hash,
                  source: "CSV",
                },
              });
              await onDone();
            } catch (e: any) {
              setError(msg(e.message));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? msg("正在导入…") : msg("确认导入")}
        </button>
      </div>
    </>
  );
}
