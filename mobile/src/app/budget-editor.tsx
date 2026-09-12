import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { AppScreen, Card, LoadingState, PageHeader } from '@/components/ui';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { useFinance } from '@/data/finance-context';
import { saveCycleBudget } from '@/data/repository';
import { formatMoney, parseMoney } from '@/domain/money';

export default function BudgetEditorScreen() {
  const colors = useAppTheme();
  const router = useRouter();
  const db = useSQLiteContext();
  const { snapshot, error, refresh } = useFinance();
  const [values, setValues] = useState<Record<string, string>>({});
  const [updateDefault, setUpdateDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const expenses = useMemo(() => snapshot?.categories.filter((category) => category.kind === 'EXPENSE') ?? [], [snapshot]);

  useEffect(() => {
    if (!snapshot) return;
    const byId = new Map(snapshot.budgets.map((item) => [item.categoryId, item.budgetMinor]));
    setValues(Object.fromEntries(expenses.map((category) => [category.id, ((byId.get(category.id) ?? 0) / 100).toFixed(2)])));
  }, [expenses, snapshot]);

  if (!snapshot) return <AppScreen><LoadingState error={error} /></AppScreen>;

  const total = expenses.reduce((sum, category) => {
    try { return sum + Number(parseMoney(values[category.id] || '0', { zero: true })); } catch { return sum; }
  }, 0);

  const save = async () => {
    try {
      setSaving(true);
      const items = expenses.map((category) => {
        const amountMinor = Number(parseMoney(values[category.id] || '0', { zero: true }));
        return { categoryId: category.id, amountMinor, enabled: amountMinor > 0 };
      });
      await saveCycleBudget(db, snapshot.cycle.id, items, updateDefault);
      await refresh();
      router.back();
    } catch (reason) {
      Alert.alert('预算没有保存', reason instanceof Error ? reason.message : '请检查金额');
    } finally {
      setSaving(false);
    }
  };

  const groups = [...new Set(expenses.map((category) => category.groupName))];

  return (
    <AppScreen>
      <PageHeader
        title="编辑本期预算"
        subtitle="本期修改不会影响历史周期。你可以选择同步更新个人默认预算。"
        action={<Pressable accessibilityLabel="关闭" onPress={() => router.back()} style={styles.close}><Ionicons name="close" size={26} color={colors.text} /></Pressable>}
      />
      <Card style={[styles.total, { backgroundColor: colors.primarySoft }]}>
        <Text style={[styles.help, { color: colors.textSecondary }]}>调整后预算总额</Text>
        <Text style={[styles.totalMoney, { color: colors.primary }]}>{formatMoney(total)}</Text>
      </Card>
      {groups.map((group) => (
        <View key={group} style={styles.group}>
          <Text style={[styles.groupName, { color: colors.textSecondary }]}>{group}</Text>
          <Card style={styles.items}>
            {expenses.filter((category) => category.groupName === group).map((category) => (
              <View key={category.id} style={styles.row}>
                <Text style={[styles.name, { color: colors.text }]}>{category.name}</Text>
                <View style={[styles.inputWrap, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.textSecondary }}>¥</Text>
                  <TextInput
                    value={values[category.id] ?? ''}
                    onChangeText={(value) => setValues((current) => ({ ...current, [category.id]: value }))}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.input, { color: colors.text }]}
                  />
                </View>
              </View>
            ))}
          </Card>
        </View>
      ))}
      <Card style={styles.defaultRow}>
        <View style={styles.defaultText}>
          <Text style={[styles.name, { color: colors.text }]}>同时更新个人默认预算</Text>
          <Text style={[styles.help, { color: colors.textSecondary }]}>开启后，今后新建周期会使用这组金额；历史周期不变。</Text>
        </View>
        <Switch value={updateDefault} onValueChange={setUpdateDefault} trackColor={{ true: colors.primary }} />
      </Card>
      <Pressable disabled={saving} onPress={() => void save()} style={[styles.save, { backgroundColor: colors.primary, opacity: saving ? 0.5 : 1 }]}>
        <Text style={styles.saveText}>{saving ? '正在保存…' : '保存本期预算'}</Text>
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  total: { gap: spacing.xs },
  totalMoney: { fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'] },
  help: { fontSize: 12, lineHeight: 18 },
  group: { gap: spacing.sm },
  groupName: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  items: { gap: spacing.sm },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { flex: 1, fontSize: 14, fontWeight: '800' },
  inputWrap: { width: 140, minHeight: 46, borderWidth: 1, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  input: { flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
  defaultRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  defaultText: { flex: 1, gap: spacing.xs },
  save: { minHeight: 54, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
});
