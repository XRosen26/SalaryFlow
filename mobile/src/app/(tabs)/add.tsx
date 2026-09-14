import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { DateField } from "@/components/date-field";
import { AppScreen, Card, LoadingState, PageHeader } from "@/components/ui";
import { radius, spacing, useAppTheme } from "@/constants/theme";
import { useFinance } from "@/data/finance-context";
import type { TransactionKind } from "@/data/repository";
import { normalizeDateInput, today } from "@/domain/dates";
import {
  formatMoney,
  isMoneyExpression,
  parseMoneyExpression,
} from "@/domain/money";

type EntryKind = Exclude<TransactionKind, "REFUND">;
const kinds: {
  id: EntryKind;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: "EXPENSE", label: "支出", icon: "arrow-up-outline" },
  { id: "INCOME", label: "收入", icon: "arrow-down-outline" },
  { id: "TRANSFER", label: "转账", icon: "swap-horizontal-outline" },
];

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useAppTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text
        style={[styles.chipText, { color: selected ? "#FFFFFF" : colors.text }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function categoryIcon(
  name: string,
  group: string,
): keyof typeof Ionicons.glyphMap {
  const value = `${group}/${name}`;
  if (/工资|收入/.test(value)) return "cash-outline";
  if (/理财|投资/.test(value)) return "trending-up-outline";
  if (/房租|住房/.test(value)) return "home-outline";
  if (/餐|菜|外卖/.test(value)) return "restaurant-outline";
  if (/交通|通勤/.test(value)) return "bus-outline";
  if (/日用|购物/.test(value)) return "bag-handle-outline";
  if (/聚餐|社交|娱乐/.test(value)) return "people-outline";
  if (/课程|学习|成长/.test(value)) return "book-outline";
  if (/医疗|备用/.test(value)) return "medkit-outline";
  return "pricetag-outline";
}

function CategoryTile({
  name,
  group,
  selected,
  onPress,
}: {
  name: string;
  group: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useAppTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${group}，${name}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.categoryTile,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.categoryIcon,
          {
            backgroundColor: selected
              ? "rgba(255,255,255,0.18)"
              : colors.primarySoft,
          },
        ]}
      >
        <Ionicons
          name={categoryIcon(name, group)}
          size={20}
          color={selected ? "#FFFFFF" : colors.primary}
        />
      </View>
      <Text
        numberOfLines={2}
        style={[
          styles.categoryName,
          { color: selected ? "#FFFFFF" : colors.text },
        ]}
      >
        {name}
      </Text>
      {selected ? (
        <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
      ) : null}
    </Pressable>
  );
}
export default function AddScreen() {
  const colors = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string; id?: string }>();
  const { snapshot, error, addTransaction, editTransaction } = useFinance();
  const amountRef = useRef<TextInput>(null);
  const initializedEdit = useRef(false);
  const initialKind = kinds.some((item) => item.id === params.kind)
    ? (params.kind as EntryKind)
    : "EXPENSE";
  const [kind, setKind] = useState<EntryKind>(initialKind);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [sourceId, setSourceId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [note, setNote] = useState("");
  const [salary, setSalary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<"category" | "source" | "destination" | null>(null);

  useEffect(() => {
    if (kinds.some((item) => item.id === params.kind))
      setKind(params.kind as EntryKind);
  }, [params.kind]);

  useEffect(() => {
    if (!snapshot || params.id) return;
    const spending =
      snapshot.accounts.find((account) =>
        account.roles.includes("PRIMARY_SPENDING"),
      )?.id ??
      snapshot.accounts[0]?.id ??
      "";
    const salaryAccount =
      snapshot.accounts.find((account) =>
        account.roles.includes("PRIMARY_SALARY"),
      )?.id ??
      snapshot.accounts[0]?.id ??
      "";
    setSourceId(
      (current) => current || (kind === "TRANSFER" ? salaryAccount : spending),
    );
    setDestinationId(
      (current) => current || (kind === "TRANSFER" ? spending : salaryAccount),
    );
    setCategoryId("");
  }, [kind, params.id, snapshot]);

  useEffect(() => {
    if (!snapshot || !params.id || initializedEdit.current) return;
    const item = snapshot.transactions.find(
      (transaction) => transaction.id === params.id,
    );
    if (!item || !["INCOME", "EXPENSE", "TRANSFER"].includes(item.kind)) return;
    initializedEdit.current = true;
    setKind(item.kind as EntryKind);
    setAmount((item.amountMinor / 100).toFixed(2));
    setDate(item.date);
    setSourceId(item.sourceId ?? "");
    setDestinationId(item.destinationId ?? "");
    setCategoryId(item.categoryId ?? "");
    setNote(item.note);
    setSalary(item.salary);
  }, [params.id, snapshot]);
  const preview = useMemo(() => {
    if (!amount.trim())
      return { value: null as number | null, error: null as string | null };
    try {
      return { value: Number(parseMoneyExpression(amount)), error: null };
    } catch (reason) {
      return {
        value: null,
        error: reason instanceof Error ? reason.message : "金额无效",
      };
    }
  }, [amount]);

  if (!snapshot)
    return (
      <AppScreen>
        <LoadingState error={error} />
      </AppScreen>
    );
  const categories = snapshot.categories.filter(
    (category) => category.kind === (kind === "INCOME" ? "INCOME" : "EXPENSE"),
  );
  const categoryGroups = categories.reduce<Record<string, typeof categories>>(
    (groups, category) => {
      (groups[category.groupName] ??= []).push(category);
      return groups;
    },
    {},
  );
  const selectedCategory = categories.find((item) => item.id === categoryId);
  const selectedSource = snapshot.accounts.find((item) => item.id === sourceId);
  const selectedDestination = snapshot.accounts.find((item) => item.id === destinationId);

  const changeKind = (next: EntryKind) => {
    setKind(next);
    setAmount("");
    setNote("");
    setSalary(false);
    const spending =
      snapshot.accounts.find((account) =>
        account.roles.includes("PRIMARY_SPENDING"),
      )?.id ??
      snapshot.accounts[0]?.id ??
      "";
    const salaryAccount =
      snapshot.accounts.find((account) =>
        account.roles.includes("PRIMARY_SALARY"),
      )?.id ??
      snapshot.accounts[0]?.id ??
      "";
    setSourceId(next === "TRANSFER" ? salaryAccount : spending);
    setDestinationId(next === "TRANSFER" ? spending : salaryAccount);
    setCategoryId("");
  };

  const appendOperator = (operator: string) => {
    setAmount((current) => current + operator);
    amountRef.current?.focus();
  };

  const save = async () => {
    try {
      const amountMinor = Number(parseMoneyExpression(amount));
      const normalizedDate = normalizeDateInput(date);
      setDate(normalizedDate);
      setSaving(true);
      const payload = {
        kind,
        amountMinor,
        date: normalizedDate,
        sourceId: kind === "INCOME" ? undefined : sourceId,
        destinationId: kind === "EXPENSE" ? undefined : destinationId,
        categoryId: kind === "TRANSFER" ? undefined : categoryId,
        salary: kind === "INCOME" && salary,
        note,
      };
      if (params.id) await editTransaction({ ...payload, id: params.id });
      else await addTransaction(payload);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAmount("");
      setNote("");
      Alert.alert(
        params.id ? "修改已保存" : "已保存",
        params.id
          ? "账户余额、预算和统计已重新计算。"
          : kind === "INCOME" && salary
            ? "工资已到账。现在可以继续制定工资分配计划。"
            : "账户余额、预算和统计已更新。",
        [
          ...(params.id
            ? []
            : [
                {
                  text: "继续记账",
                  style: "cancel" as const,
                  onPress: () => amountRef.current?.focus(),
                },
              ]),
          {
            text: "查看明细",
            onPress: () => router.replace("/transactions" as never),
          },
        ],
      );
    } catch (reason) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "暂时无法保存",
        reason instanceof Error ? reason.message : "请检查输入",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <AppScreen>
        <PageHeader
          title={params.id ? "修改交易" : "记一笔"}
          subtitle={
            params.id
              ? "保存后会重新计算账户余额、预算与统计。"
              : "先选类型和分类，再填写金额、账户与实际发生日期。"
          }
        />
        <View
          accessibilityRole="radiogroup"
          style={[styles.segment, { backgroundColor: colors.surfaceMuted }]}
        >
          {kinds.map((item) => {
            const active = kind === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                disabled={Boolean(params.id)}
                onPress={() => changeKind(item.id)}
                style={[
                  styles.segmentItem,
                  active && { backgroundColor: colors.surface },
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={active ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.segmentText,
                    { color: active ? colors.text : colors.textSecondary },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
          {!params.id ? (
            <Pressable accessibilityRole="button" accessibilityLabel="新增待收款"
              onPress={() => router.push("/receivables?create=1" as never)} style={styles.segmentItem}>
              <Ionicons name="cash-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.segmentText, { color: colors.textSecondary }]}>待收款</Text>
            </Pressable>
          ) : null}
        </View>

        {kind !== "TRANSFER" ? (
          <View style={styles.field}>
            <View style={styles.categoryHeader}>
              <View style={styles.categoryHeaderText}>
                <Text style={[styles.fieldTitle, { color: colors.text }]}>分类</Text>
                <Text style={[styles.categoryHint, { color: colors.textSecondary }]}>先选分类，选中后自动收起，再填写金额。</Text>
              </View>
              <Pressable onPress={() => router.push("/categories" as never)} hitSlop={8}>
                <Text style={[styles.manageCategories, { color: colors.primary }]}>管理分类 ›</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => setPicker("category")}
              style={[styles.selector, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.categoryIcon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name={categoryIcon(selectedCategory?.name ?? "", selectedCategory?.groupName ?? "")} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.selectorValue, { color: colors.text }]}>{selectedCategory?.name ?? "选择分类"}</Text>
                <Text style={[styles.selectorMeta, { color: colors.textSecondary }]}>{selectedCategory?.groupName ?? "点击展开全部分类"}</Text>
              </View>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        ) : (
          <View style={[styles.notice, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
            <Text style={[styles.noticeText, { color: colors.text }]}>转账只移动账户资金，不计作收入、支出或储蓄。</Text>
          </View>
        )}

        <Card style={styles.amountCard}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {kind === "TRANSFER"
              ? "转账金额"
              : kind === "INCOME"
                ? "收入金额"
                : "支出金额"}
          </Text>
          <View style={styles.amountRow}>
            <Text style={[styles.currency, { color: colors.text }]}>¥</Text>
            <TextInput
              ref={amountRef}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              style={[styles.amountInput, { color: colors.text }]}
              accessibilityLabel="金额，可输入算式"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
          </View>
          <View style={styles.operators}>
            {["+", "−", "×", "÷", "(", ")"].map((operator) => (
              <Pressable
                key={operator}
                accessibilityRole="button"
                accessibilityLabel={`输入${operator}`}
                onPress={() => appendOperator(operator)}
                style={[
                  styles.operator,
                  { backgroundColor: colors.surfaceMuted },
                ]}
              >
                <Text style={[styles.operatorText, { color: colors.text }]}>
                  {operator}
                </Text>
              </Pressable>
            ))}
          </View>
          {preview.value !== null ? (
            <Text style={[styles.preview, { color: colors.primary }]}>
              {isMoneyExpression(amount)
                ? `计算结果：${formatMoney(preview.value)}`
                : "金额格式正确"}
            </Text>
          ) : amount ? (
            <Text style={[styles.preview, { color: colors.expense }]}>
              {preview.error}
            </Text>
          ) : (
            <Text style={[styles.preview, { color: colors.textSecondary }]}>
              支持 +、−、×、÷ 和括号，最终结果四舍五入到分。
            </Text>
          )}
        </Card>

        {kind !== "INCOME" ? (
          <View style={styles.field}>
            <Text style={[styles.fieldTitle, { color: colors.text }]}>付款账户</Text>
            <Pressable onPress={() => setPicker("source")}
              style={[styles.selector, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="wallet-outline" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.selectorValue, { color: colors.text }]}>{selectedSource?.name ?? "选择付款账户"}</Text>
                <Text style={[styles.selectorMeta, { color: colors.textSecondary }]}>点击更换账户</Text>
              </View>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        ) : null}

        {kind !== "EXPENSE" ? (
          <View style={styles.field}>
            <Text style={[styles.fieldTitle, { color: colors.text }]}>{kind === "INCOME" ? "收款账户" : "转入账户"}</Text>
            <Pressable onPress={() => setPicker("destination")}
              style={[styles.selector, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="wallet-outline" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.selectorValue, { color: colors.text }]}>{selectedDestination?.name ?? "选择收款账户"}</Text>
                <Text style={[styles.selectorMeta, { color: colors.textSecondary }]}>点击更换账户</Text>
              </View>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        ) : null}

        {kind === "INCOME" ? (
          <View style={[styles.switchRow, { borderColor: colors.border }]}>
            <View style={styles.switchText}>
              <Text style={[styles.fieldTitle, { color: colors.text }]}>
                这是工资
              </Text>
              <Text style={[styles.help, { color: colors.textSecondary }]}>
                保存后可继续使用工资分配助手
              </Text>
            </View>
            <Switch
              value={salary}
              onValueChange={setSalary}
              trackColor={{ true: colors.primary }}
            />
          </View>
        ) : null}

        <DateField label="实际发生日期" value={date} onChange={setDate} />

        <View style={styles.field}>
          <Text style={[styles.fieldTitle, { color: colors.text }]}>
            备注（可选）
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="例如：周末采购"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.textInput,
              {
                color: colors.text,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          />
        </View>

        <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
          <Pressable style={styles.pickerBackdrop} onPress={() => setPicker(null)}>
            <Pressable style={[styles.pickerSheet, { backgroundColor: colors.background }]} onPress={(event) => event.stopPropagation()}>
              <View style={styles.pickerHead}>
                <View>
                  <Text style={[styles.pickerTitle, { color: colors.text }]}>{picker === "category" ? "选择分类" : picker === "source" ? "选择付款账户" : "选择收款账户"}</Text>
                  <Text style={[styles.pickerHint, { color: colors.textSecondary }]}>选择后将自动返回记账表单</Text>
                </View>
                <Pressable onPress={() => setPicker(null)} hitSlop={10}><Ionicons name="close" size={24} color={colors.textSecondary} /></Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.pickerContent} keyboardShouldPersistTaps="handled">
                {picker === "category" ? Object.entries(categoryGroups).map(([group, items]) => (
                  <View key={group} style={styles.categoryGroup}>
                    <Text style={[styles.categoryGroupName, { color: colors.textSecondary }]}>{group}</Text>
                    <View style={styles.categoryGrid}>{items.map((category) => (
                      <CategoryTile key={category.id} name={category.name} group={category.groupName}
                        selected={categoryId === category.id} onPress={() => { setCategoryId(category.id); setPicker(null); setTimeout(() => amountRef.current?.focus(), 250); }} />
                    ))}</View>
                  </View>
                )) : snapshot.accounts.filter((account) => picker !== "destination" || account.id !== sourceId).map((account) => {
                  const selected = picker === "source" ? sourceId === account.id : destinationId === account.id;
                  return <Pressable key={account.id} onPress={() => {
                    if (picker === "source") setSourceId(account.id); else setDestinationId(account.id);
                    setPicker(null);
                  }} style={[styles.accountOption, { backgroundColor: selected ? colors.primarySoft : colors.surface, borderColor: selected ? colors.primary : colors.border }]}>
                    <Ionicons name="wallet-outline" size={21} color={colors.primary} />
                    <Text style={[styles.accountOptionText, { color: colors.text }]}>{account.name}</Text>
                    {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
                  </Pressable>;
                })}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => void save()}
          style={({ pressed }) => [
            styles.save,
            {
              backgroundColor: colors.primary,
              opacity: saving ? 0.5 : pressed ? 0.75 : 1,
            },
          ]}
        >
          <Ionicons
            name={saving ? "hourglass-outline" : "checkmark"}
            size={22}
            color="#FFFFFF"
          />
          <Text style={styles.saveText}>
            {saving
              ? "正在保存…"
              : `保存${kinds.find((item) => item.id === kind)?.label}`}
          </Text>
        </Pressable>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  segment: { flexDirection: "row", borderRadius: radius.md, padding: 4 },
  segmentItem: {
    flex: 1,
    minHeight: 44,
    borderRadius: 9,
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: { fontSize: 14, fontWeight: "800" },
  amountCard: { gap: spacing.md },
  label: { fontSize: 13, fontWeight: "700" },
  amountRow: { flexDirection: "row", alignItems: "baseline" },
  currency: { fontSize: 24, fontWeight: "600", marginRight: spacing.sm },
  amountInput: {
    flex: 1,
    fontSize: 40,
    fontWeight: "800",
    paddingVertical: spacing.sm,
    fontVariant: ["tabular-nums"],
  },
  operators: { flexDirection: "row", gap: spacing.sm },
  operator: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  operatorText: { fontSize: 18, fontWeight: "700" },
  preview: { fontSize: 12, lineHeight: 18 },
  field: { gap: spacing.sm },
  fieldTitle: { fontSize: 15, fontWeight: "800" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  selector: { minHeight: 64, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md },
  selectorValue: { fontSize: 15, fontWeight: "800" },
  selectorMeta: { fontSize: 11, marginTop: 3 },
  pickerBackdrop: { flex: 1, backgroundColor: "rgba(9,18,25,0.55)", justifyContent: "flex-end" },
  pickerSheet: { maxHeight: "78%", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: 24 },
  pickerHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.md },
  pickerTitle: { fontSize: 20, fontWeight: "900" },
  pickerHint: { fontSize: 12, marginTop: 4 },
  pickerContent: { gap: spacing.lg, paddingBottom: 36 },
  accountOption: { minHeight: 56, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  accountOptionText: { flex: 1, fontSize: 15, fontWeight: "800" },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  categoryHeaderText: { flex: 1, gap: 3 },
  categoryHint: { fontSize: 11, lineHeight: 17 },
  manageCategories: { fontSize: 13, fontWeight: "800", paddingVertical: 2 },
  categoryGroup: { gap: spacing.sm },
  categoryGroupName: { fontSize: 12, fontWeight: "800", letterSpacing: 0.6 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  categoryTile: {
    width: "48%",
    minHeight: 64,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryName: { flex: 1, fontSize: 13, lineHeight: 17, fontWeight: "800" },
  chip: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    borderRadius: 21,
    borderWidth: 1,
    justifyContent: "center",
  },
  chipText: { fontSize: 13, fontWeight: "700" },
  notice: {
    flexDirection: "row",
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
    alignItems: "center",
  },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  switchRow: {
    minHeight: 64,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  switchText: { flex: 1, gap: 3 },
  help: { fontSize: 12 },
  textInput: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 15,
  },
  save: {
    minHeight: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  saveText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
});
