import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { AppScreen, Card, LoadingState, PageHeader } from '@/components/ui';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { useFinance } from '@/data/finance-context';
import { archiveAccount, calibrateAccount, saveAccount, type AccountInput } from '@/data/repository';
import { today } from '@/domain/dates';
import { parseMoney } from '@/domain/money';

type Role = NonNullable<AccountInput['role']>;
const types: { id: AccountInput['typeId']; label: string }[] = [
  { id: 'bank', label: '银行/支付' },
  { id: 'cash', label: '现金' },
  { id: 'investment', label: '理财估值' },
];
const roles: { id: Role | ''; label: string }[] = [
  { id: '', label: '普通账户' },
  { id: 'PRIMARY_SPENDING', label: '主要消费' },
  { id: 'PRIMARY_SAVINGS', label: '主要储蓄' },
  { id: 'PRIMARY_SALARY', label: '工资账户' },
  { id: 'INVESTMENT', label: '理财账户' },
];

function Choice<T extends string>({ value, current, label, onChange }: { value: T; current: T; label: string; onChange: (value: T) => void }) {
  const colors = useAppTheme();
  const active = value === current;
  return (
    <Pressable onPress={() => onChange(value)} style={[styles.choice, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}>
      <Text style={[styles.choiceText, { color: active ? '#FFFFFF' : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export default function AccountEditorScreen() {
  const colors = useAppTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { snapshot, error, refresh } = useFinance();
  const existing = snapshot?.accounts.find((account) => account.id === params.id);
  const [name, setName] = useState('');
  const [typeId, setTypeId] = useState<AccountInput['typeId']>('bank');
  const [role, setRole] = useState<Role | ''>('');
  const [opening, setOpening] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setTypeId(existing.typeId);
    setCurrentBalance((existing.balanceMinor / 100).toFixed(2));
    setRole((existing.roles.find((item) => roles.some((roleOption) => roleOption.id === item)) as Role | undefined) ?? '');
  }, [existing]);

  if (!snapshot) return <AppScreen><LoadingState error={error} /></AppScreen>;

  const saveChanges = async (targetBalance?: number) => {
    try {
      setSaving(true);
      await saveAccount(db, {
        id: existing?.id,
        name,
        typeId,
        role: role || undefined,
        openingBalanceMinor: existing ? 0 : opening.trim() ? Number(parseMoney(opening, { zero: true })) : 0,
        startDate: today(),
        note,
      });
      if (existing && targetBalance !== undefined && targetBalance !== existing.balanceMinor)
        await calibrateAccount(db, existing.id, targetBalance, "用户确认调整当前余额");
      await refresh();
      router.back();
    } catch (reason) {
      Alert.alert('账户没有保存', reason instanceof Error ? reason.message : '请检查输入');
    } finally {
      setSaving(false);
    }
  };

  const submit = () => {
    if (!existing) return void saveChanges();
    try {
      const target = Number(parseMoney(currentBalance, { zero: true, signed: true }));
      if (target === existing.balanceMinor) return void saveChanges(target);
      const delta = target - existing.balanceMinor;
      Alert.alert(
        "确认调整账户余额",
        `当前余额将从 ¥ ${(existing.balanceMinor / 100).toFixed(2)} 调整为 ¥ ${(target / 100).toFixed(2)}。系统会记录一笔余额校准 ${delta >= 0 ? "+" : ""}¥ ${(delta / 100).toFixed(2)}，不会计入收入或支出。`,
        [
          { text: "取消", style: "cancel" },
          { text: "确认调整", onPress: () => void saveChanges(target) },
        ],
      );
    } catch (reason) {
      Alert.alert("余额无效", reason instanceof Error ? reason.message : "请检查输入");
    }
  };

  const archive = () => {
    if (!existing) return;
    Alert.alert('归档账户', '归档后历史交易仍保留，余额必须为 0。', [
      { text: '取消', style: 'cancel' },
      {
        text: '归档',
        style: 'destructive',
        onPress: () => void (async () => {
          try {
            await archiveAccount(db, existing.id);
            await refresh();
            router.back();
          } catch (reason) {
            Alert.alert('无法归档', reason instanceof Error ? reason.message : '请先处理账户余额');
          }
        })(),
      },
    ]);
  };

  return (
    <AppScreen>
      <PageHeader
        title={existing ? '编辑账户' : '新增账户'}
        subtitle="账户名称和角色可以修改；历史交易始终通过账户 ID 保持关联。"
        action={<Pressable accessibilityLabel="关闭" onPress={() => router.back()} style={styles.close}><Ionicons name="close" size={26} color={colors.text} /></Pressable>}
      />
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text }]}>账户名称</Text>
        <TextInput value={name} onChangeText={setName} placeholder="例如：招商银行工资卡" placeholderTextColor={colors.textSecondary} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
      </View>
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text }]}>账户类型</Text>
        <View style={styles.choices}>{types.map((item) => <Choice key={item.id} value={item.id} current={typeId} label={item.label} onChange={setTypeId} />)}</View>
      </View>
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text }]}>主要角色</Text>
        <Text style={[styles.help, { color: colors.textSecondary }]}>同一主要角色只保留一个账户；设置新账户时会自动取消旧账户的该角色。</Text>
        <View style={styles.choices}>{roles.map((item) => <Choice key={item.id || 'none'} value={item.id} current={role} label={item.label} onChange={setRole} />)}</View>
      </View>
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text }]}>{existing ? "调整当前余额" : "当前余额（可选）"}</Text>
        <TextInput value={existing ? currentBalance : opening} onChangeText={existing ? setCurrentBalance : setOpening} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textSecondary} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
        <Text style={[styles.help, { color: colors.textSecondary }]}>
          {existing ? "保存前会再次确认，并记录余额校准；校准不计入收入或支出。" : "作为期初余额保存，不计作收入。"}
        </Text>
      </View>
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text }]}>备注（可选）</Text>
        <TextInput value={note} onChangeText={setNote} placeholder="银行卡尾号、用途等" placeholderTextColor={colors.textSecondary} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
      </View>
      {typeId === 'investment' ? (
        <Card style={[styles.notice, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="trending-up-outline" size={22} color={colors.primary} />
          <Text style={[styles.noticeText, { color: colors.text }]}>理财账户以后通过市值快照更新；市值涨跌不会伪装成收入或支出。</Text>
        </Card>
      ) : null}
      <Pressable disabled={saving} onPress={submit} style={[styles.save, { backgroundColor: colors.primary, opacity: saving ? 0.5 : 1 }]}>
        <Text style={styles.saveText}>{saving ? '正在保存…' : '保存账户'}</Text>
      </Pressable>
      {existing ? <Pressable onPress={archive} style={[styles.archive, { borderColor: colors.expense }]}><Text style={[styles.archiveText, { color: colors.expense }]}>归档此账户</Text></Pressable> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  field: { gap: spacing.sm },
  label: { fontSize: 15, fontWeight: '800' },
  help: { fontSize: 12, lineHeight: 18 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 15 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: { minHeight: 42, borderWidth: 1, borderRadius: 21, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  choiceText: { fontSize: 13, fontWeight: '700' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  save: { minHeight: 54, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  archive: { minHeight: 50, borderWidth: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  archiveText: { fontSize: 14, fontWeight: '800' },
});
