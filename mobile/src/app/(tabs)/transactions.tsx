import { Ionicons } from "@expo/vector-icons";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { DateField } from "@/components/date-field";
import {
  AppScreen,
  Card,
  Divider,
  LoadingState,
  MoneyAmount,
  PageHeader,
} from "@/components/ui";
import { radius, spacing, useAppTheme } from "@/constants/theme";
import { useFinance } from "@/data/finance-context";
import { loadTransactions, type TransactionItem } from "@/data/repository";
import { addDays, normalizeDateInput, today } from "@/domain/dates";
import { parseMoneyExpression } from "@/domain/money";

type Filter = "ALL" | TransactionItem["kind"] | "RECEIVABLE";
type Sort =
  "DATE_DESC" | "DATE_ASC" | "AMOUNT_DESC" | "AMOUNT_ASC" | "CATEGORY";
const filters: { id: Filter; label: string }[] = [
  { id: "ALL", label: "全部" },
  { id: "EXPENSE", label: "支出" },
  { id: "INCOME", label: "收入" },
  { id: "TRANSFER", label: "转账" },
  { id: "REFUND", label: "退款" },
  { id: "RECEIVABLE", label: "待收款" },
];

export default function TransactionsScreen() {
  const colors = useAppTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const { snapshot, error } = useFinance();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("DATE_DESC");
  const [rangeOpen, setRangeOpen] = useState(false);
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState(today());
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [applied, setApplied] = useState({
    start: "",
    end: "",
    min: undefined as number | undefined,
    max: undefined as number | undefined,
  });
  const [rows, setRows] = useState<TransactionItem[]>([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!snapshot) return;
    let cancelled = false;
    setLoadError("");
    loadTransactions(db, {
      kind: filter === "ALL" ? undefined : filter,
      search: query,
      start: applied.start || undefined,
      end: applied.end ? addDays(applied.end, 1) : undefined,
      minAmountMinor: applied.min,
      maxAmountMinor: applied.max,
      sort,
    })
      .then((next) => {
        if (!cancelled) setRows(next);
      })
      .catch((reason) => {
        if (!cancelled)
          setLoadError(reason instanceof Error ? reason.message : "读取失败");
      });
    return () => {
      cancelled = true;
    };
  }, [applied, db, filter, query, snapshot, sort]);

  const quickRange = (days?: number) => {
    if (!days) {
      setStart("");
      setEnd("");
      return;
    }
    const now = today();
    setStart(addDays(now, 1 - days));
    setEnd(now);
  };
  const applyRange = () => {
    try {
      if (start && end && start > end)
        throw new Error("开始日期不能晚于结束日期");
      const normalizedStart = start.trim() ? normalizeDateInput(start) : "";
      const normalizedEnd = end.trim() ? normalizeDateInput(end) : "";
      const min = minAmount.trim()
        ? Number(parseMoneyExpression(minAmount, { zero: true }))
        : undefined;
      const max = maxAmount.trim()
        ? Number(parseMoneyExpression(maxAmount, { zero: true }))
        : undefined;
      if (min !== undefined && max !== undefined && min > max)
        throw new Error("最低金额不能大于最高金额");
      setStart(normalizedStart);
      setEnd(normalizedEnd);
      setApplied({ start: normalizedStart, end: normalizedEnd, min, max });
      setRangeOpen(false);
    } catch (reason) {
      Alert.alert(
        "筛选条件有误",
        reason instanceof Error ? reason.message : "请检查输入",
      );
    }
  };
  const clearRange = () => {
    setStart("");
    setEnd("");
    setMinAmount("");
    setMaxAmount("");
    setApplied({ start: "", end: "", min: undefined, max: undefined });
    setRangeOpen(false);
  };

  if (!snapshot)
    return (
      <AppScreen>
        <LoadingState error={error} />
      </AppScreen>
    );
  const hidden = !snapshot.settings.amountsVisible;
  const hasRange = Boolean(
    applied.start ||
    applied.end ||
    applied.min !== undefined ||
    applied.max !== undefined,
  );

  return (
    <AppScreen>
      <PageHeader
        title="交易明细"
        subtitle="按实际发生日期保存，一笔记录只统计一次。"
      />
      <View
        style={[
          styles.search,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Ionicons
          name="search-outline"
          size={20}
          color={colors.textSecondary}
        />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="搜索分类、账户、备注或日期"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { color: colors.text }]}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} accessibilityLabel="清空搜索">
            <Ionicons
              name="close-circle"
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.filters}>
        {filters.map((item) => {
          const active = filter === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setFilter(item.id)}
              style={[
                styles.filter,
                {
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: active ? "#FFFFFF" : colors.text },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.sortRow}>
        <Text style={[styles.sortLabel, { color: colors.textSecondary }]}>
          排序
        </Text>
        {(
          [
            ["DATE_DESC", "最新"],
            ["DATE_ASC", "最早"],
            ["AMOUNT_DESC", "金额 ↓"],
            ["AMOUNT_ASC", "金额 ↑"],
            ["CATEGORY", "分类"],
          ] as [Sort, string][]
        ).map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() => setSort(id)}
            style={[
              styles.sortButton,
              {
                backgroundColor:
                  sort === id ? colors.primarySoft : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.sortButtonText,
                { color: sort === id ? colors.primary : colors.textSecondary },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setRangeOpen(!rangeOpen)}
          style={[
            styles.sortButton,
            {
              backgroundColor: hasRange ? colors.primary : colors.surface,
              borderColor: hasRange ? colors.primary : colors.border,
            },
          ]}
        >
          <Ionicons
            name="options-outline"
            size={15}
            color={hasRange ? "#FFFFFF" : colors.textSecondary}
          />
          <Text
            style={[
              styles.sortButtonText,
              { color: hasRange ? "#FFFFFF" : colors.textSecondary },
            ]}
          >
            范围
          </Text>
        </Pressable>
      </View>

      {rangeOpen ? (
        <Card style={styles.rangeCard}>
          <Text style={[styles.rangeTitle, { color: colors.text }]}>
            时间与金额范围
          </Text>
          <View style={styles.quickRow}>
            {[
              ["今日", 1],
              ["近3天", 3],
              ["近7天", 7],
              ["近30天", 30],
              ["全部", 0],
            ].map(([label, days]) => (
              <Pressable
                key={String(label)}
                onPress={() => quickRange(Number(days))}
                style={[styles.quick, { backgroundColor: colors.primarySoft }]}
              >
                <Text style={{ color: colors.primary, fontWeight: "800" }}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <DateField
            optional
            label="开始日期（可选）"
            value={start}
            onChange={setStart}
          />
          <DateField
            optional
            label="结束日期（可选）"
            value={end}
            onChange={setEnd}
          />
          <View style={styles.amountRanges}>
            <View style={styles.amountField}>
              <Text
                style={[styles.fieldLabel, { color: colors.textSecondary }]}
              >
                最低金额
              </Text>
              <TextInput
                value={minAmount}
                onChangeText={setMinAmount}
                keyboardType="decimal-pad"
                placeholder="不限"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.rangeInput,
                  { color: colors.text, borderColor: colors.border },
                ]}
              />
            </View>
            <View style={styles.amountField}>
              <Text
                style={[styles.fieldLabel, { color: colors.textSecondary }]}
              >
                最高金额
              </Text>
              <TextInput
                value={maxAmount}
                onChangeText={setMaxAmount}
                keyboardType="decimal-pad"
                placeholder="不限"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.rangeInput,
                  { color: colors.text, borderColor: colors.border },
                ]}
              />
            </View>
          </View>
          <View style={styles.rangeActions}>
            <Pressable
              onPress={clearRange}
              style={[styles.rangeButton, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.text }}>清除</Text>
            </Pressable>
            <Pressable
              onPress={applyRange}
              style={[
                styles.rangeButton,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                },
              ]}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>
                应用筛选
              </Text>
            </Pressable>
          </View>
        </Card>
      ) : null}

      {loadError ? (
        <Text style={{ color: colors.expense }}>{loadError}</Text>
      ) : null}
      <Card style={styles.list}>
        {rows.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={34} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              没有匹配的交易
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              换一个筛选条件，或从“记一笔”新增。
            </Text>
          </View>
        ) : (
          rows.map((item, index) => {
            const receivable = Boolean(item.receivableId);
            const positive =
              item.kind === "INCOME" ||
              item.kind === "REFUND" ||
              item.receivableDirection === "REPAID";
            const transfer = item.kind === "TRANSFER";
            const title = receivable
              ? `${item.receivableDirection === "LENT" ? "待收借出" : "待收归还"} · ${item.receivablePerson}`
              : transfer
                ? "账户转账"
                : (item.categoryName ??
                  (item.kind === "ADJUSTMENT" ? "余额调整" : item.kind));
            const account = transfer
              ? String(item.sourceName) + " → " + String(item.destinationName)
              : (item.sourceName ?? item.destinationName);
            return (
              <View key={item.id}>
                {index ? <Divider /> : null}
                <Pressable
                  onPress={() =>
                    router.push(("/transaction-detail?id=" + item.id) as never)
                  }
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { opacity: 0.68 },
                  ]}
                >
                  <View
                    style={[
                      styles.icon,
                      {
                        backgroundColor: positive
                          ? colors.primarySoft
                          : colors.surfaceMuted,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        receivable
                          ? "cash-outline"
                          : transfer
                            ? "swap-horizontal"
                            : positive
                              ? "arrow-down"
                              : "arrow-up"
                      }
                      size={18}
                      color={positive ? colors.income : colors.expense}
                    />
                  </View>
                  <View style={styles.text}>
                    <Text style={[styles.title, { color: colors.text }]}>
                      {title}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[styles.meta, { color: colors.textSecondary }]}
                    >
                      {item.date} · {account}
                      {item.note ? " · " + item.note : ""}
                    </Text>
                  </View>
                  <MoneyAmount
                    value={item.amountMinor}
                    hidden={hidden}
                    size={16}
                    color={
                      transfer
                        ? colors.text
                        : positive
                          ? colors.income
                          : colors.expense
                    }
                  />
                </Pressable>
              </View>
            );
          })
        )}
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  search: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, minHeight: 48, fontSize: 15 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  filter: {
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  filterText: { fontSize: 13, fontWeight: "700" },
  sortRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
  },
  sortLabel: { fontSize: 12, fontWeight: "800" },
  sortButton: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  sortButtonText: { fontSize: 12, fontWeight: "800" },
  rangeCard: { gap: spacing.md },
  rangeTitle: { fontSize: 16, fontWeight: "800" },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  quick: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    justifyContent: "center",
  },
  amountRanges: { flexDirection: "row", gap: spacing.md },
  amountField: { flex: 1, gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: "700" },
  rangeInput: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  rangeActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  rangeButton: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { paddingVertical: spacing.xs },
  row: {
    minHeight: 76,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 4 },
  title: { fontSize: 15, fontWeight: "700" },
  meta: { fontSize: 12 },
  empty: { alignItems: "center", paddingVertical: 48, gap: spacing.sm },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptyText: { fontSize: 13 },
});
