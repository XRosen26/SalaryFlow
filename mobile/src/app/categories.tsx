import { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import {
  AppScreen,
  Card,
  Divider,
  LoadingState,
  PageHeader,
} from "@/components/ui";
import { radius, spacing, useAppTheme } from "@/constants/theme";
import { useFinance } from "@/data/finance-context";
import {
  archiveCategory,
  deleteCategory,
  saveCategory,
  type Category,
} from "@/data/repository";

function Choice({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.choice,
        {
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? colors.primarySoft : colors.surface,
        },
      ]}
    >
      <Text
        style={{
          color: active ? colors.primary : colors.text,
          fontWeight: "800",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function CategoriesScreen() {
  const colors = useAppTheme();
  const db = useSQLiteContext();
  const { snapshot, error, refresh } = useFinance();
  const [kind, setKind] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [name, setName] = useState("");
  const [group, setGroup] = useState("其他");
  const [editing, setEditing] = useState<Category | null>(null);

  if (!snapshot)
    return (
      <AppScreen>
        <LoadingState error={error} />
      </AppScreen>
    );

  const reset = () => {
    setEditing(null);
    setName("");
    setGroup("其他");
  };
  const edit = (category: Category) => {
    setEditing(category);
    setKind(category.kind);
    setName(category.name);
    setGroup(category.groupName);
  };
  const save = async () => {
    try {
      await saveCategory(db, {
        id: editing?.id,
        kind,
        name,
        groupName: group,
      });
      await refresh();
      reset();
    } catch (reason) {
      Alert.alert(
        "无法保存分类",
        reason instanceof Error ? reason.message : "请检查输入",
      );
    }
  };
  const archive = (category: Category) =>
    Alert.alert(
      "归档分类？",
      "历史交易仍显示原分类名称；新交易和新预算不再显示该分类。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "归档",
          onPress: async () => {
            try {
              await archiveCategory(db, category.id);
              if (editing?.id === category.id) reset();
              await refresh();
            } catch (reason) {
              Alert.alert(
                "无法归档",
                reason instanceof Error ? reason.message : "请重试",
              );
            }
          },
        },
      ],
    );
  const remove = (category: Category) =>
    Alert.alert(
      "彻底删除分类？",
      "只有从未用于交易、预算或固定账单的分类可以删除。已有历史的分类请使用归档。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "确认删除",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCategory(db, category.id);
              if (editing?.id === category.id) reset();
              await refresh();
            } catch (reason) {
              Alert.alert(
                "无法删除",
                reason instanceof Error ? reason.message : "请重试",
              );
            }
          },
        },
      ],
    );

  return (
    <AppScreen>
      <PageHeader
        title="分类管理"
        subtitle="分类完全动态；不用的历史分类可以归档，未使用分类可以彻底删除。"
      />
      <Card style={styles.card}>
        <Text style={[styles.title, { color: colors.text }]}>
          {editing ? "修改分类" : "新增分类"}
        </Text>
        <View style={styles.wrap}>
          <Choice
            label="支出分类"
            active={kind === "EXPENSE"}
            onPress={() => !editing && setKind("EXPENSE")}
          />
          <Choice
            label="收入分类"
            active={kind === "INCOME"}
            onPress={() => !editing && setKind("INCOME")}
          />
        </View>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="分类名称"
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.input,
            { color: colors.text, borderColor: colors.border },
          ]}
        />
        <TextInput
          value={group}
          onChangeText={setGroup}
          placeholder="分组名称，例如：餐饮"
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.input,
            { color: colors.text, borderColor: colors.border },
          ]}
        />
        <View style={styles.wrap}>
          <Pressable
            onPress={() => void save()}
            style={[styles.save, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.saveText}>
              {editing ? "保存修改" : "新增分类"}
            </Text>
          </Pressable>
          {editing ? (
            <Pressable
              onPress={reset}
              style={[styles.cancel, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.text, fontWeight: "800" }}>
                取消编辑
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Card>

      {(["EXPENSE", "INCOME"] as const).map((type) => (
        <Card key={type} style={styles.list}>
          <Text style={[styles.title, { color: colors.text }]}>
            {type === "EXPENSE" ? "支出分类" : "收入分类"}
          </Text>
          {snapshot.categories
            .filter((category) => category.kind === type)
            .map((category, index) => (
              <View key={category.id}>
                {index ? <Divider /> : null}
                <View style={styles.row}>
                  <Pressable
                    onPress={() => edit(category)}
                    style={styles.categoryCopy}
                  >
                    <Text style={[styles.name, { color: colors.text }]}>
                      {category.name}
                    </Text>
                    <Text
                      style={[styles.meta, { color: colors.textSecondary }]}
                    >
                      {category.groupName} · 点击修改
                    </Text>
                  </Pressable>
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => archive(category)}
                      style={[styles.action, { borderColor: colors.border }]}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700" }}>
                        归档
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => remove(category)}
                      style={[styles.action, { borderColor: colors.expense }]}
                    >
                      <Text
                        style={{ color: colors.expense, fontWeight: "800" }}
                      >
                        删除
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
        </Card>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  title: { fontSize: 17, fontWeight: "900" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  choice: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 15,
  },
  save: {
    minHeight: 46,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: "#fff", fontWeight: "900" },
  cancel: {
    minHeight: 46,
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    borderRadius: radius.md,
    justifyContent: "center",
  },
  list: { paddingVertical: spacing.sm, gap: spacing.xs },
  row: {
    minHeight: 72,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  categoryCopy: { flex: 1, gap: 3 },
  actions: { flexDirection: "row", gap: spacing.xs },
  action: {
    minHeight: 38,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 15, fontWeight: "800" },
  meta: { fontSize: 12 },
});
