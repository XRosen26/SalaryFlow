import { Stack, useRouter, useSegments } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  AppThemeProvider,
  type PaletteName,
  type ThemeMode,
  useResolvedThemeMode,
} from "@/constants/theme";
import { FinanceProvider, useFinance } from "@/data/finance-context";
import { initializeDatabase } from "@/data/repository";

function Navigator() {
  const router = useRouter();
  const segments = useSegments();
  const { snapshot } = useFinance();

  useEffect(() => {
    if (!snapshot) return;
    const inOnboarding = segments[0] === "onboarding";
    if (!snapshot.settings.onboardingComplete && !inOnboarding)
      router.replace("/onboarding" as never);
    if (snapshot.settings.onboardingComplete && inOnboarding)
      router.replace("/(tabs)" as never);
  }, [router, segments, snapshot]);

  return (
    <Stack
      screenOptions={{ headerShown: false, animation: "slide_from_right" }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="help" />
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
    </Stack>
  );
}

function ThemedContent() {
  const resolvedMode = useResolvedThemeMode();
  return (
    <>
      <StatusBar style={resolvedMode === "dark" ? "light" : "dark"} />
      <Navigator />
    </>
  );
}

function ThemedApplication() {
  const { snapshot } = useFinance();
  const palette = (snapshot?.settings.palette ?? "forest") as PaletteName;
  const mode = (snapshot?.settings.themeMode ?? "system") as ThemeMode;
  return (
    <AppThemeProvider palette={palette} mode={mode}>
      <ThemedContent />
    </AppThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SQLiteProvider
        databaseName="salaryflow-mobile.db"
        onInit={initializeDatabase}
      >
        <FinanceProvider>
          <ThemedApplication />
        </FinanceProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
