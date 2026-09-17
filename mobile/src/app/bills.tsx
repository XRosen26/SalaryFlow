import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  AppScreen,
  Card,
  Divider,
  LoadingState,
  MoneyAmount,
  PageHeader,
  Pill,
  SectionHeader,
} from "@/components/ui";
import { radius, spacing, useAppTheme } from "@/constants/theme";
import { useFinance } from "@/data/finance-context";
import {
  completeBill,
  disableBill,
  loadBillRules,
  loadPendingBills,
  saveBill,
  skipBill,
  type BillOccurrenceItem,
  type BillRuleItem,
} from "@/data/repository";
import { today } from "@/domain/dates";
import { parseMoneyExpression } from "@/domain/money";

function Choice({
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
        styles.choice,
        {
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? colors.primarySoft : colors.surface,
        },
      ]}
    >
      <Text
        style={{
          color: active ? colors.primary : colors.text,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function scheduleText(rule: BillRuleItem) {
  if (rule.frequency === "MONTHLY") return "每月 " + rule.day + " 日";
  const names = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  return "每周 " + names[rule.day];
}

export default function BillsScreen() {
  const colors = useAppTheme();
  const db = useSQLiteContext();
  const { snapshot, error, refresh } = useFinance();
  const [rows, setRows] = useState<BillOccurrenceItem[]>([]);
  const [rules, setRules] = useState<BillRuleItem[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BillRuleItem | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<"MONTHLY" | "WEEKLY">("MONTHLY");
  const [day, setDay] = useState("1");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    try {
      const [nextRows, nextRules] = await Promise.all([
        loadPendingBills(db),
        loadBillRules(db),
      ]);
      setRows(nextRows);
      setRules(nextRules);
    } catch (reason) {
      Alert.alert(
        "读取账单失败",
        reason instanceof Error ? reason.message : "请重试",
      );
    }
  };

  useEffect(() => {
    void reload();
  }, [db]);

  useEffect(() => {
    if (!snapshot) return;
    setAccountId(
      (current) =>
        current ||
        snapshot.accounts.find((account) =>
          account.roles.includes("PRIMARY_SPENDING"),
        )?.id ||
        snapshot.accounts[0]?.id ||
        "",
    );
    setCategoryId(
      (current) =>
        current ||
        snapshot.categories.find((category) => category.kind === "EXPENSE")
          ?.id ||
        "",
    );
  }, [snapshot]);

  if (!snapshot)
    return (
      <AppScreen>
        <LoadingState error={error} />
      </AppScreen>
    );

  const hidden = !snapshot.settings.amountsVisible;
  const defaultAccount =
    snapshot.accounts.find((account) =>
      account.roles.includes("PRIMARY_SPENDING"),
    )?.id ||
    snapshot.accounts[0]?.id ||
    "";
  const defaultCategory =
    snapshot.categories.find((category) => category.kind === "EXPENSE")?.id ||
    "";

  const resetForm = () => {
    setEditing(null);
    setName("");
    setAmount("");
    setFrequency("MONTHLY");
    setDay("1");
    setAccountId(defaultAccount);
    setCategoryId(defaultCategory);
  };

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (rule: BillRuleItem) => {
    setEditing(rule);
    setName(rule.name);
    setAmount((rule.amountMinor / 100).toFixed(2));
    setFrequency(rule.frequency);
    setDay(String(rule.day));
    setAccountId(rule.accountId);
    setCategoryId(rule.categoryId);
    setFormOpen(true);
  };

  const closeForm = () => {
    resetForm();
    setFormOpen(false);
  };

  const save = async () => {
    try {
      setBusy(true);
      await saveBill(db, {
        id: editing?.id,
        revision: editing?.revision,
        name,
        amountMinor: Number(parseMoneyExpression(amount)),
        accountId,
        categoryId,
        frequency,
        day: Number(day),
      });
      closeForm();
      await reload();
      Alert.alert(
        editing ? "固定账单已更新" : "固定账单已创建",
        editing
          ? "未确认的本期待办和后续账单已按新规则更新；已支付历史和真实交易保持不变。"
          : "已生成下一次到期待办；确认支付后才会记为真实支出。",
      );
    } catch (reason) {
      Alert.alert(
        editing ? "无法保存修改" : "无法创建",
        reason instanceof Error ? reason.message : "请检查输入",
      );
    } finally {
      setBusy(false);
    }
  };

  const removeRule = (rule: BillRuleItem) =>
    Alert.alert(
      "删除固定账单规则？",
      "将停止后续提醒，并取消当前未确认待办。已支付历史和已经生成的真实交易会保留。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "确认删除",
          style: "destructive",
          onPress: async () => {
            try {
              setBusy(true);
              await disableBill(db, rule.id, rule.revision);
              if (editing?.id === rule.id) closeForm();
              await reload();
              Alert.alert("规则已删除", "历史账单和真实交易仍可继续查看。");
            } catch (reason) {
              Alert.alert(
                "无法删除",
                reason instanceof Error ? reason.message : "请重试",
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );

  const pay = (row: BillOccurrenceItem) =>
    Alert.alert(
      "确认已经支付？",
      "将以今天 " +
        today() +
        " 为实际发生日期，从“" +
        row.accountName +
        "”记录支出。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "确认支付",
          onPress: async () => {
            try {
              setBusy(true);
              await completeBill(db, row.id, today());
              await refresh();
              await reload();
            } catch (reason) {
              Alert.alert(
                "无法确认",
                reason instanceof Error ? reason.message : "请重试",
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );

  const skip = (row: BillOccurrenceItem) =>
    Alert.alert("跳过本期？", "本期不会生成支出，系统会建立下一期账单待办。", [
      { text: "取消", style: "cancel" },
      {
        text: "跳过",
        onPress: async () => {
          try {
            setBusy(true);
            await skipBill(db, row.id);
            await reload();
          } catch (reason) {
            Alert.alert(
              "无法跳过",
              reason instanceof Error ? reason.message : "请重试",
            );
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  return (
    <AppScreen>
      <PageHeader
        title="固定账单"
        subtitle="管理重复规则；账单到期先提醒，确认实际支付后才计入支出。"
        action={
          <Pressable onPress={formOpen ? closeForm : openCreate}>
            <Pill text={formOpen ? "收起" : "＋ 新增"} />
          </Pressable>
        }
      />

      {formOpen ? (
        <Card style={styles.card}>
          <Text style={[styles.title, { color: colors.text }]}>
            {editing ? "修改固定账单" : "新增固定账单"}
          </Text>
          {editing ? (
            <Text style={[styles.notice, { color: colors.textSecondary }]}>
              修改会同步更新当前未确认待办及后续计划，不会改写已支付历史。
            </Text>
          ) : null}
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="名称，例如：房租"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              { color: colors.text, borderColor: colors.border },
            ]}
          />
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="金额，可输入算式"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              { color: colors.text, borderColor: colors.border },
            ]}
          />
          <Text style={[styles.label, { color: colors.text }]}>重复方式</Text>
          <View style={styles.wrap}>
            <Choice
              label="每月"
              active={frequency === "MONTHLY"}
              onPress={() => setFrequency("MONTHLY")}
            />
            <Choice
              label="每周"
              active={frequency === "WEEKLY"}
              onPress={() => setFrequency("WEEKLY")}
            />
          </View>
          <TextInput
            value={day}
            onChangeText={setDay}
            keyboardType="number-pad"
            placeholder={
              frequency === "MONTHLY"
                ? "每月几日（1—31）"
                : "星期几（1=周一，7=周日）"
            }
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              { color: colors.text, borderColor: colors.border },
            ]}
          />
          <Text style={[styles.label, { color: colors.text }]}>付款账户</Text>
          <View style={styles.wrap}>
            {snapshot.accounts.map((account) => (
              <Choice
                key={account.id}
                label={account.name}
                active={account.id === accountId}
                onPress={() => setAccountId(account.id)}
              />
            ))}
          </View>
          <Text style={[styles.label, { color: colors.text }]}>支出分类</Text>
          <View style={styles.wrap}>
            {snapshot.categories
              .filter((category) => category.kind === "EXPENSE")
              .map((category) => (
                <Choice
                  key={category.id}
                  label={category.name}
                  active={category.id === categoryId}
                  onPress={() => setCategoryId(category.id)}
                />
              ))}
          </View>
          <Pressable
            disabled={busy}
            onPress={() => void save()}
            style={[
              styles.save,
              { backgroundColor: colors.primary, opacity: busy ? 0.5 : 1 },
            ]}
          >
            <Text style={styles.saveText}>
              {editing ? "保存修改" : "保存固定账单"}
            </Text>
          </Pressable>
        </Card>
      ) : null}

      <SectionHeader title="固定账单规则" />
      <Card style={styles.list}>
        {rules.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            暂时没有固定账单规则。点击“新增”创建重复提醒。
          </Text>
        ) : (
          rules.map((rule, index) => (
            <View key={rule.id}>
              {index ? <Divider /> : null}
              <View style={styles.rule}>
                <View style={styles.billTop}>
                  <View style={styles.flexText}>
                    <Text style={[styles.title, { color: colors.text }]}>
                      {rule.name}
                    </Text>
                    <Text
                      style={[styles.meta, { color: colors.textSecondary }]}
                    >
                      {scheduleText(rule)} · {rule.accountName} ·{" "}
                      {rule.categoryName}
                    </Text>
                  </View>
                  <MoneyAmount
                    value={rule.amountMinor}
                    hidden={hidden}
                    size={17}
                  />
                </View>
                <View style={styles.actions}>
                  <Pressable
                    disabled={busy}
                    onPress={() => openEdit(rule)}
                    style={[styles.secondary, { borderColor: colors.border }]}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700" }}>
                      修改
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={() => removeRule(rule)}
                    style={[styles.secondary, { borderColor: colors.expense }]}
                  >
                    <Text style={{ color: colors.expense, fontWeight: "700" }}>
                      删除
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))
        )}
      </Card>

      <SectionHeader title="待确认账单" />
      <Card style={styles.list}>
        {rows.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            暂时没有待确认账单。
          </Text>
        ) : (
          rows.map((row, index) => (
            <View key={row.id}>
              {index ? <Divider /> : null}
              <View style={styles.bill}>
                <View style={styles.billTop}>
                  <View style={styles.flexText}>
                    <Text style={[styles.title, { color: colors.text }]}>
                      {row.name}
                    </Text>
                    <Text
                      style={[styles.meta, { color: colors.textSecondary }]}
                    >
                      {row.dueDate} 到期 · {row.accountName} ·{" "}
                      {row.categoryName}
                    </Text>
                  </View>
                  <MoneyAmount
                    value={row.amountMinor}
                    hidden={hidden}
                    size={17}
                  />
                </View>
                <View style={styles.actions}>
                  <Pressable
                    disabled={busy}
                    onPress={() => skip(row)}
                    style={[styles.secondary, { borderColor: colors.border }]}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700" }}>
                      跳过
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={() => pay(row)}
                    style={[
                      styles.confirm,
                      {
                        backgroundColor: colors.primary,
                        opacity: busy ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Text style={styles.saveText}>确认已支付</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))
        )}
      </Card>
      <Text style={[styles.empty, { color: colors.textSecondary }]}>
        未确认的账单只是待办，不影响账户余额、预算或统计。
      </Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  title: { fontSize: 16, fontWeight: "900" },
  notice: { fontSize: 13, lineHeight: 20 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 15,
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  choice: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
  },
  label: { fontSize: 14, fontWeight: "800" },
  save: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: "#fff", fontWeight: "900" },
  list: { paddingVertical: 0 },
  rule: { padding: spacing.lg, gap: spacing.md },
  bill: { padding: spacing.lg, gap: spacing.md },
  billTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  flexText: { flex: 1, gap: 3 },
  meta: { fontSize: 12, lineHeight: 18 },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  secondary: {
    minHeight: 42,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.md,
    justifyContent: "center",
  },
  confirm: {
    minHeight: 42,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    justifyContent: "center",
  },
  empty: {
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
