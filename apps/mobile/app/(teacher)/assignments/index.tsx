import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { Card } from "@/components/ui";
import { EmptyState } from "@aivo/mobile-ui";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { useTeacherAssignments } from "@/hooks/useTeacher";

/**
 * Teacher assignments (MOB-TCH-006) — mirror of web's
 * /teacher/assignments. Lists assignments with a create entry point.
 */
export default function TeacherAssignmentsScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { items } = useTeacherAssignments();

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("teacherAssignments.title", "Assignments")} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("teacherAssignments.new", "New assignment")}
        onPress={() => router.push("/(teacher)/assignments/new" as Href)}
        style={[styles.newBtn, { borderColor: palette.primary }]}
      >
        <Ionicons name="add-circle-outline" size={20} color={palette.primary} />
        <Text style={[styles.newText, { color: palette.primary }]}>
          {t("teacherAssignments.new", "New assignment")}
        </Text>
      </Pressable>

      {items.length === 0 ? (
        <View style={{ marginTop: spacing.md }}>
          <EmptyState
            icon={<Ionicons name="clipboard-outline" size={48} color={palette.inkMuted} />}
            title={t("teacherAssignments.emptyTitle", "No assignments yet")}
            message={t("teacherAssignments.emptyBody", "Create an assignment to get started.")}
          />
        </View>
      ) : (
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          {items.map((a) => (
            <Card key={a.id} tone="raised" style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: palette.ink }]}>{a.title}</Text>
                <Text style={[styles.meta, { color: palette.inkMuted }]}>
                  {a.subject}{a.dueDate ? ` · ${t("teacherAssignments.due", "due")} ${a.dueDate}` : ""}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: palette.accentSoft }]}>
                <Text style={[styles.badgeText, { color: palette.accent }]}>{a.status}</Text>
              </View>
            </Card>
          ))}
        </View>
      )}
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  newBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5 },
  newText: { fontSize: 15, fontFamily: fontFamilies.bodyBold },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { fontSize: 15, fontFamily: fontFamilies.bodyBold },
  meta: { fontSize: 13, fontFamily: fontFamilies.bodyRegular, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontFamily: fontFamilies.bodyBold, textTransform: "capitalize" },
});
