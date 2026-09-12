import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";

import {
  AppScreen,
  Card,
  LoadingState,
  MoneyAmount,
  PageHeader,
} from "@/components/ui";
import { radius, spacing, useAppTheme } from "@/constants/theme";
import { useFinance } from "@/data/finance-context";
import { loadAnalytics, type AnalyticsSnapshot } from "@/data/repository";
import { addDays, today } from "@/domain/dates";
import { formatMoney } from "@/domain/money";

type Range = "CYCLE" | "7D" | "30D" | "90D" | "MONTH" | "YEAR";
type Dimension = "EXPENSE" | "INCOME" | "BUDGET";
type ChartView = "DONUT" | "BAR";
type TrendSeries = "BOTH" | "INCOME" | "EXPENSE";
type Sort = "AMOUNT_DESC" | "AMOUNT_ASC" | "NAME";
type ChartRow = {
  id: string;
  name: string;
  groupName?: string;
  amountMinor: number;
  actualMinor?: number;
  refundMinor?: number;
};

const rangeOptions: { id: Range; label: string }[] = [
  { id: "CYCLE", label: "本周期" },
  { id: "7D", label: "近7天" },
  { id: "30D", label: "近30天" },
  { id: "90D", label: "近90天" },
  { id: "MONTH", label: "本月" },
  { id: "YEAR", label: "本年" },
];
const dimensionOptions: { id: Dimension; label: string }[] = [
  { id: "EXPENSE", label: "支出" },
  { id: "INCOME", label: "收入" },
  { id: "BUDGET", label: "预算" },
];
const sortOptions: { id: Sort; label: string }[] = [
  { id: "AMOUNT_DESC", label: "金额 ↓" },
  { id: "AMOUNT_ASC", label: "金额 ↑" },
  { id: "NAME", label: "名称" },
];

function nextMonthStart(date: string) {
  const [year, month] = date.split("-").map(Number);
  const next = month === 12 ? [year + 1, 1] : [year, month + 1];
  return next[0] + "-" + String(next[1]).padStart(2, "0") + "-01";
}
function compactMoney(value: number) {
  const yuan = Math.abs(value) / 100;
  if (yuan >= 10000)
    return (
      (value < 0 ? "-" : "") +
      (yuan / 10000).toFixed(yuan >= 100000 ? 0 : 1) +
      "万"
    );
  if (yuan >= 1000)
    return (value < 0 ? "-" : "") + (yuan / 1000).toFixed(1) + "千";
  return (value / 100).toFixed(yuan >= 100 ? 0 : 1);
}
function percent(amount: number, total: number) {
  return total > 0 ? (amount / total) * 100 : 0;
}
function layoutPercent(value: number) {
  return (Math.min(100, Math.max(0, value)) + "%") as any;
}

