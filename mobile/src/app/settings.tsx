import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import {
  AppScreen,
  Card,
  Divider,
  LoadingState,
  PageHeader,
} from "@/components/ui";
import {
  radius,
  spacing,
  useAppTheme,
  type PaletteName,
  type ThemeMode,
} from "@/constants/theme";
import { inspectBackup, restoreBackup, shareBackup } from "@/data/backup";
import { useFinance } from "@/data/finance-context";
import { resetLedger, updateSettings } from "@/data/repository";

function SettingRow({
  icon,
  title,
  description,
  action,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  action?: React.ReactNode;
  onPress?: () => void;
}) {
  const colors = useAppTheme();
  const content = (
    <>
      <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>
          {description}
        </Text>
      </View>
      {action ??
        (onPress ? (
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textSecondary}
          />
        ) : null)}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.68 }]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.row}>{content}</View>
  );
}

const paletteOptions: {
  id: PaletteName;
  name: string;
  description: string;
  color: string;
}[] = [
  { id: "forest", name: "森绿", description: "沉静自然", color: "#176B55" },
  { id: "ocean", name: "海蓝", description: "清晰冷静", color: "#2563A2" },
  { id: "violet", name: "鸢紫", description: "柔和雅致", color: "#7253A6" },
  { id: "amber", name: "暖琥珀", description: "温暖克制", color: "#99621E" },
  { id: "rose", name: "玫瑰", description: "温润明快", color: "#A4476C" },
  { id: "slate", name: "石墨", description: "低调中性", color: "#546775" },
];

const themeModeOptions: {
  id: ThemeMode;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: "system", name: "跟随系统", icon: "phone-portrait-outline" },
  { id: "light", name: "浅色", icon: "sunny-outline" },
  { id: "dark", name: "深色", icon: "moon-outline" },
];

