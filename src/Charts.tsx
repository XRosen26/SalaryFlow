import { useState } from "react";
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
const colors = [
  "#397cad",
  "#bd663c",
  "#7c69bd",
  "#398873",
  "#b2476c",
  "#9a831c",
  "#667c92",
  "#92969a",
];
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
  const hi = Math.max(1, ...values) * 1.12,
    lo = Math.min(0, ...values) * 1.12;
  const y = (v: number) => 215 - ((v - lo) / (hi - lo)) * 175;
  const step = 490 / Math.max(1, rows.length),
    x = (i: number) => 85 + (i + 0.5) * step;
  const names: Row = {
    income: label("收入", "Income"),
    expense: label("净支出", "Net spending"),
  };
  const tick = (v: number) =>
    hidden
      ? "••••"
      : new Intl.NumberFormat(getLocale(), {
          notation: "compact",
          maximumFractionDigits: 1,
        }).format(v / 100);
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
          "仅画截至今天的已发生日期，未来日期不按零值绘制。收支量级差距大时可单独查看净支出。",
          "Only elapsed dates are plotted; future dates are not zero-filled. Select net spending alone when income is much larger.",
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
                  {tick(v)}
                </text>
              </g>
            );
          })}
          <line x1="85" x2="575" y1={y(0)} y2={y(0)} className="chart-zero" />
          {keys.map((k, j) => (
            <g key={k}>
              {mode === "line" && (
                <polyline
                  fill="none"
                  stroke={k === "income" ? colors[0] : colors[1]}
                  strokeWidth="2.5"
                  points={rows
                    .map((r: Row, i: number) => `${x(i)},${y(Number(r[k]))}`)
                    .join(" ")}
                />
              )}{" "}
              {rows.map((r: Row, i: number) => {
                const value = Number(r[k]),
                  w = Math.max(0.5, Math.min(22, step / (keys.length + 1))),
                  cx = x(i) + (j - (keys.length - 1) / 2) * w;
                return (
                  <g key={r.date} tabIndex={0}>
                    <title>
                      {r.date}
                      {r.date !== r.end ? " — " + r.end : ""}
                      {"\n"}
                      {names[k]} ¥ {format(r[k], hidden)}
                    </title>
                    {mode === "bar" ? (
                      <rect
                        x={cx - w / 2}
                        width={w * 0.85}
                        y={Math.min(y(value), y(0))}
                        height={Math.abs(y(value) - y(0))}
                        fill={k === "income" ? colors[0] : colors[1]}
                        rx="2"
                      />
                    ) : (
                      <circle
                        cx={x(i)}
                        cy={y(value)}
                        r="3.5"
                        fill={k === "income" ? colors[0] : colors[1]}
                      />
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
  hidden,
  onCategory,
}: {
  report: Row;
  accounts: Row[];
  hidden?: boolean;
  onCategory: (id: string) => void;
}) {
  const [dimension, setDimension] = useState("expense");
  const input =
    dimension === "expense"
      ? report.groups.map((g: Row) => ({
          id: g.version_id,
          name: g.name,
          amount: g.expense,
        }))
      : dimension === "income"
        ? report.incomeGroups || []
        : accounts.map((a) => ({ id: a.id, name: a.name, amount: a.balance }));
  const chart = pieData(input);
  let offset = 0;
  return (
    <section className="panel composition-panel">
      <div className="panel-heading">
        <div>
          <h3>{label("构成分析 · 环形饼图", "Composition · donut chart")}</h3>
          <p>
            {dimension === "assets"
              ? label(
                  "当前正余额账户占比，非所选期间的历史资产；负余额不进入饼图。",
                  "Current positive balances, not historical assets for the selected range. Negative balances are excluded.",
                )
              : dimension === "expense"
                ? label(
                    "按毛支出计算占比，退款单列，不将负净支出画进饼图。",
                    "Shares use gross spending. Refunds remain separate; negative net spending is not a pie slice.",
                  )
                : label(
                    "按所选日期范围的实际收入分类汇总。",
                    "Income categories within the selected dates.",
                  )}
          </p>
        </div>
        <select
          aria-label={label("饼图分析维度", "Composition dimension")}
          value={dimension}
          onChange={(e) => setDimension(e.target.value)}
        >
          <option value="expense">
            {label("支出分类", "Spending categories")}
          </option>
          <option value="income">{label("收入来源", "Income sources")}</option>
          <option value="assets">{label("账户资产", "Account assets")}</option>
        </select>
      </div>
      {chart.total === 0n ? (
        <p className="calm-empty">
          {label(
            "此维度暂无可绘制的正金额",
            "No positive amounts for this dimension",
          )}
        </p>
      ) : (
        <div className="donut-layout">
          <svg
            viewBox="0 0 260 260"
            role="img"
            aria-label={label("金额占比环形图", "Amount composition donut")}
          >
            <circle
              cx="130"
              cy="130"
              r="88"
              fill="none"
              stroke="var(--soft)"
              strokeWidth="38"
            />
            {chart.rows.map((r: Row, i: number) => {
              const o = offset;
              offset += r.share;
              return (
                <circle
                  key={r.id}
                  cx="130"
                  cy="130"
                  r="88"
                  fill="none"
                  stroke={colors[i]}
                  strokeWidth="38"
                  pathLength="100"
                  strokeDasharray={`${r.share * 100} ${100 - r.share * 100}`}
                  strokeDashoffset={-o * 100}
                  transform="rotate(-90 130 130)"
                  tabIndex={0}
                >
                  <title>
                    {r.name || label("其他合计", "Other combined")} ·{" "}
                    {r.percent}% · ¥ {format(r.amount, hidden)}
                  </title>
                </circle>
              );
            })}
            <text x="130" y="124" textAnchor="middle" className="donut-title">
              {label("合计", "Total")}
            </text>
            <text x="130" y="148" textAnchor="middle" className="donut-total">
              {format(chart.total, hidden)}
            </text>
          </svg>
          <div className="donut-legend">
            {chart.rows.map((r: Row, i: number) => (
              <button
                key={r.id}
                disabled={dimension !== "expense" || r.id === "__rest"}
                onClick={() => onCategory(r.id)}
              >
                <i style={{ background: colors[i] }} />
                <span>{r.name || label("其他合计", "Other combined")}</span>
                <b>{r.percent}%</b>
                <strong>¥ {format(r.amount, hidden)}</strong>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
