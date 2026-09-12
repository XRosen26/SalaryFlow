import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppScreen, Card, Divider, LoadingState, MoneyAmount, PageHeader } from '@/components/ui';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { useFinance } from '@/data/finance-context';
import type { TransactionItem } from '@/data/repository';

type Filter = 'ALL' | TransactionItem['kind'];
const filters: { id: Filter; label: string }[] = [
  { id: 'ALL', label: '全部' },
  { id: 'EXPENSE', label: '支出' },
  { id: 'INCOME', label: '收入' },
  { id: 'TRANSFER', label: '转账' },
  { id: 'REFUND', label: '退款' },
];

export default function TransactionsScreen() {
  const colors = useAppTheme();
  const router = useRouter();
  const { snapshot, error } = useFinance();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    if (!snapshot) return [];
    const needle = query.trim().toLowerCase();
    return snapshot.transactions.filter((item) => {
      if (filter !== 'ALL' && item.kind !== filter) return false;
      if (!needle) return true;
      return [item.categoryName, item.sourceName, item.destinationName, item.note, item.date]
        .some((value) => value?.toLowerCase().includes(needle));
    });
  }, [filter, query, snapshot]);

  if (!snapshot) return <AppScreen><LoadingState error={error} /></AppScreen>;
  const hidden = !snapshot.settings.amountsVisible;

  return (
    <AppScreen>
      <PageHeader title="交易明细" subtitle="按实际发生日期保存，一笔记录只统计一次。" />
      <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="搜索分类、账户、备注或日期"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { color: colors.text }]}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} accessibilityLabel="清空搜索">
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.filters}>
        {filters.map((item) => {
          const active = filter === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setFilter(item.id)}
              style={[styles.filter, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}>
              <Text style={[styles.filterText, { color: active ? '#FFFFFF' : colors.text }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Card style={styles.list}>
        {rows.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={34} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>没有匹配的交易</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>换一个筛选条件，或从“记一笔”新增。</Text>
          </View>
        ) : rows.map((item, index) => {
          const positive = item.kind === 'INCOME' || item.kind === 'REFUND';
          const transfer = item.kind === 'TRANSFER';
          const title = transfer ? '账户转账' : item.categoryName ?? item.kind;
          const account = transfer ? `${item.sourceName} → ${item.destinationName}` : item.sourceName ?? item.destinationName;
          return (
            <View key={item.id}>
              {index ? <Divider /> : null}
              <Pressable onPress={() => router.push(`/transaction-detail?id=${item.id}` as never)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.68 }]}>
                <View style={[styles.icon, { backgroundColor: positive ? colors.primarySoft : colors.surfaceMuted }]}>
                  <Ionicons name={transfer ? 'swap-horizontal' : positive ? 'arrow-down' : 'arrow-up'} size={18} color={positive ? colors.income : colors.expense} />
                </View>
                <View style={styles.text}>
                  <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                  <Text numberOfLines={1} style={[styles.meta, { color: colors.textSecondary }]}>
                    {item.date} · {account}{item.note ? ` · ${item.note}` : ''}
                  </Text>
                </View>
                <MoneyAmount value={item.amountMinor} hidden={hidden} size={16} color={transfer ? colors.text : positive ? colors.income : colors.expense} />
              </Pressable>
            </View>
          );
        })}
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  search: { minHeight: 50, borderWidth: 1, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  input: { flex: 1, minHeight: 48, fontSize: 15 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filter: { minHeight: 40, paddingHorizontal: spacing.lg, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  filterText: { fontSize: 13, fontWeight: '700' },
  list: { paddingVertical: spacing.xs },
  row: { minHeight: 76, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 4 },
  title: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: spacing.sm },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyText: { fontSize: 13 },
});
