import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
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
  Pill,
} from "@/components/ui";
import { radius, spacing, useAppTheme } from "@/constants/theme";
import { useFinance } from "@/data/finance-context";
import { normalizeDateInput, today } from "@/domain/dates";
import { formatMoney, parseMoneyExpression } from "@/domain/money";

const labels: Record<string, string> = {
  INCOME: "收入",
  EXPENSE: "支出",
  TRANSFER: "转账",
  REFUND: "退款",
  OPENING: "期初余额",
  ADJUSTMENT: "余额校准",
};
export default function TransactionDetailScreen() {
  const colors = useAppTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot, error, refundTransaction, deleteTransaction } =
    useFinance();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const item = snapshot?.transactions.find((x) => x.id === id);
  const refunded = useMemo(
    () =>
      snapshot?.transactions
        .filter((x) => x.kind === "REFUND" && x.originalId === id)
        .reduce((s, x) => s + x.amountMinor, 0) ?? 0,
    [id, snapshot],
  );
  if (!snapshot)
    return (
      <AppScreen>
        <LoadingState error={error} />
      </AppScreen>
    );
  if (!item)
    return (
      <AppScreen>
        <PageHeader
          title="交易不存在"
          subtitle="记录可能已删除，或不在最近 100 条记录中。"
        />
      </AppScreen>
    );
  const hidden = !snapshot.settings.amountsVisible;
  const remaining =
    item.kind === "EXPENSE" ? Math.max(0, item.amountMinor - refunded) : 0;
  const account =
    item.kind === "TRANSFER"
      ? `${item.sourceName} → ${item.destinationName}`
      : (item.sourceName ?? item.destinationName ?? "—");
  const refund = async () => {
    try {
      setBusy(true);
      await refundTransaction(
        item.id,
        Number(parseMoneyExpression(amount)),
        normalizeDateInput(date),
        `退回：${item.note || item.categoryName || "原支出"}`,
      );
      setAmount("");
      Alert.alert(
        "退款已记录",
        "款项已回到原付款账户，并按退款实际日期冲减对应周期的净支出。",
      );
    } catch (e) {
      Alert.alert(
        "无法记录退款",
        e instanceof Error ? e.message : "请检查输入",
      );
    } finally {
      setBusy(false);
    }
  };
  const remove = () =>
    Alert.alert(
      "删除这笔交易？",
      item.kind === "EXPENSE" && refunded > 0
        ? "原支出和关联退款会一起软删除，相关金额会重新计算。"
        : "记录会软删除并保留审计历史，相关金额会重新计算。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: async () => {
            try {
              setBusy(true);
              await deleteTransaction(item.id);
              router.replace("/transactions" as never);
            } catch (e) {
              Alert.alert(
                "无法删除",
                e instanceof Error ? e.message : "请稍后重试",
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  return (
    <AppScreen>
      <PageHeader
        title="交易详情"
        subtitle={item.receivableId ? "待收款资金流水请在待收款页面管理。" : "修改和删除都会保留审计记录。"}
        action={<Pill text={item.receivableId ? "待收款" : (labels[item.kind] ?? item.kind)} />}
      />
      <Card style={styles.card}>
        <Text style={[styles.muted, { color: colors.textSecondary }]}>
          {item.receivableId ? `${item.receivableDirection === "LENT" ? "借给" : "收到归还"} ${item.receivablePerson}` : (item.categoryName ?? labels[item.kind])}
        </Text>
        <MoneyAmount
          value={item.amountMinor}
          hidden={hidden}
          size={36}
          color={item.kind === "EXPENSE" ? colors.expense : colors.income}
        />
        <View style={styles.facts}>
          <Fact label="账户" value={account} />
          <Fact label="实际发生日期" value={item.date} />
          <Fact label="备注" value={item.note || "无"} />
        </View>
      </Card>
      {item.receivableId ? (
        <Pressable style={[styles.primary, { backgroundColor: colors.primary }]} onPress={() => router.push("/receivables" as never)}>
          <Ionicons name="cash-outline" size={20} color="#fff" /><Text style={styles.primaryText}>前往待收款管理</Text>
        </Pressable>
      ) : null}
      {["INCOME", "EXPENSE", "TRANSFER"].includes(item.kind) ? (
        <Pressable
          style={[styles.primary, { backgroundColor: colors.primary }]}
          onPress={() => router.push(`/add?id=${item.id}` as never)}
        >
          <Ionicons name="create-outline" size={20} color="#fff" />
          <Text style={styles.primaryText}>修改交易</Text>
        </Pressable>
      ) : null}
      {item.kind === "EXPENSE" && remaining > 0 ? (
        <Card style={styles.card}>
          <View style={styles.between}>
            <Text style={[styles.title, { color: colors.text }]}>记录退款</Text>
            <Text style={[styles.muted, { color: colors.textSecondary }]}>
              可退 {hidden ? "••••" : formatMoney(remaining)}
            </Text>
          </View>
          <Text style={[styles.help, { color: colors.textSecondary }]}>
            退款关联原支出，只保存一次；按退款实际日期冲减净支出。
          </Text>
          <View style={styles.presets}>
            {(
              [
                ["全额", remaining],
                ["50%", Math.round(remaining * 0.5)],
                ["25%", Math.round(remaining * 0.25)],
              ] as [string, number][]
            ).map(([t, v]) => (
              <Pressable
                key={t}
                onPress={() => setAmount((v / 100).toFixed(2))}
                style={[styles.preset, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  {t}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="退款金额，可输入算式"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              { color: colors.text, borderColor: colors.border },
            ]}
          />
          <DateField label="退款到账日期" value={date} onChange={setDate} />
          <Pressable
            disabled={busy || !amount}
            onPress={() => void refund()}
            style={[
              styles.primary,
              {
                backgroundColor: colors.primary,
                opacity: busy || !amount ? 0.5 : 1,
              },
            ]}
          >
            <Text style={styles.primaryText}>确认记录退款</Text>
          </Pressable>
        </Card>
      ) : null}
      {!["OPENING", "ADJUSTMENT"].includes(item.kind) ? (
        <Pressable
          disabled={busy}
          onPress={remove}
          style={[styles.delete, { borderColor: colors.expense }]}
        >
          <Ionicons name="trash-outline" size={19} color={colors.expense} />
          <Text style={{ color: colors.expense, fontWeight: "800" }}>
            删除交易
          </Text>
        </Pressable>
      ) : null}
    </AppScreen>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  const c = useAppTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text style={[styles.muted, { color: c.textSecondary }]}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 15, fontWeight: "700" }}>
        {value}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  card: { gap: spacing.md },
  facts: { gap: spacing.md, marginTop: spacing.sm },
  muted: { fontSize: 12 },
  between: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 18, fontWeight: "800" },
  help: { fontSize: 13, lineHeight: 20 },
  presets: { flexDirection: "row", gap: spacing.sm },
  preset: {
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.pill,
    justifyContent: "center",
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 15,
  },
  primary: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  delete: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
});
