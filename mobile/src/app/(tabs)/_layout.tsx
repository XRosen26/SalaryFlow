import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/constants/theme';

const icons = {
  index: ['home-outline', 'home'],
  transactions: ['swap-horizontal-outline', 'swap-horizontal'],
  add: ['add', 'add'],
  budgets: ['pie-chart-outline', 'pie-chart'],
  accounts: ['wallet-outline', 'wallet'],
} as const;

export default function TabsLayout() {
  const colors = useAppTheme();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: [styles.tabBar, { backgroundColor: colors.surface, borderTopColor: colors.border }],
        tabBarLabelStyle: styles.label,
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: colors.background },
        tabBarIcon: ({ color, focused, size }) => {
          const names = icons[route.name as keyof typeof icons] ?? icons.index;
          if (route.name === 'add') {
            return (
              <View style={[styles.addIcon, { backgroundColor: colors.primary }]}>
                <Ionicons name="add" size={28} color="#FFFFFF" />
              </View>
            );
          }
          return <Ionicons name={names[focused ? 1 : 0]} size={size} color={color} />;
        },
      })}>
      <Tabs.Screen name="index" options={{ title: '首页' }} />
      <Tabs.Screen name="transactions" options={{ title: '明细' }} />
      <Tabs.Screen name="add" options={{ title: '记一笔' }} />
      <Tabs.Screen name="budgets" options={{ title: '预算' }} />
      <Tabs.Screen name="accounts" options={{ title: '账户' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: { height: 72, paddingTop: 7, paddingBottom: 9, borderTopWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 11, fontWeight: '700' },
  addIcon: { width: 48, height: 48, marginTop: -18, borderRadius: 24, alignItems: 'center', justifyContent: 'center', elevation: 5 },
});
