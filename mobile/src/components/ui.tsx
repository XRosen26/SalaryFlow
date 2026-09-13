import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextStyle,
  type StyleProp,
  View,
  type ViewStyle,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { formatMoney } from "@/domain/money";
import { radius, spacing, useAppTheme } from "@/constants/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

export function AppScreen({
  children,
  scroll = true,
}: PropsWithChildren<{ scroll?: boolean }>) {
  const colors = useAppTheme();
  const insets = useSafeAreaInsets();
  const content = (
    <View style={[styles.screenContent, { paddingBottom: insets.bottom + 96 }]}>
      {children}
    </View>
  );
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const colors = useAppTheme();
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {eyebrow ? (
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            {eyebrow}
          </Text>
        ) : null}
        <Text
          accessibilityRole="header"
          style={[styles.pageTitle, { color: colors.text }]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const colors = useAppTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionHeader({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  const colors = useAppTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {action ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onPress}>
          <Text style={[styles.sectionAction, { color: colors.primary }]}>
            {action} ›
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function IconButton({
  name,
  label,
  onPress,
  selected = false,
}: {
  name: IconName;
  label: string;
  onPress?: () => void;
  selected?: boolean;
}) {
  const colors = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <Ionicons
        name={name}
        size={21}
        color={selected ? "#FFFFFF" : colors.primary}
      />
      <Text
        style={[
          styles.iconButtonLabel,
          { color: selected ? "#FFFFFF" : colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function MoneyAmount({
  value,
  hidden = false,
  size = 28,
  color,
  style,
}: {
  value: number;
  hidden?: boolean;
  size?: number;
  color?: string;
  style?: TextStyle;
}) {
  const colors = useAppTheme();
  return (
    <Text
      selectable={!hidden}
      accessibilityLabel={hidden ? "金额已隐藏" : formatMoney(value)}
      style={[
        styles.money,
        { color: color ?? colors.text, fontSize: size },
        style,
      ]}
    >
      {formatMoney(value, hidden)}
    </Text>
  );
}

export function ProgressBar({
  value,
  color,
}: {
  value: number;
  color: string;
}) {
  const colors = useAppTheme();
  const width = `${Math.min(100, Math.max(0, value * 100))}%` as const;
  return (
    <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
      <View style={[styles.progress, { backgroundColor: color, width }]} />
    </View>
  );
}

export function Pill({ text, color }: { text: string; color?: string }) {
  const colors = useAppTheme();
  const tint = color ?? colors.primary;
  return (
    <View style={[styles.pill, { backgroundColor: `${tint}18` }]}>
      <Text style={[styles.pillText, { color: tint }]}>{text}</Text>
    </View>
  );
}

export function LoadingState({ error }: { error?: string | null }) {
  const colors = useAppTheme();
  return (
    <View style={styles.loading}>
      {error ? (
        <Ionicons
          name="alert-circle-outline"
          size={32}
          color={colors.expense}
        />
      ) : (
        <ActivityIndicator color={colors.primary} />
      )}
      <Text
        style={[
          styles.loadingText,
          { color: error ? colors.expense : colors.textSecondary },
        ]}
      >
        {error ?? "正在打开本地账本…"}
      </Text>
    </View>
  );
}

export function Divider() {
  const colors = useAppTheme();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1 },
  scroll: { flexGrow: 1 },
  screenContent: {
    width: "100%",
    maxWidth: 980,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headerText: { flex: 1, gap: spacing.xs },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  pageTitle: {
    fontSize: 28,
    lineHeight: 35,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  subtitle: { fontSize: 14, lineHeight: 21 },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 32,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  sectionAction: {
    fontSize: 14,
    fontWeight: "700",
    paddingVertical: spacing.sm,
  },
  iconButton: {
    minHeight: 72,
    minWidth: 72,
    flex: 1,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  iconButtonLabel: { fontSize: 13, fontWeight: "700" },
  money: {
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.6,
  },
  track: { height: 7, borderRadius: radius.pill, overflow: "hidden" },
  progress: { height: "100%", borderRadius: radius.pill },
  pill: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  pillText: { fontSize: 11, fontWeight: "700" },
  loading: {
    flex: 1,
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  loadingText: { fontSize: 14 },
  divider: { height: StyleSheet.hairlineWidth, width: "100%" },
});
