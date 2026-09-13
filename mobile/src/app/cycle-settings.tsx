import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { DateField } from "@/components/date-field";
import { AppScreen, Card, LoadingState, PageHeader } from "@/components/ui";
import { radius, spacing, useAppTheme } from "@/constants/theme";
import { useFinance } from "@/data/finance-context";
import {
  scheduleCycleRule,
  type BudgetBasis,
  type CycleRuleInput,
} from "@/data/repository";
import { normalizeDateInput, today } from "@/domain/dates";

type Mode = CycleRuleInput["effectiveMode"];
function Choice({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const c = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.choice,
        {
          borderColor: active ? c.primary : c.border,
          backgroundColor: active ? c.primarySoft : c.surface,
        },
      ]}
    >
      <Text style={{ color: active ? c.primary : c.text, fontWeight: "800" }}>
        {label}
      </Text>
    </Pressable>
  );
}
export default function CycleSettingsScreen() {
  const colors = useAppTheme();
  const router = useRouter();
  const db = useSQLiteContext();
  const { snapshot, error, refresh } = useFinance();
  const [basis, setBasis] = useState<BudgetBasis>(
    snapshot?.settings.budgetBasis ?? "SALARY",
  );
  const [payday, setPayday] = useState(String(snapshot?.settings.payday ?? 10));
  const [mode, setMode] = useState<Mode>("NEXT_CYCLE");
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  if (!snapshot)
    return (
      <AppScreen>
        <LoadingState error={error} />
      </AppScreen>
    );
  const save = async () => {
    try {
      setBusy(true);
      const effective = await scheduleCycleRule(db, {
        basis,
        payday: Number(payday),
        effectiveMode: mode,
        specifiedDate:
          mode === "SPECIFIED" ? normalizeDateInput(date) : undefined,
      });
      await refresh();
      Alert.alert(
        "周期规则已保存",
        `${effective} 起按${basis === "SALARY" ? `每月 ${payday} 日发薪周期` : "自然月"}计算。历史交易不会复制；每笔交易按实际发生日期归入对应周期。`,
        [{ text: "完成", onPress: () => router.back() }],
      );
    } catch (e) {
      Alert.alert("无法保存", e instanceof Error ? e.message : "请检查输入");
    } finally {
      setBusy(false);
    }
  };
  return (
    <AppScreen>
      <PageHeader
        title="预算周期规则"
        subtitle="预算按工资周期或自然月管理；统计仍按交易实际日期动态计算。"
      />
      <Card style={styles.card}>
        <Text style={[styles.title, { color: colors.text }]}>预算计算口径</Text>
        <View style={styles.wrap}>
          <Choice
            label="按工资周期"
            active={basis === "SALARY"}
            onPress={() => setBasis("SALARY")}
          />
          <Choice
            label="按自然月"
            active={basis === "CALENDAR_MONTH"}
            onPress={() => setBasis("CALENDAR_MONTH")}
          />
        </View>
        <Text style={[styles.help, { color: colors.textSecondary }]}>
          工资周期适合发薪后统一分配；自然月适合固定按月复盘。统计分析不受此选择限制。
        </Text>
        {basis === "SALARY" ? (
          <>
            <Text style={[styles.title, { color: colors.text }]}>
              每月发薪日
            </Text>
            <TextInput
              value={payday}
              onChangeText={setPayday}
              keyboardType="number-pad"
              placeholder="1—31"
              style={[
                styles.input,
                { color: colors.text, borderColor: colors.border },
              ]}
            />
            <Text style={[styles.help, { color: colors.textSecondary }]}>
              短月份自动使用当月最后一天。
            </Text>
          </>
        ) : null}
      </Card>
      <Card style={styles.card}>
        <Text style={[styles.title, { color: colors.text }]}>何时生效</Text>
        <View style={styles.stack}>
          <Choice
            label="下个周期起生效（推荐）"
            active={mode === "NEXT_CYCLE"}
            onPress={() => setMode("NEXT_CYCLE")}
          />
          <Choice
            label="立即生效"
            active={mode === "IMMEDIATE"}
            onPress={() => setMode("IMMEDIATE")}
          />
          <Choice
            label="指定日期起生效"
            active={mode === "SPECIFIED"}
            onPress={() => setMode("SPECIFIED")}
          />
        </View>
        {mode === "SPECIFIED" ? (
          <DateField label="生效日期" value={date} onChange={setDate} />
        ) : null}
        <Text style={[styles.help, { color: colors.textSecondary }]}>
          立即或周期中途指定日期会形成一个过渡周期，避免重写已经发生的历史交易。
        </Text>
      </Card>
      <Pressable
        disabled={busy}
        onPress={() => void save()}
        style={[
          styles.save,
          { backgroundColor: colors.primary, opacity: busy ? 0.5 : 1 },
        ]}
      >
        <Text style={styles.saveText}>
          {busy ? "正在保存…" : "保存周期规则"}
        </Text>
      </Pressable>
    </AppScreen>
  );
}
const styles = StyleSheet.create({
  card: { gap: spacing.md },
  title: { fontSize: 15, fontWeight: "800" },
  help: { fontSize: 12, lineHeight: 19 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  stack: { gap: spacing.sm },
  choice: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 15,
  },
  save: {
    minHeight: 54,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: "#fff", fontWeight: "900" },
});