export default function AnalyticsScreen() {
  const colors = useAppTheme();
  const db = useSQLiteContext();
  const { snapshot, error } = useFinance();
  const [range, setRange] = useState<Range>("CYCLE");
  const [dimension, setDimension] = useState<Dimension>("EXPENSE");
  const [chartView, setChartView] = useState<ChartView>("DONUT");
  const [trendSeries, setTrendSeries] = useState<TrendSeries>("EXPENSE");
  const [sort, setSort] = useState<Sort>("AMOUNT_DESC");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const dates = useMemo(() => {
    if (!snapshot) return null;
    const now = today();
    if (range === "CYCLE")
      return { start: snapshot.cycle.start, end: snapshot.cycle.end };
    if (range === "7D")
      return { start: addDays(now, -6), end: addDays(now, 1) };
    if (range === "30D")
      return { start: addDays(now, -29), end: addDays(now, 1) };
    if (range === "90D")
      return { start: addDays(now, -89), end: addDays(now, 1) };
    if (range === "YEAR")
      return {
        start: now.slice(0, 4) + "-01-01",
        end: String(Number(now.slice(0, 4)) + 1) + "-01-01",
      };
    const start = now.slice(0, 7) + "-01";
    return { start, end: nextMonthStart(start) };
  }, [range, snapshot]);

  useEffect(() => {
    if (!dates) return;
    setData(null);
    setLoadError(null);
    loadAnalytics(db, dates.start, dates.end)
      .then(setData)
      .catch((reason) =>
        setLoadError(reason instanceof Error ? reason.message : "统计失败"),
      );
  }, [db, dates]);

  const chartRows = useMemo<ChartRow[]>(() => {
    if (!snapshot || !data) return [];
    const rows: ChartRow[] =
      dimension === "EXPENSE"
        ? data.categories.map((item) => ({
            id: item.id,
            name: item.name,
            groupName: item.groupName,
            amountMinor: item.grossMinor,
            actualMinor: item.netMinor,
            refundMinor: item.refundMinor,
          }))
        : dimension === "INCOME"
          ? data.incomeCategories
          : snapshot.budgets
              .filter((item) => item.budgetMinor > 0)
              .map((item) => ({
                id: item.categoryId,
                name: item.name,
                groupName: item.groupName,
                amountMinor: item.budgetMinor,
                actualMinor: item.actualMinor,
              }));
    return [...rows].sort((a, b) =>
      sort === "NAME"
        ? a.name.localeCompare(b.name, "zh-CN")
        : sort === "AMOUNT_ASC"
          ? a.amountMinor - b.amountMinor
          : b.amountMinor - a.amountMinor,
    );
  }, [data, dimension, snapshot, sort]);

  const expenseGroups = useMemo(() => {
    if (!data) return [];
    const map = new Map<
      string,
      { name: string; amountMinor: number; rows: ChartRow[] }
    >();
    for (const item of data.categories) {
      const row = map.get(item.groupName) ?? {
        name: item.groupName,
        amountMinor: 0,
        rows: [],
      };
      row.amountMinor += item.grossMinor;
      row.rows.push({
        id: item.id,
        name: item.name,
        amountMinor: item.grossMinor,
        actualMinor: item.netMinor,
        refundMinor: item.refundMinor,
      });
      map.set(item.groupName, row);
    }
    return [...map.values()].sort((a, b) => b.amountMinor - a.amountMinor);
  }, [data]);

  if (!snapshot)
    return (
      <AppScreen>
        <LoadingState error={error} />
      </AppScreen>
    );
  if (!data)
    return (
      <AppScreen>
        <LoadingState error={loadError} />
      </AppScreen>
    );

  const hidden = !snapshot.settings.amountsVisible;
  const total = chartRows.reduce(
    (sum, item) => sum + Math.max(0, item.amountMinor),
    0,
  );
  const selected = chartRows.find((item) => item.id === selectedId);
  const circumference = 2 * Math.PI * 45;
  const maxRow = Math.max(
    1,
    ...chartRows.map((item) =>
      Math.max(item.amountMinor, item.actualMinor ?? 0),
    ),
  );
  const dailyRows = data.daily.slice(-10);
  const dailyValue = (item: (typeof dailyRows)[number]) =>
    trendSeries === "INCOME"
      ? item.incomeMinor
      : trendSeries === "EXPENSE"
        ? Math.max(0, item.expenseMinor)
        : Math.max(item.incomeMinor, Math.max(0, item.expenseMinor));
  const maxDaily = Math.max(1, ...dailyRows.map(dailyValue));
  let offset = 0;

  return (
    <AppScreen>
      <PageHeader
        title="统计分析"
        subtitle={
          dates!.start + " 至 " + addDays(dates!.end, -1) + " · 按实际发生日期"
        }
      />
      <View style={styles.chips}>
        {rangeOptions.map((item) => (
          <Chip
            key={item.id}
            label={item.label}
            active={range === item.id}
            onPress={() => setRange(item.id)}
          />
        ))}
      </View>

      <View style={styles.metrics}>
        <Card style={styles.metric}>
          <Text style={[styles.muted, { color: colors.textSecondary }]}>
            收入
          </Text>
          <MoneyAmount
            value={data.totals.incomeMinor}
            hidden={hidden}
            size={20}
            color={colors.income}
          />
        </Card>
        <Card style={styles.metric}>
          <Text style={[styles.muted, { color: colors.textSecondary }]}>
            净支出
          </Text>
          <MoneyAmount
            value={data.totals.netExpenseMinor}
            hidden={hidden}
            size={20}
            color={colors.expense}
          />
        </Card>
        <Card style={styles.metric}>
          <Text style={[styles.muted, { color: colors.textSecondary }]}>
            储蓄率
          </Text>
          <Text style={[styles.big, { color: colors.text }]}>
            {hidden ? "••••" : (data.totals.savingsRate * 100).toFixed(1) + "%"}
          </Text>
        </Card>
      </View>

      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderText}>
            <Text style={[styles.title, { color: colors.text }]}>构成分析</Text>
            <Text style={[styles.muted, { color: colors.textSecondary }]}>
              {dimension === "BUDGET"
                ? "预算绑定当前周期 " +
                  snapshot.cycle.start +
                  " 至 " +
                  addDays(snapshot.cycle.end, -1)
                : "图上显示主要占比，点按图形查看精确金额。"}
            </Text>
          </View>
        </View>
        <View style={styles.chips}>
          {dimensionOptions.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              active={dimension === item.id}
              onPress={() => {
                setDimension(item.id);
                setSelectedId(null);
              }}
            />
          ))}
        </View>
        <View style={styles.chips}>
          <Chip
            label="环形图"
            active={chartView === "DONUT"}
            onPress={() => setChartView("DONUT")}
          />
          <Chip
            label="条形图"
            active={chartView === "BAR"}
            onPress={() => setChartView("BAR")}
          />
          {sortOptions.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              active={sort === item.id}
              onPress={() => setSort(item.id)}
            />
          ))}
        </View>

        {total > 0 && chartView === "DONUT" ? (
          <>
            <View style={styles.chartRow}>
              <Svg width={180} height={180} viewBox="0 0 120 120">
                <Circle
                  cx="60"
                  cy="60"
                  r="45"
                  fill="none"
                  stroke={colors.surfaceMuted}
                  strokeWidth="20"
                />
                {chartRows.map((item, index) => {
                  const share = Math.max(0, item.amountMinor) / total;
                  const length = share * circumference;
                  const start = offset;
                  const middle = start / circumference + share / 2;
                  const angle = middle * Math.PI * 2 - Math.PI / 2;
                  const labelX = 60 + Math.cos(angle) * 45;
                  const labelY = 60 + Math.sin(angle) * 45;
                  offset += length;
                  return (
                    <Circle
                      key={item.id}
                      cx="60"
                      cy="60"
                      r="45"
                      fill="none"
                      stroke={colors.chart[index % colors.chart.length]}
                      strokeWidth={selectedId === item.id ? 24 : 20}
                      opacity={selectedId && selectedId !== item.id ? 0.52 : 1}
                      strokeDasharray={
                        String(length) + " " + String(circumference - length)
                      }
                      strokeDashoffset={-start}
                      rotation="-90"
                      origin="60,60"
                      onPress={() => setSelectedId(item.id)}
                    />
                  );
                })}
                {chartRows.map((item) => {
                  const previous = chartRows
                    .slice(0, chartRows.indexOf(item))
                    .reduce(
                      (sum, row) => sum + Math.max(0, row.amountMinor),
                      0,
                    );
                  const share = Math.max(0, item.amountMinor) / total;
                  if (share < 0.08) return null;
                  const angle =
                    (previous / total + share / 2) * Math.PI * 2 - Math.PI / 2;
                  return (
                    <SvgText
                      key={"label-" + item.id}
                      x={60 + Math.cos(angle) * 45}
                      y={62 + Math.sin(angle) * 45}
                      fill="#FFFFFF"
                      fontSize="7"
                      fontWeight="800"
                      textAnchor="middle"
                    >
                      {hidden ? "••" : Math.round(share * 100) + "%"}
                    </SvgText>
                  );
                })}
                <SvgText
                  x="60"
                  y="57"
                  fill={colors.textSecondary}
                  fontSize="8"
                  textAnchor="middle"
                >
                  {selected ? selected.name.slice(0, 7) : "合计"}
                </SvgText>
                <SvgText
                  x="60"
                  y="69"
                  fill={colors.text}
                  fontSize="8"
                  fontWeight="800"
                  textAnchor="middle"
                >
                  {hidden
                    ? "••••"
                    : selected
                      ? compactMoney(selected.amountMinor)
                      : compactMoney(total)}
                </SvgText>
              </Svg>
              <View style={styles.legend}>
                {chartRows.slice(0, 8).map((item, index) => (
                  <Pressable
                    key={item.id}
                    onPress={() => setSelectedId(item.id)}
                    style={[
                      styles.legendRow,
                      selectedId === item.id && {
                        backgroundColor: colors.surfaceMuted,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.dot,
                        {
                          backgroundColor:
                            colors.chart[index % colors.chart.length],
                        },
                      ]}
                    />
                    <Text
                      style={[styles.legendName, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={[styles.muted, { color: colors.textSecondary }]}
                    >
                      {hidden
                        ? "••••"
                        : percent(item.amountMinor, total).toFixed(1) + "%"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            {selected ? (
              <Text style={[styles.selectedDetail, { color: colors.text }]}>
                {selected.name} ·{" "}
                {percent(selected.amountMinor, total).toFixed(2)}% ·{" "}
                {hidden ? "¥ ••••" : formatMoney(selected.amountMinor)}
              </Text>
            ) : null}
          </>
        ) : total > 0 ? (
          <View style={styles.horizontalBars}>
            {chartRows.map((item, index) => {
              const share = percent(item.amountMinor, total);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setSelectedId(item.id)}
                  style={[
                    styles.horizontalRow,
                    selectedId === item.id && {
                      backgroundColor: colors.surfaceMuted,
                    },
                  ]}
                >
                  <View style={styles.horizontalLabel}>
                    <Text style={[styles.legendName, { color: colors.text }]}>
                      {item.name}
                    </Text>
                    <Text
                      style={[styles.muted, { color: colors.textSecondary }]}
                    >
                      {hidden
                        ? "••••"
                        : share.toFixed(1) +
                          "% · " +
                          formatMoney(item.amountMinor)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.track,
                      { backgroundColor: colors.surfaceMuted },
                    ]}
                  >
                    <View
                      style={[
                        styles.fill,
                        {
                          width: layoutPercent(
                            (item.amountMinor / maxRow) * 100,
                          ),
                          backgroundColor:
                            colors.chart[index % colors.chart.length],
                        },
                      ]}
                    />
                    {dimension === "BUDGET" ? (
                      <View
                        style={[
                          styles.actualMarker,
                          {
                            left: layoutPercent(
                              ((item.actualMinor ?? 0) / maxRow) * 100,
                            ),
                            backgroundColor: colors.text,
                          },
                        ]}
                      />
                    ) : null}
                  </View>
                  {dimension === "BUDGET" ? (
                    <Text
                      style={[styles.muted, { color: colors.textSecondary }]}
                    >
                      已用{" "}
                      {hidden ? "••••" : formatMoney(item.actualMinor ?? 0)}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
            {dimension === "BUDGET" ? (
              <Text style={[styles.muted, { color: colors.textSecondary }]}>
                色条为预算金额，竖线为本周期已用净支出。
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            此维度暂无数据
          </Text>
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={[styles.title, { color: colors.text }]}>
          按实际发生日的收支趋势
        </Text>
        <Text style={[styles.muted, { color: colors.textSecondary }]}>
          每个日期汇总当天已保存的交易；收入、支出相差很大时可单独查看，避免较小金额被压扁。
        </Text>
        <View style={styles.chips}>
          {(
            [
              ["EXPENSE", "净支出"],
              ["INCOME", "收入"],
              ["BOTH", "同时查看"],
            ] as [TrendSeries, string][]
          ).map(([id, label]) => (
            <Chip
              key={id}
              label={label}
              active={trendSeries === id}
              onPress={() => setTrendSeries(id)}
            />
          ))}
        </View>
        {dailyRows.length ? (
          <View style={styles.bars}>
            {dailyRows.map((item) => (
              <View key={item.date} style={styles.day}>
                <Text
                  numberOfLines={1}
                  style={[styles.barValue, { color: colors.textSecondary }]}
                >
                  {hidden ? "••" : compactMoney(dailyValue(item))}
                </Text>
                <View style={styles.barPair}>
                  {trendSeries !== "EXPENSE" ? (
                    <View
                      style={[
                        styles.bar,
                        {
                          height: Math.max(
                            2,
                            (item.incomeMinor / maxDaily) * 94,
                          ),
                          backgroundColor: colors.income,
                        },
                      ]}
                    />
                  ) : null}
                  {trendSeries !== "INCOME" ? (
                    <View
                      style={[
                        styles.bar,
                        {
                          height: Math.max(
                            2,
                            (Math.max(0, item.expenseMinor) / maxDaily) * 94,
                          ),
                          backgroundColor: colors.expense,
                        },
                      ]}
                    />
                  ) : null}
                </View>
                <Text style={[styles.dayText, { color: colors.textSecondary }]}>
                  {item.date.slice(5)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            此范围暂无收支记录
          </Text>
        )}
        <Text style={[styles.muted, { color: colors.textSecondary }]}>
          绿色为收入，红色为扣除退款后的净支出。未来日期不会按零值补入，转账不属于收支。
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text style={[styles.title, { color: colors.text }]}>支出分类层级</Text>
        <Text style={[styles.muted, { color: colors.textSecondary }]}>
          先看分组总额，再点开分类明细。
        </Text>
        {expenseGroups.map((group) => {
          const open = openGroup === group.name;
          return (
            <View
              key={group.name}
              style={[styles.groupBlock, { borderColor: colors.border }]}
            >
              <Pressable
                onPress={() => setOpenGroup(open ? null : group.name)}
                style={styles.groupHeader}
              >
                <View>
                  <Text style={[styles.groupTitle, { color: colors.text }]}>
                    {group.name}
                  </Text>
                  <Text style={[styles.muted, { color: colors.textSecondary }]}>
                    {group.rows.length} 个分类 ·{" "}
                    {percent(
                      group.amountMinor,
                      data.totals.grossExpenseMinor,
                    ).toFixed(1)}
                    %
                  </Text>
                </View>
                <Text style={[styles.groupAmount, { color: colors.text }]}>
                  {hidden ? "¥ ••••" : formatMoney(group.amountMinor)}
                </Text>
              </Pressable>
              {open
                ? group.rows.map((item) => (
                    <View
                      key={item.id}
                      style={[
                        styles.categoryDetail,
                        { borderTopColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.legendName, { color: colors.text }]}>
                        {item.name}
                      </Text>
                      <Text
                        style={[styles.muted, { color: colors.textSecondary }]}
                      >
                        毛支出 {hidden ? "••••" : formatMoney(item.amountMinor)}{" "}
                        · 退款{" "}
                        {hidden ? "••••" : formatMoney(item.refundMinor ?? 0)}
                      </Text>
                      <Text style={[styles.detailNet, { color: colors.text }]}>
                        净支出{" "}
                        {hidden ? "••••" : formatMoney(item.actualMinor ?? 0)}
                      </Text>
                    </View>
                  ))
                : null}
            </View>
          );
        })}
        {!expenseGroups.length ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            此范围暂无支出
          </Text>
        ) : null}
      </Card>

      <Card style={styles.card}>
        <Text style={[styles.title, { color: colors.text }]}>计算说明</Text>
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          毛支出 {hidden ? "••••" : formatMoney(data.totals.grossExpenseMinor)}{" "}
          · 退款 {hidden ? "••••" : formatMoney(data.totals.refundMinor)}
          。储蓄率 =（收入 − 净支出）÷
          收入。预算分析始终绑定当前预算周期，切换近7天等范围不会拆分或复制预算。
        </Text>
      </Card>
    </AppScreen>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.primary : colors.surface,
          borderColor: active ? colors.primary : colors.border,
        },
      ]}
    >
      <Text
        style={[styles.chipText, { color: active ? "#FFFFFF" : colors.text }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontSize: 12, fontWeight: "800" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metric: { flexGrow: 1, minWidth: 105, gap: spacing.sm },
  muted: { fontSize: 12, lineHeight: 18 },
  big: { fontSize: 20, fontWeight: "900" },
  card: { gap: spacing.lg },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  cardHeaderText: { flex: 1, gap: spacing.xs },
  title: { fontSize: 18, fontWeight: "900" },
  chartRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  legend: { flex: 1, gap: 2 },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 30,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  legendName: { flex: 1, fontSize: 13, fontWeight: "700" },
  selectedDetail: { textAlign: "center", fontSize: 13, fontWeight: "800" },
  empty: { fontSize: 13, lineHeight: 20 },
  horizontalBars: { gap: spacing.md },
  horizontalRow: { gap: 6, padding: spacing.sm, borderRadius: radius.md },
  horizontalLabel: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  track: { height: 10, borderRadius: radius.pill, position: "relative" },
  fill: { height: 10, borderRadius: radius.pill },
  actualMarker: {
    position: "absolute",
    top: -3,
    height: 16,
    width: 3,
    borderRadius: 2,
  },
  bars: { height: 150, flexDirection: "row", alignItems: "flex-end", gap: 4 },
  day: { flex: 1, alignItems: "center", gap: 4 },
  barPair: {
    height: 100,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  bar: { width: 5, borderRadius: 3 },
  barValue: { width: 36, fontSize: 8, textAlign: "center" },
  dayText: { fontSize: 8, transform: [{ rotate: "-45deg" }] },
  groupBlock: { borderTopWidth: StyleSheet.hairlineWidth },
  groupHeader: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  groupTitle: { fontSize: 15, fontWeight: "800" },
  groupAmount: { fontSize: 14, fontWeight: "800" },
  categoryDetail: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    gap: 4,
  },
  detailNet: { fontSize: 12, fontWeight: "800" },
});
