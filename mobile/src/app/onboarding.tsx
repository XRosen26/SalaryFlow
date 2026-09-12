import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { AppScreen, Card, LoadingState, PageHeader } from '@/components/ui';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { useFinance } from '@/data/finance-context';
import { finishOnboarding, type BudgetBasis } from '@/data/repository';
import { parseMoney } from '@/domain/money';

export default function OnboardingScreen() {
  const colors = useAppTheme();
  const router = useRouter();
  const db = useSQLiteContext();
  const { snapshot, error, refresh } = useFinance();
  const [basis, setBasis] = useState<BudgetBasis>('SALARY');
  const [payday, setPayday] = useState('10');
  const [amountsVisible, setAmountsVisible] = useState(true);
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (!snapshot) return <AppScreen><LoadingState error={error} /></AppScreen>;

  const complete = async () => {
    try {
      const paydayNumber = Number(payday);
      const openingBalances = Object.fromEntries(snapshot.accounts.map((account) => [
        account.id,
        balances[account.id]?.trim() ? Number(parseMoney(balances[account.id], { zero: true })) : 0,
      ]));
      setSaving(true);
      await finishOnboarding(db, { budgetBasis: basis, payday: paydayNumber, amountsVisible, openingBalances });
      await refresh();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)' as never);
    } catch (reason) {
      Alert.alert('请检查设置', reason instanceof Error ? reason.message : '首次设置没有保存');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppScreen>
      <View style={[styles.brand, { backgroundColor: colors.primary }]}>
        <Ionicons name="wallet-outline" size={32} color="#FFFFFF" />
      </View>
      <PageHeader
        eyebrow="欢迎使用薪流"
        title="先确定你的预算节奏"
        subtitle="这些设置以后仍可修改。当前步骤不会读取或上传桌面端数据。"
      />

      <View style={styles.section}>
        <Text style={[styles.step, { color: colors.primary }]}>01 · 预算周期</Text>
        <View style={styles.optionGrid}>
          {([
            ['SALARY', '按照工资周期', '从工资日到下个工资日前一天，适合发薪后分配资金。'],
            ['CALENDAR_MONTH', '按照自然月', '每月 1 日到月末，适合按月对账。'],
          ] as const).map(([value, title, description]) => {
            const selected = basis === value;
            return (
              <Pressable key={value} onPress={() => setBasis(value)} style={styles.optionPressable}>
                <Card style={[styles.option, selected && { borderColor: colors.primary, borderWidth: 2 }]}>
                  <View style={styles.optionTitle}>
                    <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.optionName, { color: colors.text }]}>{title}</Text>
                  </View>
                  <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>{description}</Text>
                </Card>
              </Pressable>
            );
          })}
        </View>
        {basis === 'SALARY' ? (
          <View style={styles.inlineField}>
            <View style={styles.inlineText}>
              <Text style={[styles.fieldTitle, { color: colors.text }]}>每月工资日</Text>
              <Text style={[styles.help, { color: colors.textSecondary }]}>遇到短月时自动使用当月最后一天</Text>
            </View>
            <TextInput
              value={payday}
              onChangeText={setPayday}
              keyboardType="number-pad"
              maxLength={2}
              style={[styles.dayInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={[styles.step, { color: colors.primary }]}>02 · 当前账户余额</Text>
        <Text style={[styles.help, { color: colors.textSecondary }]}>填写今天真实可用的余额；不确定可以留空，以后再校准。转账不会增加总资产。</Text>
        <Card style={styles.balanceCard}>
          {snapshot.accounts.map((account) => (
            <View key={account.id} style={styles.balanceRow}>
              <View style={styles.balanceText}>
                <Text style={[styles.fieldTitle, { color: colors.text }]}>{account.name}</Text>
                <Text style={[styles.help, { color: colors.textSecondary }]}>{account.typeName}</Text>
              </View>
              <View style={[styles.moneyInputWrap, { borderColor: colors.border }]}>
                <Text style={{ color: colors.textSecondary }}>¥</Text>
                <TextInput
                  value={balances[account.id] ?? ''}
                  onChangeText={(value) => setBalances((current) => ({ ...current, [account.id]: value }))}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.moneyInput, { color: colors.text }]}
                />
              </View>
            </View>
          ))}
        </Card>
      </View>

      <View style={styles.section}>
        <Text style={[styles.step, { color: colors.primary }]}>03 · 屏幕隐私</Text>
        <Card style={styles.privacy}>
          <View style={styles.inlineText}>
            <Text style={[styles.fieldTitle, { color: colors.text }]}>默认显示金额</Text>
            <Text style={[styles.help, { color: colors.textSecondary }]}>可随时用首页眼睛按钮整体隐藏，也可单独隐藏账户。</Text>
          </View>
          <Switch value={amountsVisible} onValueChange={setAmountsVisible} trackColor={{ true: colors.primary }} />
        </Card>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={saving}
        onPress={() => void complete()}
        style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary, opacity: saving ? 0.5 : pressed ? 0.75 : 1 }]}>
        <Text style={styles.primaryText}>{saving ? '正在建立账本…' : '完成设置，开始使用'}</Text>
        <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
      </Pressable>
      <Text style={[styles.local, { color: colors.textSecondary }]}>离线可用 · 无需登录 · 数据保存在本机</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  brand: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  section: { gap: spacing.md },
  step: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  optionGrid: { gap: spacing.md },
  optionPressable: { flex: 1 },
  option: { gap: spacing.sm },
  optionTitle: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  optionName: { fontSize: 16, fontWeight: '900' },
  optionDescription: { fontSize: 13, lineHeight: 20 },
  inlineField: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  inlineText: { flex: 1, gap: 3 },
  fieldTitle: { fontSize: 15, fontWeight: '800' },
  help: { fontSize: 12, lineHeight: 18 },
  dayInput: { width: 76, height: 48, borderWidth: 1, borderRadius: radius.md, textAlign: 'center', fontSize: 18, fontWeight: '800' },
  balanceCard: { gap: spacing.sm },
  balanceRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  balanceText: { flex: 1, gap: 2 },
  moneyInputWrap: { width: 142, minHeight: 46, borderWidth: 1, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  moneyInput: { flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  primary: { minHeight: 56, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  local: { textAlign: 'center', fontSize: 12 },
});
