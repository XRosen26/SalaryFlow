import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { AppScreen, Card, PageHeader } from "@/components/ui";
import { radius, spacing, useAppTheme } from "@/constants/theme";

const topics = [
  [
    "快速开始",
    "首次使用先核对周期和期初余额，并设置主要工资、消费与储蓄账户。常用顺序是记录工资、工资分配、日常记账，再看预算与统计。",
  ],
  [
    "金额与日期",
    "金额支持 +、−、×、÷ 和括号，保存时按元输入、按整数分存储。日期默认今天；可点日历，也可输入 2026-09-13、中文年月日、斜杠日期或 20260913。",
  ],
  [
    "账户与余额",
    "账户可新增、修改、归档和校准余额。校准需要确认，会形成独立调整记录，不计收入、支出、预算或储蓄率。金额隐藏只遮挡界面，备份文件并未加密。",
  ],
  [
    "预算与安心支出",
    "预算可按工资周期或自然月管理。安心支出取本期剩余预算与主要消费账户余额中的较小非负值，卡片颜色同时参考预算空间和真实资金覆盖；超支时会明确提醒。",
  ],
  [
    "交易、退款与筛选",
    "交易按实际发生日期保存一次，可组合日期、金额、类型、账户、搜索和排序。退款从原支出发起，并在原支出上显示已退款金额或已全额退款，不作为新收入显示。",
  ],
  [
    "固定账单",
    "固定账单到期后先生成待办，确认实际支付才记支出。可修改、延期、跳过或删除规则；删除不会抹掉已支付历史和真实交易。",
  ],
  [
    "工资分配",
    "先记录并标记工资收入，再按预算缺口、消费账户余额、保留金额和上限生成建议。超支或资金不足时可按预设或自定义金额补充；确认后只记录内部转账。",
  ],
  [
    "待收款",
    "记录借给谁、借出账户、可选归还日和备注，支持分次归还。借出与归还只改变账户和待收余额，不计收支、预算或储蓄率；误录可确认撤销。",
  ],
  [
    "存钱计划",
    "先设置目标金额，再选计算方式。关联账户会把所选账户当前余额合计为进度，只读取余额，不移动资金或创建交易；手动进度由你填写目前已存金额，也不会修改账户余额。删除计划不会删除账户或交易。",
  ],
  [
    "统计分析",
    "可查看今日、近3/7/30/90天、工资周期、周/月/年历史周期或自定义日期，并按全部或单一账户筛选。趋势、构成和汇总共用所选时间与账户，均按实际发生日计算。",
  ],
  [
    "分类与历史",
    "分类可以修改；未被交易、预算或账单使用的分类可以删除。已有历史的分类只能归档，历史交易继续保留发生时名称，避免破坏旧账和统计。",
  ],
  [
    "理财账户",
    "理财账户以最近一次市值快照计入总资产，涨跌不计收支。资金转入转出后再更新市值，可避免资产重复计算。",
  ],
  [
    "外观与金额隐私",
    "设置中可选择六套配色，并跟随系统或固定浅色/深色。统计图表随配色协调变化，预算风险色保持独立。关闭全局金额显示后，首页、明细、预算、存钱计划和账户金额都会遮挡。",
  ],
  [
    "数据、备份与清空",
    "完整 JSON 备份包含账户、交易、预算、账单、待收款和存钱计划。恢复会先校验并建立恢复点。清空手机账本使用按钮和二次确认，可选备注原因；执行前应保存可信备份。",
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
            移动端 0.6.3
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
