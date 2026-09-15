import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { AppScreen, Card, PageHeader } from "@/components/ui";
import { radius, spacing, useAppTheme } from "@/constants/theme";

const topics = [
  [
    "快速记账",
    "先选择支出、收入或转账，再选择分类，然后填写金额、账户和实际发生日期。金额支持 +、−、×、÷ 和括号。",
  ],
  [
    "日期输入",
    "可点日历直接选择，也可输入 2026-09-13、2026年9月13日、2026/9/13 或 20260913，离开输入框后会统一为 YYYY-MM-DD。",
  ],
  [
    "预算状态与安心支出",
    "预算有余额时，安心支出取本期剩余预算与主要消费账户可用余额中的较小非负值；预算用完或超支后，首页会切换为明确提醒。",
  ],
  [
    "交易范围与统计",
    "交易明细可组合日期、金额、类型、搜索和排序。统计提供今日、近3/7/30/90天等范围，均按实际发生日期计算。",
  ],
  [
    "待收款",
    "借出款记录对方、账户和可选归还日，可分次归还。借出与归还只改变账户和待收余额，不计收入、支出、预算或储蓄率。",
  ],
  [
    "预算与周期",
    "预算可按工资周期或自然月管理。周期规则可立即、下周期或指定日期生效；每笔交易按实际发生日期归入当时有效的周期。",
  ],
  [
    "工资分配",
    "先记录并标记工资收入，再进入工资分配。建议参考预算缺口、消费账户余额、保留金额和所选上限；确认后才会记录账户间转账。",
  ],
  [
    "退款",
    "从原支出详情发起，可选择全部或预设比例，也可输入算式。退款关联原支出并按到账日冲减净支出。",
  ],
  [
    "固定账单",
    "固定账单先作为待办出现，只有确认已经支付后才生成真实支出；跳过本期不会记账。",
  ],
  [
    "理财账户",
    "理财账户使用最近一次市值快照计入总资产，涨跌不计收支。同日有转入转出时，请在资金移动完成后更新市值。",
  ],
  [
    "备份与恢复",
    "完整 JSON 备份包含全部财务数据。恢复会先校验并创建本地恢复点，然后整库替换；不会合并两台设备的并行修改。",
  ],
] as const;

export default function HelpScreen() {
  const colors = useAppTheme();
  const router = useRouter();
  const [tab, setTab] = useState<"guide" | "about">("guide");
  return (
    <AppScreen>
      <PageHeader
        eyebrow="帮助中心"
        title="使用说明与关于"
        subtitle="快速了解功能、财务口径和数据边界。"
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
      <View
        accessibilityRole="tablist"
        style={[styles.tabs, { backgroundColor: colors.surfaceMuted }]}
      >
        {(
          [
            ["guide", "使用说明", "book-outline"],
            ["about", "关于", "information-circle-outline"],
          ] as const
        ).map(([key, label, icon]) => {
          const active = tab === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setTab(key)}
              style={[
                styles.tab,
                active && { backgroundColor: colors.surface },
              ]}
            >
              <Ionicons
                name={icon}
                size={19}
                color={active ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: active ? colors.text : colors.textSecondary },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === "guide" ? (
        <>
          <View style={styles.list}>
            {topics.map(([title, body], index) => (
              <Card key={title} style={styles.card}>
                <View
                  style={[
                    styles.number,
                    { backgroundColor: colors.primarySoft },
                  ]}
                >
                  <Text style={[styles.numberText, { color: colors.primary }]}>
                    {index + 1}
                  </Text>
                </View>
                <View style={styles.copy}>
                  <Text style={[styles.title, { color: colors.text }]}>
                    {title}
                  </Text>
                  <Text style={[styles.body, { color: colors.textSecondary }]}>
                    {body}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            薪流不会连接银行，也不会把账本发送到网络。请定期把完整备份保存到可信位置。
          </Text>
        </>
      ) : (
        <Card style={styles.aboutCard}>
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.logo}
            accessibilityLabel="薪流图标"
          />
          <Text style={[styles.aboutTitle, { color: colors.text }]}>
            薪流 SalaryFlow
          </Text>
          <Text style={[styles.version, { color: colors.primary }]}>
            移动端 0.6.0
          </Text>
          <Text style={[styles.aboutBody, { color: colors.textSecondary }]}>
            薪流是一款本地优先的个人预算、现金流与资产管理应用，由 XRosen26
            完成并持续迭代。
          </Text>
          <Text style={[styles.aboutBody, { color: colors.textSecondary }]}>
            当前提供 Windows 与 Android 预览版，iOS
            共用工程已搭建。各平台按屏幕与输入方式优化，并沿用一致的财务计算与数据规则。
          </Text>
          <View
            style={[styles.privacy, { backgroundColor: colors.primarySoft }]}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color={colors.primary}
            />
            <Text style={[styles.privacyText, { color: colors.text }]}>
              本地保存 · 无需登录 · 不连接银行
            </Text>
          </View>
        </Card>
      )}
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
  tabs: { flexDirection: "row", padding: 4, borderRadius: radius.md },
  tab: {
    flex: 1,
    minHeight: 46,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  tabText: { fontSize: 14, fontWeight: "800" },
  list: { gap: spacing.md },
  card: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  number: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: { fontSize: 14, fontWeight: "900" },
  copy: { flex: 1, gap: spacing.xs },
  title: { fontSize: 16, fontWeight: "800" },
  body: { fontSize: 13, lineHeight: 21 },
  footerText: {
    fontSize: 12,
    lineHeight: 19,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xl,
  },
  aboutCard: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  logo: { width: 82, height: 82, borderRadius: 20 },
  aboutTitle: { fontSize: 24, fontWeight: "900" },
  version: { fontSize: 13, fontWeight: "800" },
  aboutBody: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 520,
  },
  privacy: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  privacyText: { fontSize: 12, fontWeight: "800" },
});
