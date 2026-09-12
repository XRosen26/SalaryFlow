import { Stack, useRouter, useSegments } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FinanceProvider, useFinance } from '@/data/finance-context';
import { initializeDatabase } from '@/data/repository';

function Navigator() {
  const router = useRouter();
  const segments = useSegments();
  const { snapshot } = useFinance();

  useEffect(() => {
    if (!snapshot) return;
    const inOnboarding = segments[0] === 'onboarding';
    if (!snapshot.settings.onboardingComplete && !inOnboarding) router.replace('/onboarding' as never);
    if (snapshot.settings.onboardingComplete && inOnboarding) router.replace('/(tabs)' as never);
  }, [router, segments, snapshot]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName="salaryflow-mobile.db" onInit={initializeDatabase}>
        <FinanceProvider>
          <StatusBar style={dark ? 'light' : 'dark'} />
          <Navigator />
        </FinanceProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
