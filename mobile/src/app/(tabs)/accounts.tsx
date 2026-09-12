import { Ionicons } from "@expo/vector-icons";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";

import {
  AppScreen,
  Card,
  LoadingState,
  MoneyAmount,
  PageHeader,
  Pill,
} from "@/components/ui";
import { spacing, useAppTheme } from "@/constants/theme";
import { useFinance } from "@/data/finance-context";

const roleNames: Record<string, string> = {
  PRIMARY_SPENDING: "主要消费",
  PRIMARY_SAVINGS: "主要储蓄",
  PRIMARY_SALARY: "工资账户",
  INVESTMENT: "理财估值",
};

export default function AccountsScreen() {
  const colors = useAppTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { snapshot, error, setAccountHidden, setAccountSummaryVisible } =
    useFinance();
  if (!snapshot)
    return (
      <AppScreen>
        <LoadingState error={error} />
      </AppScreen>
    );
  const globallyHidden = !snapshot.settings.amountsVisible;
  const summaryHidden =
    globallyHidden || !snapshot.settings.accountSummaryVisible;
  const columns = width >= 720 ? 2 : 1;

  return (
    <AppScreen>
      <PageHeader
        title="我的账户"
        subtitle="账户完全动态；工资、消费、储蓄角色只是可修改的标记。"
      />
      <Card style={styles.total}>
        <View style={styles.totalTop}>
          <View>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              全部账户总资产
            </Text>
            <MoneyAmount
              value={snapshot.summary.totalAssetsMinor}
              hidden={summaryHidden}
              size={30}
            />
          </View>
          <View style={styles.totalActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                snapshot.settings.accountSummaryVisible
                  ? "隐藏全部账户总资产"
                  : "显示全部账户总资产"
              }
              onPress={() =>
                void setAccountSummaryVisible(
                  !snapshot.settings.accountSummaryVisible,
                )
              }
              hitSlop={10}
            >
              <Ionicons
                name={
                  snapshot.settings.accountSummaryVisible
                    ? "eye-outline"
                    : "eye-off-outline"
                }
                size={24}
                color={colors.textSecondary}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="解释总资产"
              onPress={() =>
                Alert.alert(
                  "全部账户总资产",
                  "汇总所有未归档账户。只有全局金额显示和这里的独立开关都开启时才显示金额；转账不会改变总资产。",
                )
              }
            >
              <Ionicons
                name="help-circle-outline"
                size={24}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>
        </View>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          转账不会重复增加资产
        </Text>
      </Card>

      <View style={[styles.grid, columns === 2 && styles.gridWide]}>
        {snapshot.accounts.map((account) => {
          const hidden = globallyHidden || account.hidden;
          return (
            <Pressable
              key={account.id}
              onPress={() =>
                router.push(`/account-editor?id=${account.id}` as never)
              }
            >
              <Card style={[styles.account, columns === 2 && styles.half]}>
                <View style={styles.accountTop}>
                  <View
                    style={[
                      styles.accountIcon,
                      { backgroundColor: colors.primarySoft },
                    ]}
                  >
                    <Ionicons
                      name={
                        account.valuationMode
                          ? "trending-up-outline"
                          : "wallet-outline"
                      }
                      size={22}
                      color={colors.primary}
                    />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      account.hidden
                        ? `显示${account.name}金额`
                        : `隐藏${account.name}金额`
                    }
                    onPress={() => void setAccountHidden(account.id)}
                    hitSlop={10}
                  >
                    <Ionicons
                      name={account.hidden ? "eye-off-outline" : "eye-outline"}
                      size={22}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                </View>
                <View>
                  <Text style={[styles.name, { color: colors.text }]}>
                    {account.name}
                  </Text>
                  <Text style={[styles.type, { color: colors.textSecondary }]}>
                    {account.typeName}
                  </Text>
                </View>
                <MoneyAmount
                  value={account.balanceMinor}
                  hidden={hidden}
                  size={26}
                />
                <View style={styles.roles}>
                  {account.roles.map((role) => (
                    <Pill key={role} text={roleNames[role] ?? role} />
                  ))}
                </View>
                {account.valuationMode ? (
                  <>
                    <Text
                      style={[styles.hint, { color: colors.textSecondary }]}
                    >
                      余额按最新市值记录，涨跌不计作收支。
                    </Text>
                    <Pressable
                      onPress={(event) => {
                        event.stopPropagation();
                        router.push(
                          `/valuation?accountId=${account.id}` as never,
                        );
                      }}
                      style={[
                        styles.valuation,
                        { borderColor: colors.primary },
                      ]}
                    >
                      <Text
                        style={{ color: colors.primary, fontWeight: "800" }}
                      >
                        更新市值
                      </Text>
                    </Pressable>
                  </>
                ) : null}
              </Card>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/account-editor" as never)}
        style={({ pressed }) => [
          styles.add,
          { borderColor: colors.primary, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Ionicons name="add" size={22} color={colors.primary} />
        <Text style={[styles.addText, { color: colors.primary }]}>
          新增账户
        </Text>
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  total: { gap: spacing.sm },
  totalTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  label: { fontSize: 13, marginBottom: spacing.sm },
  totalActions: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  hint: { fontSize: 12, lineHeight: 18 },
  grid: { gap: spacing.md },
  gridWide: { flexDirection: "row", flexWrap: "wrap" },
  half: { width: "48.8%" },
  account: { minHeight: 210, gap: spacing.lg },
  accountTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  accountIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 18, fontWeight: "800" },
  type: { fontSize: 12, marginTop: 3 },
  roles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  valuation: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  add: {
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  addText: { fontSize: 15, fontWeight: "800" },
});
