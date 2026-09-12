import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import {
  AppScreen,
  Card,
  Divider,
  IconButton,
  LoadingState,
  MoneyAmount,
  PageHeader,
  Pill,
  ProgressBar,
  SectionHeader,
} from '@/components/ui';
import { spacing, useAppTheme } from '@/constants/theme';
import { useFinance } from '@/data/finance-context';
import { addDays } from '@/domain/dates';
import { budgetTone, formatMoney } from '@/domain/money';

const kindLabel = {
  INCOME: '收入',
  EXPENSE: '支出',
  TRANSFER: '转账',
  REFUND: '退款',
  OPENING: '期初',
  ADJUSTMENT: '校准',
} as const;

export default function HomeScreen() {
  const colors = useAppTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { snapshot, loading, error, setAmountsVisible } = useFinance();

  if (!snapshot) return <AppScreen><LoadingState error={error} /></AppScreen>;

  const hidden = !snapshot.settings.amountsVisible;
  const safe = snapshot.summary.safeToSpendMinor;
  const topBudgets = snapshot.budgets.slice(0, width >= 700 ? 6 : 4);
  const recent = snapshot.transactions.slice(0, 5);

  const explainSafe = () => Alert.alert(
    '当前可安心支出',
    '取“本期剩余预算”和“主要消费账户可用余额”中较小的非负值。预算是计划额度，账户余额是真实资金，两者不会互相替代；转账到消费账户只改变资金位置，不会增加预算。',
  );

  const goAdd = (kind: 'EXPENSE' | 'INCOME' | 'TRANSFER') => {
    router.push(`/add?kind=${kind}` as never);
  };

  return (
    <AppScreen>
      <PageHeader
        eyebrow="SALARYFLOW · 本地账本"
        title="财务总览"
        subtitle="把今天的每一笔，安排得刚刚好。"
        action={
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={hidden ? '显示全部金额' : '隐藏全部金额'}
              onPress={() => void setAmountsVisible(hidden)}
              style={[styles.headerIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textSecondary} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="设置与数据"
              onPress={() => router.push('/settings' as never)}
              style={[styles.headerIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
        }
      />

      <Card style={[styles.hero, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroLabel}>当前可安心支出</Text>
            <MoneyAmount value={safe} hidden={hidden} size={34} color="#FFFFFF" />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="解释当前可安心支出"
            onPress={explainSafe}
            hitSlop={10}>
            <Ionicons name="help-circle-outline" size={24} color="#DDF3E9" />
          </Pressable>
        </View>
        <Text style={styles.heroHint}>按预算与账户真实余额共同约束</Text>
        <Divider />
        <View style={styles.heroFacts}>
          <View style={styles.heroFact}>
            <Text style={styles.heroFactLabel}>本期剩余预算</Text>
            <MoneyAmount value={snapshot.summary.remainingBudgetMinor} hidden={hidden} size={18} color="#FFFFFF" />
          </View>
          <View style={styles.heroFact}>
            <Text style={styles.heroFactLabel}>消费账户可用</Text>
            <MoneyAmount value={snapshot.summary.spendingBalanceMinor} hidden={hidden} size={18} color="#FFFFFF" />
          </View>
        </View>
        <Text style={styles.cycle}>
          {snapshot.cycle.start} — {addDays(snapshot.cycle.end, -1)}
        </Text>
      </Card>

      <View style={styles.quickRow}>
        <IconButton name="remove-circle-outline" label="记支出" onPress={() => goAdd('EXPENSE')} />
        <IconButton name="add-circle-outline" label="记收入" onPress={() => goAdd('INCOME')} />
        <IconButton name="swap-horizontal-outline" label="转账" onPress={() => goAdd('TRANSFER')} />
        <IconButton name="sparkles-outline" label="工资分配" onPress={() => router.push('/salary-allocation' as never)} />
        <IconButton name="stats-chart-outline" label="统计" onPress={() => router.push('/analytics' as never)} />
        <IconButton name="calendar-outline" label="固定账单" onPress={() => router.push('/bills' as never)} />
      </View>

      <View>
        <SectionHeader title="本期预算" action="查看全部" onPress={() => router.push('/budgets' as never)} />
        <Card style={styles.listCard}>
          {topBudgets.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textSecondary }]}>还没有预算，先设置本期计划。</Text>
          ) : topBudgets.map((item, index) => {
            const tone = budgetTone(item.actualMinor, item.budgetMinor);
            return (
              <View key={item.categoryId}>
                {index > 0 ? <Divider /> : null}
                <View style={styles.budgetRow}>
                  <View style={styles.budgetTitleRow}>
                    <Text style={[styles.itemTitle, { color: colors.text }]}>{item.name}</Text>
                    <Pill text={tone.label} color={tone.color} />
                  </View>
                  <Text style={[styles.amountPair, { color: colors.textSecondary }]}>
                    {hidden ? '•••• / ••••' : `${formatMoney(item.actualMinor)} / ${formatMoney(item.budgetMinor)}`}
                  </Text>
                  <ProgressBar value={item.actualMinor / Math.max(item.budgetMinor, 1)} color={tone.color} />
                </View>
              </View>
            );
          })}
        </Card>
      </View>

      <View>
        <SectionHeader title="最近交易" action="全部明细" onPress={() => router.push('/transactions' as never)} />
        <Card style={styles.listCard}>
          {recent.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="receipt-outline" size={30} color={colors.primary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>还没有交易</Text>
              <Text style={[styles.empty, { color: colors.textSecondary }]}>从“记一笔”开始建立你的真实账本。</Text>
            </View>
          ) : recent.map((item, index) => {
            const positive = item.kind === 'INCOME' || item.kind === 'REFUND';
            const account = item.kind === 'TRANSFER'
              ? `${item.sourceName ?? ''} → ${item.destinationName ?? ''}`
              : item.sourceName ?? item.destinationName ?? '';
            return (
              <View key={item.id}>
                {index > 0 ? <Divider /> : null}
                <View style={styles.transactionRow}>
                  <View style={[styles.transactionIcon, { backgroundColor: positive ? colors.primarySoft : colors.surfaceMuted }]}>
                    <Ionicons name={positive ? 'arrow-down-outline' : item.kind === 'TRANSFER' ? 'swap-horizontal-outline' : 'arrow-up-outline'} size={18} color={positive ? colors.income : colors.textSecondary} />
                  </View>
                  <View style={styles.transactionText}>
                    <Text style={[styles.itemTitle, { color: colors.text }]}>{item.categoryName ?? kindLabel[item.kind]}</Text>
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>{item.date} · {account}</Text>
                  </View>
                  <MoneyAmount value={item.amountMinor} hidden={hidden} size={16} color={positive ? colors.income : colors.expense} />
                </View>
              </View>
            );
          })}
        </Card>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  headerIcon: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { gap: spacing.md, padding: spacing.xl },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLabel: { color: '#DDF3E9', fontSize: 14, fontWeight: '700', marginBottom: spacing.sm },
  heroHint: { color: '#DDF3E9', fontSize: 12 },
  heroFacts: { flexDirection: 'row', gap: spacing.xl },
  heroFact: { flex: 1, gap: spacing.xs },
  heroFactLabel: { color: '#C9E5D9', fontSize: 12 },
  cycle: { color: '#C9E5D9', fontSize: 12 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  listCard: { paddingVertical: spacing.xs },
  budgetRow: { padding: spacing.lg, gap: spacing.sm },
  budgetTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  itemTitle: { fontSize: 15, fontWeight: '700' },
  amountPair: { fontSize: 12, fontVariant: ['tabular-nums'] },
  transactionRow: { minHeight: 70, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  transactionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  transactionText: { flex: 1, gap: 3 },
  meta: { fontSize: 12 },
  emptyWrap: { alignItems: 'center', padding: spacing.xl, gap: spacing.sm },
  emptyTitle: { fontWeight: '700', fontSize: 16 },
  empty: { fontSize: 13, lineHeight: 20 },
});
