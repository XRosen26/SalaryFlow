import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
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
import { setAccountValuation } from "@/data/repository";
import { normalizeDateInput, today } from "@/domain/dates";
import { parseMoneyExpression } from "@/domain/money";
export default function ValuationScreen() {
  const c = useAppTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const { accountId } = useLocalSearchParams<{ accountId: string }>();
  const { snapshot, error, refresh } = useFinance();
  const account = snapshot?.accounts.find((a) => a.id === accountId);
  const [value, setValue] = useState(
    account ? (account.balanceMinor / 100).toFixed(2) : "",
  );
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (!snapshot)
    return (
      <AppScreen>
        <LoadingState error={error} />
      </AppScreen>
    );
  if (!account || !account.valuationMode)
    return (
      <AppScreen>
        <PageHeader title="账户不可估值" />
      </AppScreen>
    );
  const save = async () => {
    try {
      setBusy(true);
      await setAccountValuation(
        db,
        account.id,
        Number(parseMoneyExpression(value)),
        normalizeDateInput(date),
        note,
      );
      await refresh();
      Alert.alert("市值已更新", "市值变化计入总资产，但不会计作收入或支出。", [
        { text: "完成", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("无法更新", e instanceof Error ? e.message : "请检查输入");
    } finally {
      setBusy(false);
    }
  };
  return (
    <AppScreen>
      <PageHeader title="更新理财市值" subtitle={account.name} />
      <Card style={styles.card}>
        <Text style={[styles.help, { color: c.textSecondary }]}>
          当前账面价值
        </Text>
        <MoneyAmount
          value={account.balanceMinor}
          hidden={!snapshot.settings.amountsVisible}
          size={28}
        />
        <Text style={[styles.label, { color: c.text }]}>最新总市值</Text>
        <TextInput
          value={value}
          onChangeText={setValue}
          keyboardType="decimal-pad"
          placeholder="可输入 + − × ÷"
          style={[styles.input, { color: c.text, borderColor: c.border }]}
        />
        <DateField label="估值日期" value={date} onChange={setDate} />
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="备注，例如：基金收盘市值"
          style={[styles.input, { color: c.text, borderColor: c.border }]}
        />
        <Text style={[styles.help, { color: c.textSecondary }]}>
          同一天重复更新会修订该日快照并保留审计历史。估值只替换资产价值，转入转出仍保存为资金移动。同日有转入或转出时，请在最后一笔资金移动完成后再更新市值。
        </Text>
        <Pressable
          disabled={busy}
          onPress={() => void save()}
          style={[
            styles.save,
            { backgroundColor: c.primary, opacity: busy ? 0.5 : 1 },
          ]}
        >
          <Text style={styles.saveText}>
            {busy ? "正在保存…" : "保存市值快照"}
          </Text>
        </Pressable>
      </Card>
    </AppScreen>
  );
}
const styles = StyleSheet.create({
  card: { gap: spacing.md },
  label: { fontSize: 15, fontWeight: "800" },
  help: { fontSize: 12, lineHeight: 19 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 15,
  },
  save: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: "#fff", fontWeight: "900" },
});
