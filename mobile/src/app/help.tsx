import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen, Card, PageHeader } from '@/components/ui';
import { spacing, useAppTheme } from '@/constants/theme';

const topics = [
  ['当前可安心支出', '取“本期剩余预算”和“主要消费账户可用余额”中的较小值。预算是计划额度，账户余额是真实资金，两者不会互相替代。'],
  ['记一笔', '底部中央按钮可记录支出、收入或转账。金额支持 +、−、×、÷ 和括号，例如 38+16.5。支出或转账超过账户余额时会被阻止。'],
  ['预算与周期', '预算可按工资周期或自然月管理。修改周期规则时可选择立即、下周期或指定日期生效；每笔交易按实际发生日期归入当时有效的周期。'],
  ['工资分配', '先记录并标记一笔工资收入，再从首页进入工资分配。建议会参考本期预算缺口、消费账户余额、保留金额和所选上限；确认后才会真正记录账户间转账。'],
  ['退款', '从原支出详情发起，可选择全额、50%、25%或输入算式。退款关联原支出并抵减净支出，累计金额不会超过原支出。'],
  ['固定账单', '固定账单先作为待办出现，只有“确认支付”后才生成真实支出；跳过本期不会记账，并会生成下一期待办。'],
  ['理财账户', '理财账户使用最近一次市值快照计入总资产，涨跌不计作收入或支出。同日有转入转出时，请完成资金移动后再更新市值。'],
  ['备份与恢复', '完整 JSON 备份包含全部财务数据。恢复会先校验文件并创建本地恢复点，然后整库替换；当前版本不会合并两台设备的并行修改。'],
] as const;

export default function HelpScreen() {
  const colors = useAppTheme();
  const router = useRouter();
  return (
    <AppScreen>
      <PageHeader
        eyebrow="使用说明"
        title="常用功能怎么用"
        subtitle="所有核心记账与查询都可离线完成。"
        action={
          <Pressable accessibilityRole="button" accessibilityLabel="返回" onPress={() => router.back()} style={styles.close}>
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
        }
      />
      <View style={styles.list}>
        {topics.map(([title, body], index) => (
          <Card key={title} style={styles.card}>
            <View style={[styles.number, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.numberText, { color: colors.primary }]}>{index + 1}</Text>
            </View>
            <View style={styles.copy}>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              <Text style={[styles.body, { color: colors.textSecondary }]}>{body}</Text>
            </View>
          </Card>
        ))}
      </View>
      <Text style={[styles.footer, { color: colors.textSecondary }]}>薪流不会连接银行，也不会把账本发送到网络。请定期把完整备份保存到可信位置。</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  list: { gap: spacing.md },
  card: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  number: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  numberText: { fontSize: 14, fontWeight: '900' },
  copy: { flex: 1, gap: spacing.xs },
  title: { fontSize: 16, fontWeight: '800' },
  body: { fontSize: 13, lineHeight: 21 },
  footer: { fontSize: 12, lineHeight: 19, paddingHorizontal: spacing.sm, paddingBottom: spacing.xl },
});