import { Ionicons } from "@expo/vector-icons";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useMemo, useState } from "react";
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
  LoadingState,
  MoneyAmount,
  PageHeader,
} from "@/components/ui";
import { radius, spacing, useAppTheme } from "@/constants/theme";
import { useFinance } from "@/data/finance-context";
import {
  archiveSavingsPlan,
  loadSavingsPlans,
  saveSavingsPlan,
  type SavingsPlan,
} from "@/data/repository";
import { parseMoneyExpression } from "@/domain/money";

type Mode = "ACCOUNTS" | "MANUAL";

export default function SavingsPlansScreen() {
  const colors = useAppTheme();
  const db = useSQLiteContext();
  const { snapshot, error } = useFinance();
  const [plans, setPlans] = useState<SavingsPlan[]>([]);
  const [editing, setEditing] = useState<SavingsPlan | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [mode, setMode] = useState<Mode>("ACCOUNTS");
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [manual, setManual] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const refreshPlans = () => loadSavingsPlans(db).then(setPlans);
  useEffect(() => {
    void refreshPlans();
  }, [db]);

  const activeAccounts = useMemo(
    () =>
      snapshot?.accounts.filter(
        (item) => !item.roles.includes("PRIMARY_SALARY"),
      ) ?? [],
    [snapshot],
  );
  const hidden = !snapshot?.settings.amountsVisible;

  const openEditor = (plan?: SavingsPlan) => {
    const next = plan ?? null;
    setEditing(next);
    setName(next?.name ?? "");
    setTarget(next ? (next.targetMinor / 100).toFixed(2) : "");
    setMode(next?.mode ?? "ACCOUNTS");
    setAccountIds(next?.accountIds ?? []);
    setManual(next ? (next.currentMinor / 100).toFixed(2) : "0");
    setDueDate(next?.dueDate ?? "");
    setNote(next?.note ?? "");
    setShowEditor(true);
  };

  const submit = async () => {
    try {
      setBusy(true);
      await saveSavingsPlan(db, {
        id: editing?.id,
        name,
        targetMinor: Number(parseMoneyExpression(target)),
        mode,
        accountIds,
        manualMinor:
          mode === "MANUAL"
            ? Number(parseMoneyExpression(manual || "0", { zero: true }))
            : 0,
        dueDate: dueDate || undefined,
        note,
      });
      await refreshPlans();
      setShowEditor(false);
      setEditing(null);
    } catch (reason) {
      Alert.alert(
        "计划没有保存",
        reason instanceof Error ? reason.message : "请检查输入",
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = (plan: SavingsPlan) => {
    Alert.alert(
      "删除存钱计划",
      "只删除计划，不会删除账户和交易。确定继续吗？",
      [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: () =>
            void (async () => {
              await archiveSavingsPlan(db, plan.id, true);
              await refreshPlans();
            })(),
        },
      ],
    );
  };

  if (!snapshot)
    return (
      <AppScreen>
        <LoadingState error={error} />
      </AppScreen>
    );

  return (
    <AppScreen>
      <PageHeader
        eyebrow="目标储蓄"
        title="存钱计划"
        subtitle="设定目标后，可用关联账户余额或手动金额计算进度。"
        action={
          <Pressable
            onPress={() => openEditor()}
            style={[styles.add, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addText}>新计划</Text>
          </Pressable>
        }
      />

      <Card style={[styles.infoCard, { backgroundColor: colors.primarySoft }]}>
        <View style={styles.infoTitleRow}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={colors.primary}
          />
          <Text style={[styles.infoTitle, { color: colors.text }]}>
            存钱计划怎么计算？
          </Text>
        </View>
        <Text style={[styles.help, { color: colors.textSecondary }]}>
          关联账户：所选账户的当前余额会计入计划进度。这里只读取余额，不会移动资金或创建交易；关联账户之间转账不会重复累计。
        </Text>
        <Text style={[styles.help, { color: colors.textSecondary }]}>
          手动进度：直接填写“目前已存”，适合没有专用账户的目标；填写进度也不会修改任何账户余额。
        </Text>
      </Card>

      {plans.length ? (
        plans.map((plan) => {
          const complete = plan.currentMinor >= plan.targetMinor;
          return (
            <Card key={plan.id} style={styles.plan}>
              <View style={styles.between}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.planName, { color: colors.text }]}>
                    {plan.name}
                  </Text>
                  <Text style={[styles.help, { color: colors.textSecondary }]}>
                    {plan.mode === "ACCOUNTS"
                      ? "关联：" +
                        (plan.accountNames.join("、") || "未选择账户")
                      : "手动维护进度"}
                    {plan.dueDate ? " · 目标日期 " + plan.dueDate : ""}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.percent,
                    { color: complete ? colors.income : colors.primary },
                  ]}
                >
                  {Math.round(plan.progress * 100)}%
                </Text>
              </View>
              <View
                style={[styles.track, { backgroundColor: colors.surfaceMuted }]}
              >
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${Math.max(2, plan.progress * 100)}%`,
                      backgroundColor: complete
                        ? colors.income
                        : colors.primary,
                    },
                  ]}
                />
              </View>
              <View style={styles.figures}>
                <View>
                  <Text
                    style={[styles.caption, { color: colors.textSecondary }]}
                  >
                    目前
                  </Text>
                  <MoneyAmount
                    value={plan.currentMinor}
                    hidden={hidden}
                    size={18}
                  />
                </View>
                <View>
                  <Text
                    style={[styles.caption, { color: colors.textSecondary }]}
                  >
                    还差
                  </Text>
                  <MoneyAmount
                    value={plan.remainingMinor}
                    hidden={hidden}
                    size={18}
                  />
                </View>
                <View>
                  <Text
                    style={[styles.caption, { color: colors.textSecondary }]}
                  >
                    目标
                  </Text>
                  <MoneyAmount
                    value={plan.targetMinor}
                    hidden={hidden}
                    size={18}
                  />
                </View>
              </View>
              <Text
                style={[
                  styles.encourage,
                  { color: complete ? colors.income : colors.textSecondary },
                ]}
              >
                {complete
                  ? "目标已达成，做得很好。"
                  : plan.progress >= 0.8
                    ? "已经很接近目标，继续保持。"
                    : "每一次积累，都在靠近目标。"}
              </Text>
              {plan.note ? (
                <Text style={[styles.help, { color: colors.textSecondary }]}>
                  {plan.note}
                </Text>
              ) : null}
              <View style={styles.actions}>
                <Pressable
                  onPress={() => openEditor(plan)}
                  style={[styles.secondary, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.text, fontWeight: "800" }}>
                    修改
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => remove(plan)}
                  style={[styles.secondary, { borderColor: colors.expense }]}
                >
                  <Text style={{ color: colors.expense, fontWeight: "800" }}>
                    删除
                  </Text>
                </Pressable>
              </View>
            </Card>
          );
        })
      ) : (
        <Card style={styles.empty}>
          <Ionicons name="flag-outline" size={34} color={colors.primary} />
          <Text style={[styles.planName, { color: colors.text }]}>
            还没有存钱计划
          </Text>
          <Text style={[styles.help, { color: colors.textSecondary }]}>
            例如旅行备用金、应急金或设备购置目标。
          </Text>
        </Card>
      )}

      {showEditor ? (
        <Card style={styles.editor}>
          <View style={styles.between}>
            <Text style={[styles.planName, { color: colors.text }]}>
              {editing ? "修改计划" : "新建计划"}
            </Text>
            <Pressable
              accessibilityLabel="关闭编辑"
              onPress={() => setShowEditor(false)}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>
              计划名称
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="例如：应急储备金"
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.input,
                { color: colors.text, borderColor: colors.border },
              ]}
            />
          </View>
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>
              目标金额（元）
            </Text>
            <TextInput
              value={target}
              onChangeText={setTarget}
              keyboardType="decimal-pad"
              placeholder="例如：10000.00"
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.input,
                { color: colors.text, borderColor: colors.border },
              ]}
            />
            <Text style={[styles.help, { color: colors.textSecondary }]}>
              可输入到角、分；应用会按财务精度保存，不需要输入“整数分”。
            </Text>
          </View>
          <View style={styles.actions}>
            <Pressable
              onPress={() => setMode("ACCOUNTS")}
              style={[
                styles.choice,
                {
                  backgroundColor:
                    mode === "ACCOUNTS" ? colors.primary : colors.surfaceMuted,
                },
              ]}
            >
              <Text
                style={{
                  color: mode === "ACCOUNTS" ? "#fff" : colors.text,
                  fontWeight: "800",
                }}
              >
                关联账户
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode("MANUAL")}
              style={[
                styles.choice,
                {
                  backgroundColor:
                    mode === "MANUAL" ? colors.primary : colors.surfaceMuted,
                },
              ]}
            >
              <Text
                style={{
                  color: mode === "MANUAL" ? "#fff" : colors.text,
                  fontWeight: "800",
                }}
              >
                手动进度
              </Text>
            </Pressable>
          </View>
          {mode === "ACCOUNTS" ? (
            <>
              <Text style={[styles.help, { color: colors.textSecondary }]}>
                可选择多个账户，进度为这些账户当前余额之和。账户之间转账不会重复累计。
              </Text>
              <View style={styles.accountGrid}>
                {activeAccounts.map((account) => {
                  const active = accountIds.includes(account.id);
                  return (
                    <Pressable
                      key={account.id}
                      onPress={() =>
                        setAccountIds((current) =>
                          active
                            ? current.filter((id) => id !== account.id)
                            : [...current, account.id],
                        )
                      }
                      style={[
                        styles.accountChoice,
                        {
                          borderColor: active ? colors.primary : colors.border,
                          backgroundColor: active
                            ? colors.primarySoft
                            : colors.surface,
                        },
                      ]}
                    >
                      <Ionicons
                        name={active ? "checkbox" : "square-outline"}
                        size={19}
                        color={active ? colors.primary : colors.textSecondary}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: "700" }}>
                          {account.name}
                        </Text>
                        <Text
                          style={[
                            styles.accountHint,
                            { color: colors.textSecondary },
                          ]}
                        >
                          当前余额纳入计划进度
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>
                目前已存（元）
              </Text>
              <TextInput
                value={manual}
                onChangeText={setManual}
                keyboardType="decimal-pad"
                placeholder="例如：2500.00"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.border },
                ]}
              />
              <Text style={[styles.help, { color: colors.textSecondary }]}>
                仅更新计划进度，不会更改账户余额。
              </Text>
            </View>
          )}
          <DateField
            optional
            label="目标日期（可选）"
            value={dueDate}
            onChange={setDueDate}
          />
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="备注（可选）"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              { color: colors.text, borderColor: colors.border },
            ]}
          />
          <Pressable
            disabled={busy}
            onPress={() => void submit()}
            style={[
              styles.save,
              { backgroundColor: colors.primary, opacity: busy ? 0.5 : 1 },
            ]}
          >
            <Text style={styles.addText}>{busy ? "保存中…" : "保存计划"}</Text>
          </Pressable>
        </Card>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  infoCard: { gap: spacing.sm },
  infoTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  infoTitle: { fontSize: 15, fontWeight: "900" },
  field: { gap: spacing.xs },
  fieldLabel: { fontSize: 14, fontWeight: "800" },
  accountHint: { fontSize: 11, marginTop: 2 },
  add: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  addText: { color: "#fff", fontWeight: "900" },
  plan: { gap: spacing.md },
  between: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  planName: { fontSize: 18, fontWeight: "900" },
  help: { fontSize: 12, lineHeight: 19 },
  percent: { fontSize: 20, fontWeight: "900" },
  track: { height: 10, borderRadius: 5, overflow: "hidden" },
  fill: { height: 10, borderRadius: 5 },
  figures: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  caption: { fontSize: 11, marginBottom: 4 },
  encourage: { fontSize: 13, fontWeight: "800" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  secondary: {
    minHeight: 42,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  editor: { gap: spacing.md },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 15,
  },
  choice: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  accountGrid: { gap: spacing.sm },
  accountChoice: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  save: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
