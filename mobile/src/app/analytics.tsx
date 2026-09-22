import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";

import {
  AppScreen,
  Card,
  LoadingState,
  MoneyAmount,
  PageHeader,
} from "@/components/ui";
import { DateField } from "@/components/date-field";
import { radius, spacing, useAppTheme } from "@/constants/theme";
import { useFinance } from "@/data/finance-context";
import { loadAnalytics, type AnalyticsSnapshot } from "@/data/repository";
import {
  addDays,
  calendarPeriodOptions,
  normalizeDateInput,
  today,
  type CalendarPeriodOption,
  type CalendarPeriodUnit,
} from "@/domain/dates";
import { formatMoney } from "@/domain/money";

type Range =
  | "CYCLE"
  | "TODAY"
  | "3D"
  | "7D"
  | "30D"
  | "90D"
  | "MONTH"
  | "YEAR"
  | "CUSTOM"
  | "PERIOD";
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
  { id: "TODAY", label: "今日" },
  { id: "3D", label: "近3天" },
  { id: "7D", label: "近7天" },
  { id: "30D", label: "近30天" },
  { id: "90D", label: "近90天" },
  { id: "MONTH", label: "本月" },
  { id: "YEAR", label: "本年" },
  { id: "CUSTOM", label: "自定义" },
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
  const [accountId, setAccountId] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [periodUnit, setPeriodUnit] = useState<CalendarPeriodUnit>("week");
  const [periodChoice, setPeriodChoice] = useState<CalendarPeriodOption | null>(
    null,
  );
  const [periodOpen, setPeriodOpen] = useState(false);
  const [customStart, setCustomStart] = useState(today());
  const [customEnd, setCustomEnd] = useState(today());
  const [appliedCustom, setAppliedCustom] = useState({
    start: today(),
    end: today(),
  });
  const [customError, setCustomError] = useState("");

  const periodOptions = useMemo(
    () =>
      snapshot
        ? calendarPeriodOptions(periodUnit, snapshot.ledgerStartDate, today())
        : [],
    [periodUnit, snapshot],
  );

  const dates = useMemo(() => {
    if (!snapshot) return null;
    const now = today();
    if (range === "CYCLE")
      return { start: snapshot.cycle.start, end: snapshot.cycle.end };
    if (range === "TODAY") return { start: now, end: addDays(now, 1) };
    if (range === "3D")
      return { start: addDays(now, -2), end: addDays(now, 1) };
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
    if (range === "CUSTOM")
      return {
        start: appliedCustom.start,
        end: addDays(appliedCustom.end, 1),
      };
    if (range === "PERIOD" && periodChoice)
      return { start: periodChoice.start, end: periodChoice.end };
    const start = now.slice(0, 7) + "-01";
    return { start, end: nextMonthStart(start) };
  }, [appliedCustom, periodChoice, range, snapshot]);

  useEffect(() => {
    if (!dates) return;
    setData(null);
    setLoadError(null);
    loadAnalytics(db, dates.start, dates.end, accountId || undefined)
      .then(setData)
      .catch((reason) =>
        setLoadError(reason instanceof Error ? reason.message : "统计失败"),
      );
  }, [db, dates]);

  const applyCustomRange = () => {
    try {
      const start = normalizeDateInput(customStart);
      const end = normalizeDateInput(customEnd);
      if (start > end) throw new Error("开始日期不能晚于结束日期");
      setCustomStart(start);
      setCustomEnd(end);
      setAppliedCustom({ start, end });
      setCustomError("");
      setRange("CUSTOM");
    } catch (reason) {
      setCustomError(reason instanceof Error ? reason.message : "日期无效");
    }
  };

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

      <Card style={styles.rangeCard}>
        <Text style={[styles.rangeTitle, { color: colors.text }]}>
          按日历周期快速查看
        </Text>
        <Text style={[styles.muted, { color: colors.textSecondary }]}>
          只列出从首次记账日期到当前的周、月和年。
        </Text>
        <View style={styles.quickPeriodRow}>
          {(
            [
              ["week", "周"],
              ["month", "月"],
              ["year", "年"],
            ] as [CalendarPeriodUnit, string][]
          ).map(([unit, label]) => (
            <Chip
              key={unit}
              label={label}
              active={periodUnit === unit}
              onPress={() => {
                setPeriodUnit(unit);
                setPeriodChoice(null);
              }}
            />
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="选择具体日历周期"
            onPress={() => setPeriodOpen(true)}
            style={[
              styles.periodSelector,
              {
                backgroundColor:
                  range === "PERIOD" ? colors.primarySoft : colors.surface,
                borderColor:
                  range === "PERIOD" ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[styles.periodSelectorText, { color: colors.text }]}
              numberOfLines={1}
            >
              {periodChoice?.label ??
                `选择具体${periodUnit === "week" ? "周" : periodUnit === "month" ? "月" : "年"}`}
            </Text>
            <Text style={{ color: colors.textSecondary }}>⌄</Text>
          </Pressable>
        </View>
      </Card>

      {range === "CUSTOM" ? (
        <Card style={styles.rangeCard}>
          <Text style={[styles.rangeTitle, { color: colors.text }]}>
            自定义时间范围
          </Text>
          <View style={styles.customDates}>
            <DateField
              label="开始日期"
              value={customStart}
              onChange={setCustomStart}
              style={styles.customDate}
            />
            <DateField
              label="结束日期"
              value={customEnd}
              onChange={setCustomEnd}
              style={styles.customDate}
            />
          </View>
          {customError ? (
            <Text style={[styles.muted, { color: colors.expense }]}>
              {customError}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={applyCustomRange}
            style={[styles.applyButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.applyButtonText}>应用自定义范围</Text>
          </Pressable>
        </Card>
      ) : null}

      <Card style={styles.rangeCard}>
        <Text style={[styles.rangeTitle, { color: colors.text }]}>统计账户</Text>
        <Text style={[styles.muted, { color: colors.textSecondary }]}>
          选择账户后，收入按入账账户、支出按付款账户、退款按退回账户统计。
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountChips}>
          <Chip label="全部账户" active={!accountId} onPress={() => setAccountId("")} />
          {snapshot.accounts.map((account) => (
            <Chip key={account.id} label={account.name} active={accountId === account.id} onPress={() => setAccountId(account.id)} />
          ))}
        </ScrollView>
      </Card>

      <Modal
        visible={periodOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPeriodOpen(false)}
      >
        <View
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPeriodOpen(false)}
            accessibilityLabel="关闭周期选择"
          />
          <View
            style={[
              styles.periodDialog,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.title, { color: colors.text }]}>
              选择
              {periodUnit === "week"
                ? "周"
                : periodUnit === "month"
                  ? "月"
                  : "年"}
            </Text>
            <Text style={[styles.muted, { color: colors.textSecondary }]}>
              按时间倒序排列，起点为首次记账所在周期。
            </Text>
            <ScrollView
              style={styles.periodList}
              contentContainerStyle={styles.periodListContent}
            >
              {periodOptions.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    setPeriodChoice(item);
                    setRange("PERIOD");
                    setPeriodOpen(false);
                  }}
                  style={[
                    styles.periodOption,
                    { borderBottomColor: colors.border },
                    periodChoice?.key === item.key && {
                      backgroundColor: colors.primarySoft,
                    },
                  ]}
                >
                  <View>
                    <Text
                      style={[styles.periodOptionTitle, { color: colors.text }]}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={[styles.muted, { color: colors.textSecondary }]}
                    >
                      {item.start} 至 {addDays(item.end, -1)}
                    </Text>
                  </View>
                  {periodChoice?.key === item.key ? (
                    <Text style={{ color: colors.primary, fontWeight: "900" }}>
                      ✓
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View style={styles.metrics}>
        <Card style={styles.metric}>
          <Text style={[styles.muted, { color: colors.textSecondary }]}>
            今日支出
          </Text>
          <MoneyAmount
            value={snapshot.summary.todayExpenseMinor}
            hidden={hidden}
            size={20}
            color={colors.expense}
          />
        </Card>
        <Card style={styles.metric}>
          <Text style={[styles.muted, { color: colors.textSecondary }]}>
            最近3天支出
          </Text>
          <MoneyAmount
            value={snapshot.summary.threeDayExpenseMinor}
            hidden={hidden}
            size={20}
            color={colors.expense}
          />
        </Card>
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
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.bars}>
            {dailyRows.map((item) => (
              <Pressable
                key={item.date}
                style={styles.day}
                onPress={() => setSelectedId("trend-" + item.date)}
              >
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
                {selectedId === "trend-" + item.date ? (
                  <Text style={[styles.trendDetail, { color: colors.text }]}>
                    {hidden ? "金额已隐藏" : `收 ${compactMoney(item.incomeMinor)} · 支 ${compactMoney(Math.max(0, item.expenseMinor))}`}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
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
  bars: { minHeight: 178, flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 4 },
  day: { width: 58, alignItems: "center", gap: 4 },
  barPair: {
    height: 100,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  bar: { width: 5, borderRadius: 3 },
  barValue: { width: 36, fontSize: 8, textAlign: "center" },
  dayText: { fontSize: 10, transform: [{ rotate: "-35deg" }], marginTop: 3 },
  trendDetail: { fontSize: 8, fontWeight: "800", textAlign: "center", width: 58 },
  accountChips: { gap: spacing.sm, paddingRight: spacing.md },
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
  rangeCard: { gap: spacing.md },
  rangeTitle: { fontSize: 15, fontWeight: "900" },
  quickPeriodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
  },
  periodSelector: {
    minHeight: 42,
    minWidth: 178,
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  periodSelectorText: { flex: 1, fontSize: 14, fontWeight: "800" },
  customDates: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  customDate: { minWidth: 210, flex: 1 },
  applyButton: {
    minHeight: 44,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
  },
  applyButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  periodDialog: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "78%",
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  periodList: { marginTop: spacing.sm },
  periodListContent: { paddingBottom: spacing.sm },
  periodOption: {
    minHeight: 62,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  periodOptionTitle: { fontSize: 15, fontWeight: "900" },
});
