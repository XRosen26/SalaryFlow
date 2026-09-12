import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AppScreen, Card, LoadingState, MoneyAmount, PageHeader, Pill, ProgressBar } from '@/components/ui';
import { spacing, useAppTheme } from '@/constants/theme';
import { useFinance } from '@/data/finance-context';
import { addDays } from '@/domain/dates';
import { budgetTone, formatMoney } from '@/domain/money';

export default function BudgetsScreen() {
  const colors = useAppTheme();
  const router = useRouter();
  const { snapshot, error } = useFinance();
  if (!snapshot) return <AppScreen><LoadingState error={error} /></AppScreen>;
  const hidden = !snapshot.settings.amountsVisible;
  const ratio = snapshot.summary.netExpenseMinor / Math.max(snapshot.summary.budgetMinor, 1);
  const totalTone = budgetTone(snapshot.summary.netExpenseMinor, snapshot.summary.budgetMinor);

  return (
    <AppScreen>
      <PageHeader
        title="预算与周期"
        subtitle={snapshot.settings.budgetBasis === 'SALARY' ? `工资周期 · 每月 ${snapshot.settings.payday} 日` : '自然月预算'}
        action={<Pill text={`${snapshot.cycle.start} 至 ${addDays(snapshot.cycle.end, -1)}`} color={colors.info} />}
      />
      <Card style={styles.summary}>
        <View style={styles.summaryTop}>
          <View>
            <Text style={[styles.label, { color: colors.textSecondary }]}>本期剩余预算</Text>
            <MoneyAmount value={snapshot.summary.remainingBudgetMinor} hidden={hidden} size={30} color={totalTone.color} />
          </View>
          <Pill text={totalTone.label} color={totalTone.color} />
        </View>
        <ProgressBar value={ratio} color={totalTone.color} />
        <View style={styles.facts}>
          <Text style={[styles.fact, { color: colors.textSecondary }]}>净支出 {hidden ? '••••' : formatMoney(snapshot.summary.netExpenseMinor)}</Text>
          <Text style={[styles.fact, { color: colors.textSecondary }]}>总预算 {hidden ? '••••' : formatMoney(snapshot.summary.budgetMinor)}</Text>
        </View>
      </Card>

      <Pressable onPress={() => router.push('/categories' as never)} style={[styles.categoryButton, { borderColor: colors.primary }]}><Text style={[styles.editButtonText, { color: colors.primary }]}>管理分类</Text></Pressable>

      <Pressable onPress={() => router.push('/budget-editor' as never)} style={[styles.editButton, { backgroundColor: colors.primary }]}>
        <Text style={styles.editButtonText}>编辑本期预算</Text>
      </Pressable>

      <View style={styles.titleRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>分类执行</Text>
        <Text onPress={() => Alert.alert('预算层级', '系统模板只用于首次初始化；个人默认预算用于新周期；当前周期可以临时修改，并可选择是否同步更新个人默认预算。')} style={[styles.help, { color: colors.primary }]}>预算如何保存？</Text>
      </View>

      <Card style={styles.list}>
        {snapshot.budgets.map((item) => {
          const tone = budgetTone(item.actualMinor, item.budgetMinor);
          return (
            <View key={item.categoryId} style={styles.item}>
              <View style={styles.itemTop}>
                <View style={styles.itemName}>
                  <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.group, { color: colors.textSecondary }]}>{item.groupName}</Text>
                </View>
                <Pill text={tone.label} color={tone.color} />
              </View>
              <View style={styles.amounts}>
                <Text style={[styles.used, { color: colors.text }]}>
                  {hidden ? '¥ ••••' : formatMoney(item.actualMinor)}
                </Text>
                <Text style={[styles.limit, { color: colors.textSecondary }]}>
                  / {hidden ? '••••' : formatMoney(item.budgetMinor)}
                </Text>
              </View>
              <ProgressBar value={item.actualMinor / Math.max(item.budgetMinor, 1)} color={tone.color} />
            </View>
          );
        })}
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  summary: { gap: spacing.lg },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  label: { fontSize: 13, marginBottom: spacing.sm },
  facts: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  fact: { fontSize: 12, fontVariant: ['tabular-nums'] },
  categoryButton: { minHeight: 48, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  editButton: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  editButtonText: { color: '#FFFFFF', fontWeight: '900' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  help: { fontSize: 13, fontWeight: '700', paddingVertical: spacing.sm },
  list: { gap: spacing.xs, paddingVertical: spacing.sm },
  item: { padding: spacing.lg, gap: spacing.sm },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  itemName: { gap: 2 },
  name: { fontSize: 15, fontWeight: '700' },
  group: { fontSize: 12 },
  amounts: { flexDirection: 'row', alignItems: 'baseline' },
  used: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  limit: { fontSize: 12, fontVariant: ['tabular-nums'] },
});
