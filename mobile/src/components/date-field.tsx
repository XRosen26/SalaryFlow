import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { radius, spacing, useAppTheme } from "@/constants/theme";
import { monthDay, normalizeDateInput, today } from "@/domain/dates";

const weekNames = ["日", "一", "二", "三", "四", "五", "六"];

type DateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
  style?: StyleProp<ViewStyle>;
  optional?: boolean;
};

function monthCells(monthStart: string) {
  const [year, month] = monthStart.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const leading = first.getUTCDay();
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return [
    ...Array.from({ length: leading }, () => null),
    ...Array.from(
      { length: days },
      (_, index) =>
        `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`,
    ),
  ];
}

export function DateField({
  value,
  onChange,
  label,
  hint = "可直接输入：2026-09-13、2026年9月13日或20260913",
  style,
  optional = false,
}: DateFieldProps) {
  const colors = useAppTheme();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => `${today().slice(0, 7)}-01`);
  const [error, setError] = useState("");
  const cells = useMemo(() => monthCells(month), [month]);
  const selected = useMemo(() => {
    try {
      return normalizeDateInput(value);
    } catch {
      return "";
    }
  }, [value]);
  const [year, monthNumber] = month.split("-").map(Number);

  const normalize = () => {
    if (optional && !value.trim()) { setError(""); return ""; }
    try {
      const next = normalizeDateInput(value);
      onChange(next);
      setError("");
      return next;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "日期无效");
      return null;
    }
  };
  const showCalendar = () => {
    Keyboard.dismiss();
    let anchor = today();
    try {
      anchor = normalizeDateInput(value);
    } catch {
      // Invalid unfinished text stays in the field; calendar starts from today.
    }
    setMonth(`${anchor.slice(0, 7)}-01`);
    setOpen(true);
  };
  const moveMonth = (delta: number) => {
    setMonth(monthDay(year, monthNumber - 1 + delta, 1));
  };
  const choose = (next: string) => {
    onChange(next);
    setError("");
    setOpen(false);
  };

  return (
    <View style={[styles.field, style]}>
      {label ? (
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      ) : null}
      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={(next) => {
            onChange(next);
            if (error) setError("");
          }}
          onBlur={normalize}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textSecondary}
          returnKeyType="done"
          onSubmitEditing={() => {
            normalize();
            Keyboard.dismiss();
          }}
          accessibilityLabel={label ?? "日期"}
          style={[
            styles.input,
            {
              color: colors.text,
              backgroundColor: colors.surface,
              borderColor: error ? colors.expense : colors.border,
            },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="打开日期选择"
          hitSlop={4}
          onPress={showCalendar}
          style={({ pressed }) => [
            styles.calendarButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Ionicons name="calendar-outline" size={22} color={colors.primary} />
        </Pressable>
      </View>
      <Text
        style={[
          styles.hint,
          { color: error ? colors.expense : colors.textSecondary },
        ]}
      >
        {error || hint}
      </Text>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭日期选择"
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          />
          <View
            accessibilityViewIsModal
            style={[
              styles.dialog,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.monthHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="上个月"
                onPress={() => moveMonth(-1)}
                style={styles.monthButton}
              >
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </Pressable>
              <Text style={[styles.monthTitle, { color: colors.text }]}>
                {year}年{monthNumber}月
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="下个月"
                onPress={() => moveMonth(1)}
                style={styles.monthButton}
              >
                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color={colors.text}
                />
              </Pressable>
            </View>
            <View style={styles.weekRow}>
              {weekNames.map((name) => (
                <Text
                  key={name}
                  style={[styles.weekName, { color: colors.textSecondary }]}
                >
                  {name}
                </Text>
              ))}
            </View>
            <View style={styles.days}>
              {cells.map((day, index) => {
                const active = day === selected;
                const isToday = day === today();
                return (
                  <View key={day ?? `blank-${index}`} style={styles.dayCell}>
                    {day ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`选择${day}`}
                        onPress={() => choose(day)}
                        style={[
                          styles.dayButton,
                          active && { backgroundColor: colors.primary },
                          !active &&
                            isToday && {
                              borderColor: colors.primary,
                              borderWidth: 1,
                            },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            { color: active ? "#FFFFFF" : colors.text },
                          ]}
                        >
                          {Number(day.slice(-2))}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setOpen(false)}
                style={styles.footerButton}
              >
                <Text
                  style={[styles.footerText, { color: colors.textSecondary }]}
                >
                  取消
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => choose(today())}
                style={styles.footerButton}
              >
                <Text style={[styles.footerText, { color: colors.primary }]}>
                  今天
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  label: { fontSize: 15, fontWeight: "800" },
  inputRow: { flexDirection: "row", gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 15,
  },
  calendarButton: {
    width: 50,
    height: 50,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { fontSize: 11, lineHeight: 17 },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  dialog: {
    width: "100%",
    maxWidth: 380,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.lg,
    elevation: 12,
    gap: spacing.md,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitle: { fontSize: 17, fontWeight: "900" },
  weekRow: { flexDirection: "row" },
  weekName: { width: "14.2857%", textAlign: "center", fontSize: 12 },
  days: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: "14.2857%",
    height: 43,
    alignItems: "center",
    justifyContent: "center",
  },
  dayButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: { fontSize: 14, fontWeight: "700" },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  footerButton: { minWidth: 64, minHeight: 44, justifyContent: "center" },
  footerText: { textAlign: "center", fontSize: 14, fontWeight: "800" },
});
