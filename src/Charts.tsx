import { useMemo, useState } from "react";
import { getLocale } from "./i18n";
import { decimal } from "../core/money.mjs";
import { trendData, pieData } from "../core/charts.mjs";

type Row = Record<string, any>;
const label = (zh: string, en: string) => (getLocale() === "en" ? en : zh);
const format = (v: any, hidden = false) => {
  if (hidden) return "••••";
  const [whole, fraction] = decimal(String(v)).split(".");
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + fraction;
};
const compact = (v: any, hidden = false) =>
  hidden
    ? "••••"
    : new Intl.NumberFormat(getLocale(), {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(Number(v) / 100);
const colors = Array.from({ length: 8 }, (_, i) => `var(--chart-${i + 1})`);
const pointOnCircle = (angle: number, radius: number) => ({
  x: 140 + Math.cos(angle) * radius,
  y: 135 + Math.sin(angle) * radius,
});
const donutPath = (offset: number, share: number) => {
  const outer = 107;
  const inner = 69;
  if (share >= 0.999999) {
    return "M 140 28 A 107 107 0 1 1 140 242 A 107 107 0 1 1 140 28 M 140 66 A 69 69 0 1 0 140 204 A 69 69 0 1 0 140 66";
  }
  const start = offset * Math.PI * 2 - Math.PI / 2;
  const end = (offset + share) * Math.PI * 2 - Math.PI / 2;
  const outerStart = pointOnCircle(start, outer);
  const outerEnd = pointOnCircle(end, outer);
  const innerEnd = pointOnCircle(end, inner);
  const innerStart = pointOnCircle(start, inner);
  const large = share > 0.5 ? 1 : 0;
  return `M ${outerStart.x} ${outerStart.y} A ${outer} ${outer} 0 ${large} 1 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${inner} ${inner} 0 ${large} 0 ${innerStart.x} ${innerStart.y} Z`;
};
const byMoney = (a: Row, b: Row, key: string, desc = true) => {
  const av = BigInt(a[key] ?? 0);
  const bv = BigInt(b[key] ?? 0);
  return av === bv ? 0 : av > bv ? (desc ? -1 : 1) : desc ? 1 : -1;
};

export function Trend({
  days,
  start,
  end,
  today,
  hidden,
}: {
  days: Row[];
  start: string;
  end: string;
  today: string;
  hidden?: boolean;
}) {
  const [mode, setMode] = useState("bar"),
    [series, setSeries] = useState("both"),
    [unit, setUnit] = useState("auto");
  const chart = trendData(days, start, end, today, unit),
    rows = chart.rows;
  const keys = series === "both" ? ["income", "expense"] : [series];
  const values = rows.flatMap((r: Row) => keys.map((k) => Number(r[k])));
  const hi = Math.max(1, ...values) * 1.16,
    lo = Math.min(0, ...values) * 1.16;
  const y = (v: number) => 215 - ((v - lo) / (hi - lo)) * 175;
  const step = 490 / Math.max(1, rows.length),
    x = (i: number) => 85 + (i + 0.5) * step;
  const names: Row = {
    income: label("收入", "Income"),
    expense: label("净支出", "Net spending"),
  };
  const showLabels = rows.length * keys.length <= 20;
  return (
    <div className="trend-svg chart-v4">
      <div className="chart-controls">
        <select
          aria-label={label("趋势图形式", "Trend style")}
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="bar">{label("柱状图", "Bars")}</option>
          <option value="line">{label("折线图", "Lines")}</option>
        </select>
        <select
          aria-label={label("趋势指标", "Trend series")}
          value={series}
          onChange={(e) => setSeries(e.target.value)}
        >
          <option value="both">
            {label("收入与净支出", "Income & net spending")}
          </option>
          <option value="expense">{names.expense}</option>
          <option value="income">{names.income}</option>
        </select>
        <select
          aria-label={label("趋势粒度", "Trend grouping")}
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        >
          <option value="auto">{label("自动粒度", "Automatic")}</option>
          <option value="day">{label("按日", "Daily")}</option>
          <option value="week">{label("按7天分组", "7-day groups")}</option>
          <option value="month">
            {label("按自然月分组", "Calendar months")}
          </option>
        </select>
      </div>
      <p className="chart-note">
        {label(
          "图上优先标注少量关键金额，悬停可查看完整日期与精确值。未来日期不按零值绘制。",
          "Key values are labeled when space allows. Hover for exact dates and values. Future dates are not zero-filled.",
        )}
      </p>
      {!rows.length ||
      !days.some(
        (d) =>
          d.date >= start &&
          d.date < chart.end &&
          (BigInt(d.income) !== 0n || BigInt(d.expense) !== 0n),
      ) ? (
        <p className="calm-empty">
          {label("此范围暂无收支数据", "No income or spending in this range")}
        </p>
      ) : (
        <svg
          viewBox="0 0 610 290"
          role="img"
          aria-label={label("收支趋势图", "Income and spending trend")}
        >
          <text x="10" y="18" className="chart-label">
            {label("金额 / 元", "Amount / CNY")} ·{" "}
            {chart.unit === "day"
              ? label("按日", "Daily")
              : chart.unit === "week"
                ? label("每7天合计", "7-day totals")
                : label("自然月合计", "Calendar-month totals")}
          </text>
          {[0, 1, 2, 3, 4].map((i) => {
            const v = lo + ((hi - lo) * i) / 4;
            return (
              <g key={i}>
                <line
                  x1="85"
                  x2="575"
                  y1={y(v)}
                  y2={y(v)}
                  className="chart-line"
                />
                <text
                  x="77"
                  y={y(v) + 4}
                  textAnchor="end"
                  className="chart-label"
                >
                  {compact(v, hidden)}
                </text>
              </g>
            );
          })}
          <line x1="85" x2="575" y1={y(0)} y2={y(0)} className="chart-zero" />
          {keys.map((k, j) => (
            <g key={k}>
              {mode === "line" && (
                <polyline
                  className="chart-series-line"
                  fill="none"
                  stroke={k === "income" ? colors[0] : colors[1]}
                  strokeWidth="2.5"
                  points={rows
                    .map((r: Row, i: number) => `${x(i)},${y(Number(r[k]))}`)
                    .join(" ")}
                />
              )}
              {rows.map((r: Row, i: number) => {
                const value = Number(r[k]),
                  w = Math.max(0.5, Math.min(22, step / (keys.length + 1))),
                  cx = x(i) + (j - (keys.length - 1) / 2) * w,
                  color = k === "income" ? colors[0] : colors[1];
                return (
                  <g key={r.date + k} tabIndex={0} className="chart-mark">
                    <title>
                      {r.date}
                      {r.date !== r.end ? " — " + r.end : ""}
                      {"\n"}
                      {names[k]} ¥ {format(r[k], hidden)}
                    </title>
                    {mode === "bar" ? (
                      <rect
                        className="trend-bar"
                        x={cx - w / 2}
                        width={w * 0.85}
                        y={Math.min(y(value), y(0))}
                        height={Math.max(1, Math.abs(y(value) - y(0)))}
                        fill={color}
                        rx="2"
                      />
                    ) : (
                      <circle
                        className="trend-point"
                        cx={x(i)}
                        cy={y(value)}
                        r="3.5"
                        fill={color}
                      />
                    )}
                    {showLabels && value !== 0 && (
                      <text
                        x={mode === "bar" ? cx : x(i)}
                        y={value >= 0 ? y(value) - 6 : y(value) + 13}
                        textAnchor="middle"
                        className="chart-value-label"
                      >
                        {compact(value, hidden)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          ))}
          {rows.map((r: Row, i: number) =>
            i % Math.max(1, Math.ceil(rows.length / 7)) === 0 ||
            i === rows.length - 1 ? (
              <text
                key={r.date}
                x={x(i)}
                y="242"
                textAnchor="middle"
                className="chart-label"
              >
                {r.date.slice(5)}
              </text>
            ) : null,
          )}
        </svg>
      )}
      <details className="chart-data">
        <summary>{label("查看精确日期数据", "View exact dated data")}</summary>
        <div className="chart-table">
          <table>
            <thead>
              <tr>
                <th>{label("日期范围", "Dates")}</th>
                <th>{names.income}</th>
                <th>{names.expense}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: Row) => (
                <tr key={r.date}>
                  <td>
                    {r.date}
                    {r.end !== r.date ? " — " + r.end : ""}
                  </td>
                  <td>{format(r.income, hidden)}</td>
                  <td>{format(r.expense, hidden)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function Composition({
  report,
  accounts,
  budgetRows,
  cycleLabel,
  hidden,
  onCategory,
}: {
  report: Row;
  accounts: Row[];
  budgetRows: Row[];
  cycleLabel: string;
  hidden?: boolean;
  onCategory: (id: string, dimension: string) => void;
}) {
  const [dimension, setDimension] = useState("expense");
  const [view, setView] = useState("donut");
  const [sort, setSort] = useState("amount_desc");
  const input =
    dimension === "expense"
      ? report.groups.map((g: Row) => ({
          id: g.version_id,
          name: g.name,
          amount: g.expense,
          actual: g.net,
        }))
      : dimension === "income"
        ? report.incomeGroups || []
        : dimension === "cashflow"
          ? [
              {
                id: "cashflow-income",
                name: label("收入", "Income"),
                amount: report.income,
              },
              {
                id: "cashflow-expense",
                name: label("净支出", "Net spending"),
                amount: BigInt(report.net ?? 0) > 0n ? report.net : "0",
              },
            ]
          : dimension === "budget"
            ? budgetRows
                .filter((b: Row) => BigInt(b.budget) > 0n)
                .map((b: Row) => ({
                  id: b.category_id,
                  name: b.name,
                  amount: b.budget,
                  actual: b.actual,
                }))
            : accounts.map((a) => ({
                id: a.id,
                name: a.name,
                amount: a.balance,
              }));
  const chart = pieData(input, 9);
  const rows = [...chart.rows].sort((a, b) =>
    sort === "amount_asc"
      ? byMoney(a, b, "amount", false)
      : sort === "name_asc"
        ? String(a.name || "").localeCompare(String(b.name || ""), getLocale())
        : byMoney(a, b, "amount"),
  );
  const max = rows.reduce((n, r) => {
    const amount = BigInt(r.amount ?? 0);
    const actual = dimension === "budget" ? BigInt(r.actual ?? 0) : 0n;
    return amount > n
      ? amount > actual
        ? amount
        : actual
      : actual > n
        ? actual
        : n;
  }, 1n);
  let offset = 0;
  return (
    <section className="panel composition-panel">
      <div className="panel-heading">
        <div>
          <h3>{label("构成分析", "Composition")}</h3>
          <p>
            {dimension === "budget"
              ? label(
                  `预算分布绑定当前所选周期（${cycleLabel}）；实际支出仍按交易发生日期统计。`,
                  `Budget allocation is tied to the selected period (${cycleLabel}); actual spending still follows transaction dates.`,
                )
              : dimension === "cashflow"
                ? label(
                    "比较所选日期范围内收入与净支出的相对规模；占比仅用于比较，不等于储蓄率。",
                    "Compares income with net spending in the selected dates. Shares show relative volume, not the savings rate.",
                  )
                : dimension === "assets"
                  ? label(
                      "当前正余额账户占比，非所选期间的历史资产；负余额不进入图表。",
                      "Current positive balances, not historical assets for the selected range. Negative balances are excluded.",
                    )
                  : dimension === "expense"
                    ? label(
                        "按毛支出计算占比，退款单列；点击分类可查看交易明细。",
                        "Shares use gross spending; refunds remain separate. Select a category to view transactions.",
                      )
                    : label(
                        "按所选日期范围的实际收入分类汇总。",
                        "Income categories within the selected dates.",
                      )}
          </p>
        </div>
        <div className="chart-controls">
          <select
            aria-label={label("图表分析维度", "Composition dimension")}
            value={dimension}
            onChange={(e) => setDimension(e.target.value)}
          >
            <option value="expense">
              {label("支出分类", "Spending categories")}
            </option>
            <option value="income">
              {label("收入来源", "Income sources")}
            </option>
            <option value="cashflow">
              {label("收入与净支出", "Income vs. net spending")}
            </option>
            <option value="budget">
              {label("周期预算分布", "Period budget allocation")}
            </option>
            <option value="assets">
              {label("账户资产", "Account assets")}
            </option>
          </select>
          <select
            aria-label={label("图表形式", "Chart type")}
            value={view}
            onChange={(e) => setView(e.target.value)}
          >
            <option value="donut">{label("环形图", "Donut")}</option>
            <option value="bars">
              {label("横向条形图", "Horizontal bars")}
            </option>
          </select>
          <select
            aria-label={label("构成排序", "Composition sort")}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="amount_desc">
              {label("金额从高到低", "Amount: high to low")}
            </option>
            <option value="amount_asc">
              {label("金额从低到高", "Amount: low to high")}
            </option>
            <option value="name_asc">
              {label("分类名称", "Category name")}
            </option>
          </select>
        </div>
      </div>
      {chart.total === 0n ? (
        <p className="calm-empty">
          {label(
            "此维度暂无可绘制的正金额",
            "No positive amounts for this dimension",
          )}
        </p>
      ) : view === "donut" ? (
        <div className="donut-layout">
          <svg
            viewBox="0 0 300 280"
            role="img"
            aria-label={label("金额占比环形图", "Amount composition donut")}
          >
            <circle
              cx="140"
              cy="135"
              r="88"
              fill="none"
              stroke="var(--soft)"
              strokeWidth="38"
            />
            {rows.map((r: Row, i: number) => {
              const o = offset;
              offset += r.share;
              const angle = (o + r.share / 2) * Math.PI * 2 - Math.PI / 2;
              const lx = 140 + Math.cos(angle) * 89;
              const ly = 135 + Math.sin(angle) * 89;
              return (
                <g key={r.id}>
                  <path
                    className={`donut-segment chart-stroke-${(i % colors.length) + 1}`}
                    d={donutPath(o, r.share)}
                    fillRule="evenodd"
                    tabIndex={0}
                  >
                    <title>
                      {r.name || label("其他合计", "Other combined")} ·{" "}
                      {r.percent}% · ¥ {format(r.amount, hidden)}
                    </title>
                  </path>
                  {r.share >= 0.075 && (
                    <text
                      x={lx}
                      y={ly + 4}
                      textAnchor="middle"
                      className="donut-slice-label"
                    >
                      {hidden ? "••" : r.percent + "%"}
                    </text>
                  )}
                </g>
              );
            })}
            <text x="140" y="130" textAnchor="middle" className="donut-title">
              {dimension === "cashflow"
                ? label("收支规模", "Cash flow volume")
                : label("合计", "Total")}
            </text>
            <text x="140" y="154" textAnchor="middle" className="donut-total">
              {format(chart.total, hidden)}
            </text>
          </svg>
          <Legend
            rows={rows}
            hidden={hidden}
            dimension={dimension}
            onCategory={onCategory}
          />
        </div>
      ) : (
        <div className="composition-bars">
          {rows.map((r: Row, i: number) => {
            const actionable =
              ["expense", "income", "budget"].includes(dimension) &&
              r.id !== "__rest";
            return (
              <button
                key={r.id}
                disabled={!actionable}
                onClick={() => actionable && onCategory(r.id, dimension)}
                className="composition-bar-row"
              >
                <span className="composition-bar-label">
                  <i style={{ background: colors[i % colors.length] }} />
                  <b>{r.name || label("其他合计", "Other combined")}</b>
                  <span>
                    {r.percent}% · ¥ {format(r.amount, hidden)}
                  </span>
                </span>
                <span className="composition-track">
                  <i
                    style={{
                      width: `${Number((BigInt(r.amount) * 10000n) / max) / 100}%`,
                      background: colors[i % colors.length],
                    }}
                  />
                  {dimension === "budget" && (
                    <em
                      title={label("已用净支出", "Net spending used")}
                      style={{
                        left: `${Math.min(100, Number((BigInt(r.actual ?? 0) * 10000n) / max) / 100)}%`,
                      }}
                    />
                  )}
                </span>
                {dimension === "budget" && (
                  <small>
                    {label("已用", "Used")} ¥ {format(r.actual ?? 0, hidden)}
                  </small>
                )}
              </button>
            );
          })}
          {dimension === "budget" && (
            <p className="chart-note">
              {label(
                "色条为预算金额，竖线为本周期已用净支出。",
                "Bars show budget amounts; markers show net spending used in this period.",
              )}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Legend({
  rows,
  hidden,
  dimension,
  onCategory,
}: {
  rows: Row[];
  hidden?: boolean;
  dimension: string;
  onCategory: (id: string, dimension: string) => void;
}) {
  return (
    <div className="donut-legend">
      {rows.map((r: Row, i: number) => {
        const actionable =
          ["expense", "income", "budget"].includes(dimension) &&
          r.id !== "__rest";
        return (
          <button
            key={r.id}
            disabled={!actionable}
            onClick={() => actionable && onCategory(r.id, dimension)}
          >
            <i style={{ background: colors[i % colors.length] }} />
            <span>{r.name || label("其他合计", "Other combined")}</span>
            <b>{r.percent}%</b>
            <strong>¥ {format(r.amount, hidden)}</strong>
          </button>
        );
      })}
    </div>
  );
}

export function CategoryHierarchy({
  groups,
  totalExpense,
  hidden,
  onCategory,
}: {
  groups: Row[];
  totalExpense: string;
  hidden?: boolean;
  onCategory: (id: string) => void;
}) {
  const [groupFilter, setGroupFilter] = useState("all");
  const [sort, setSort] = useState("amount_desc");
  const grouped = useMemo(() => {
    const map = new Map<string, Row>();
    for (const item of groups) {
      const name = item.group || label("未分组", "Ungrouped");
      const row = map.get(name) || {
        name,
        expense: 0n,
        refund: 0n,
        net: 0n,
        items: [],
      };
      row.expense += BigInt(item.expense);
      row.refund += BigInt(item.refund);
      row.net += BigInt(item.net);
      row.items.push(item);
      map.set(name, row);
    }
    const result = [...map.values()];
    result.forEach((g) =>
      g.items.sort((a: Row, b: Row) =>
        sort === "amount_asc"
          ? byMoney(a, b, "expense", false)
          : sort === "name_asc"
            ? String(a.name).localeCompare(String(b.name), getLocale())
            : byMoney(a, b, "expense"),
      ),
    );
    return result
      .filter((g) => groupFilter === "all" || g.name === groupFilter)
      .sort((a, b) =>
        sort === "amount_asc"
          ? a.expense === b.expense
            ? 0
            : a.expense > b.expense
              ? 1
              : -1
          : sort === "name_asc"
            ? a.name.localeCompare(b.name, getLocale())
            : a.expense === b.expense
              ? 0
              : a.expense > b.expense
                ? -1
                : 1,
      );
  }, [groups, groupFilter, sort]);
  const groupNames = [
    ...new Set(groups.map((g) => g.group || label("未分组", "Ungrouped"))),
  ].sort();
  const total = BigInt(totalExpense || 0);
  return (
    <section className="panel hierarchy-panel">
      <div className="panel-heading">
        <div>
          <h3>{label("支出分类层级", "Spending category hierarchy")}</h3>
          <p>
            {label(
              "先看分组，再展开查看分类、退款和净支出。",
              "Review groups first, then expand categories, refunds, and net spending.",
            )}
          </p>
        </div>
        <div className="chart-controls">
          <select
            aria-label={label("筛选分类分组", "Filter category group")}
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
          >
            <option value="all">{label("全部分组", "All groups")}</option>
            {groupNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label={label("分类层级排序", "Category hierarchy sort")}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="amount_desc">
              {label("金额从高到低", "Amount: high to low")}
            </option>
            <option value="amount_asc">
              {label("金额从低到高", "Amount: low to high")}
            </option>
            <option value="name_asc">
              {label("分类名称", "Category name")}
            </option>
          </select>
        </div>
      </div>
      <div className="hierarchy-list">
        {grouped.map((group) => {
          const percent =
            total > 0n ? Number((group.expense * 10000n) / total) / 100 : 0;
          return (
            <details key={group.name} open>
              <summary>
                <span>
                  <b>{group.name}</b>
                  <small>
                    {group.items.length} {label("个分类", "categories")}
                  </small>
                </span>
                <span>
                  <b>{percent}%</b>
                  <strong>¥ {format(group.expense, hidden)}</strong>
                </span>
              </summary>
              <div className="hierarchy-progress">
                <i style={{ width: `${Math.min(100, percent)}%` }} />
              </div>
              {group.items.map((item: Row) => (
                <button
                  key={item.version_id}
                  onClick={() => onCategory(item.version_id)}
                >
                  <span>{item.name}</span>
                  <small>
                    {label("毛支出", "Gross")} ¥ {format(item.expense, hidden)}{" "}
                    · {label("退款", "Refund")} ¥ {format(item.refund, hidden)}
                  </small>
                  <strong>
                    {label("净支出", "Net")} ¥ {format(item.net, hidden)}
                  </strong>
                </button>
              ))}
            </details>
          );
        })}
        {!grouped.length && (
          <p className="calm-empty">
            {label("此范围没有支出", "No spending in this range")}
          </p>
        )}
      </div>
    </section>
  );
}