export default function SettingsScreen() {
  const colors = useAppTheme();
  const router = useRouter();
  const db = useSQLiteContext();
  const { snapshot, error, refresh, setAmountsVisible } = useFinance();
  const [busy, setBusy] = useState(false);
  const [resetReason, setResetReason] = useState("");

  if (!snapshot)
    return (
      <AppScreen>
        <LoadingState error={error} />
      </AppScreen>
    );

  const exportData = async () => {
    try {
      setBusy(true);
      await shareBackup(db);
    } catch (reason) {
      Alert.alert(
        "导出失败",
        reason instanceof Error ? reason.message : "无法创建备份",
      );
    } finally {
      setBusy(false);
    }
  };

  const chooseRestore = async () => {
    try {
      setBusy(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const inspected = await inspectBackup(result.assets[0].uri);
      Alert.alert(
        "确认替换当前账本",
        `备份时间：${new Date(inspected.summary.createdAt).toLocaleString("zh-CN")}\n账户：${inspected.summary.accounts}\n交易：${inspected.summary.transactions}\n分类：${inspected.summary.categories}\n\n恢复会整库替换，不会合并两台设备的修改。操作前会自动保留。`,
        [
          { text: "取消", style: "cancel" },
          {
            text: "创建恢复点并替换",
            style: "destructive",
            onPress: () => {
              void (async () => {
                try {
                  setBusy(true);
                  await restoreBackup(db, inspected.document);
                  await refresh();
                  Alert.alert(
                    "恢复完成",
                    "已校验数据库完整性，账户余额和统计已重新读取。",
                  );
                } catch (reason) {
                  Alert.alert(
                    "恢复失败",
                    reason instanceof Error
                      ? reason.message
                      : "当前账本没有被替换",
                  );
                } finally {
                  setBusy(false);
                }
              })();
            },
          },
        ],
      );
    } catch (reason) {
      Alert.alert(
        "无法读取备份",
        reason instanceof Error ? reason.message : "请选择薪流完整备份",
      );
    } finally {
      setBusy(false);
    }
  };

  const clearLedger = () => {
    Alert.alert(
      "确认清空手机账本",
      "这会清空手机上的账户、交易、预算、账单和存钱计划，并恢复初始模板。操作前会自动建立本地恢复点。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "确认清空",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                setBusy(true);
                await import("@/data/backup").then(({ writeBackup }) =>
                  writeBackup(db, true),
                );
                await resetLedger(db, resetReason);
                await refresh();
                setResetReason("");
                Alert.alert(
                  "已重新开始",
                  "手机账本已清空，并恢复为不含个人数据的初始账户与预算模板。",
                );
              } catch (reason) {
                Alert.alert(
                  "清空失败",
                  reason instanceof Error ? reason.message : "当前账本没有被清空",
                );
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <AppScreen>
      <PageHeader
        eyebrow="设置与数据"
        title="保持清楚，也保持安心"
        subtitle="账本默认只保存在这台设备。"
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="返回"
            onPress={() => router.back()}
            style={styles.close}
          >
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
        }
      />

      <View>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          预算规则
        </Text>
        <Card style={styles.group}>
          <SettingRow
            icon="calendar-outline"
            title="预算周期"
            description={
              snapshot.settings.budgetBasis === "SALARY"
                ? `工资周期 · 每月 ${snapshot.settings.payday} 日`
                : "自然月"
            }
            onPress={() => router.push("/cycle-settings" as never)}
          />
        </Card>
      </View>

      <View>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          账本管理
        </Text>
        <Card style={styles.group}>
          <SettingRow
            icon="pricetags-outline"
            title="收支分类"
            description="新增、修改或归档记账与预算使用的分类。"
            onPress={() => router.push("/categories" as never)}
          />
          <Divider />
          <SettingRow
            icon="receipt-outline"
            title="固定账单"
            description="管理周期账单，并在实际支付后确认入账。"
            onPress={() => router.push("/bills" as never)}
          />
          <Divider />
          <SettingRow
            icon="wallet-outline"
            title="账户与主要用途"
            description="管理账户，并设置工资、消费、储蓄等主要用途。"
            onPress={() => router.push("/(tabs)/accounts" as never)}
          />
        </Card>
      </View>

      <View>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          外观
        </Text>
        <Card style={styles.paletteCard}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>
            界面配色
          </Text>
          <Text
            style={[styles.rowDescription, { color: colors.textSecondary }]}
          >
            选择后立即应用；每套配色分别适配浅色与深色模式，预算风险色保持独立。
          </Text>
          <View accessibilityRole="radiogroup" style={styles.paletteGrid}>
            {paletteOptions.map((item) => {
              const selected = snapshot.settings.palette === item.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() =>
                    void (async () => {
                      await updateSettings(db, { palette: item.id });
                      await refresh();
                    })()
                  }
                  style={[
                    styles.paletteChoice,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected
                        ? colors.primarySoft
                        : colors.surface,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.paletteSwatch,
                      { backgroundColor: item.color },
                    ]}
                  />
                  <View style={styles.paletteText}>
                    <Text style={[styles.paletteName, { color: colors.text }]}>
                      {item.name}
                    </Text>
                    <Text
                      style={[
                        styles.paletteDescription,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {item.description}
                    </Text>
                  </View>
                  {selected ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.primary}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <Divider />
          <Text style={[styles.rowTitle, { color: colors.text }]}>
            明暗模式
          </Text>
          <Text
            style={[styles.rowDescription, { color: colors.textSecondary }]}
          >
            可跟随系统，也可固定使用浅色或深色。
          </Text>
          <View accessibilityRole="radiogroup" style={styles.modeGrid}>
            {themeModeOptions.map((item) => {
              const selected = snapshot.settings.themeMode === item.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() =>
                    void (async () => {
                      await updateSettings(db, { themeMode: item.id });
                      await refresh();
                    })()
                  }
                  style={[
                    styles.modeChoice,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected
                        ? colors.primarySoft
                        : colors.surface,
                    },
                  ]}
                >
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={selected ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.modeName,
                      { color: selected ? colors.text : colors.textSecondary },
                    ]}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      </View>
      <View>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          隐私
        </Text>
        <Card style={styles.group}>
          <SettingRow
            icon={
              snapshot.settings.amountsVisible
                ? "eye-outline"
                : "eye-off-outline"
            }
            title="全局金额显示"
            description="关闭后，首页、明细、预算和所有账户金额都会隐藏。"
            action={
              <Switch
                value={snapshot.settings.amountsVisible}
                onValueChange={(value) => void setAmountsVisible(value)}
                trackColor={{ true: colors.primary }}
              />
            }
          />
        </Card>
      </View>

      <View>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          备份与迁移
        </Text>
        <Card style={styles.group}>
          <SettingRow
            icon="share-outline"
            title="导出完整备份"
            description="生成含完整账本的 JSON，通过系统分享面板保存或发送。"
            onPress={() => void exportData()}
          />
          <Divider />
          <SettingRow
            icon="download-outline"
            title="从完整备份恢复"
            description="先校验版本和摘要，再创建恢复点并整库替换。"
            onPress={() => void chooseRestore()}
          />
        </Card>
        <Text style={[styles.footnote, { color: colors.textSecondary }]}>
          备份包含财务数据，请保存到你信任的位置。当前版本不会自动合并桌面与手机的并行修改。
        </Text>
      </View>

      <View>
        <Text style={[styles.errorTitle, { color: colors.expense }]}>
          重新开始
        </Text>
        <Card style={styles.danger}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>
            清空手机账本
          </Text>
          <Text
            style={[styles.rowDescription, { color: colors.textSecondary }]}
          >
            点击后会再次确认；操作前自动建立本地恢复点。清空原因可不填写。
          </Text>
          <TextInput
            value={resetReason}
            onChangeText={setResetReason}
            placeholder="清空原因（可选）"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              { color: colors.text, borderColor: colors.border },
            ]}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={clearLedger}
            style={[
              styles.dangerButton,
              {
                backgroundColor: colors.expense,
                opacity: busy ? 0.5 : 1,
              },
            ]}
          >
            <Text style={styles.dangerButtonText}>清空并恢复初始模板</Text>
          </Pressable>
        </Card>
      </View>

      <View>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          帮助与支持
        </Text>
        <Card style={styles.group}>
          <SettingRow
            icon="help-circle-outline"
            title="使用说明与关于"
            description="了解功能、财务口径、数据边界和当前版本。"
            onPress={() => router.push("/help" as never)}
          />
        </Card>
      </View>
      {busy ? (
        <Text style={[styles.busy, { color: colors.primary }]}>
          正在处理，请稍候…
        </Text>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  close: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  group: { padding: 0, overflow: "hidden" },
  paletteCard: { gap: spacing.md },
  paletteGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  paletteChoice: {
    width: "48%",
    minHeight: 68,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  paletteSwatch: { width: 28, height: 28, borderRadius: 9 },
  paletteText: { flex: 1, gap: 2 },
  modeGrid: { flexDirection: "row", gap: spacing.sm },
  modeChoice: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  modeName: { fontSize: 11, fontWeight: "800" },
  paletteName: { fontSize: 14, fontWeight: "800" },
  paletteDescription: { fontSize: 10 },
  row: {
    minHeight: 76,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 15, fontWeight: "800" },
  rowDescription: { fontSize: 12, lineHeight: 18 },
  footnote: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  danger: { gap: spacing.md },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  dangerButton: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButtonText: { color: "#FFFFFF", fontWeight: "800" },
  about: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.md,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  aboutText: { flex: 1, minWidth: 180, gap: 3 },
  aboutTitle: { fontSize: 17, fontWeight: "900" },
  aboutBody: { width: "100%", fontSize: 13, lineHeight: 20 },
  busy: { textAlign: "center", fontSize: 13, fontWeight: "700" },
});
