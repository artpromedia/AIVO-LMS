import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useConnectedLearners } from "@/hooks/useFamily";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { Card } from "@/components/ui";
import { EmptyState, LoadingState } from "@aivo/mobile-ui";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

interface StudentLite {
  id: string;
  firstName?: string;
  lastName?: string;
  gradeLevel?: string;
}

/**
 * Teacher roster (MOB-TCH-001) — mirror of web's `/teacher/learners`.
 * A dedicated list of the students linked to the teacher, each routing
 * into that student's profile.
 */
export default function TeacherLearnersScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { data, isLoading } = useConnectedLearners();
  const students = (data as StudentLite[] | undefined) ?? [];

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t("common.back", "Back")}
          hitSlop={8}
          style={[
            styles.backBtn,
            { backgroundColor: palette.bgRaised, borderColor: palette.border },
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={palette.ink} />
        </Pressable>
        <Text style={[styles.title, { color: palette.ink }]}>
          {t("teacherLearners.title", "Students")}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {isLoading ? (
        <LoadingState />
      ) : students.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="people-outline" size={48} color={palette.inkMuted} />}
          title={t("teacher.noStudentsTitle", "No students yet")}
          message={t("teacher.noStudentsMessage", "Students you're linked to will appear here.")}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {students.map((s) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={`${s.firstName ?? ""} ${s.lastName ?? ""}`}
              onPress={() => router.push(`/(teacher)/student/${s.id}` as Href)}
            >
              <Card tone="raised" style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: palette.accentSoft }]}>
                  <Text style={[styles.initial, { color: palette.accent }]}>
                    {s.firstName?.[0] ?? "S"}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: palette.ink }]}>
                    {s.firstName} {s.lastName}
                  </Text>
                  {s.gradeLevel ? (
                    <Text style={[styles.meta, { color: palette.inkMuted }]}>
                      {t("common.grade", {
                        grade: s.gradeLevel,
                        defaultValue: `Grade ${s.gradeLevel}`,
                      })}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={20} color={palette.inkMuted} />
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 22, fontFamily: fontFamilies.displayBold },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: 20, fontFamily: fontFamilies.displayBold },
  name: { fontSize: 16, fontFamily: fontFamilies.bodyBold },
  meta: { fontSize: 13, fontFamily: fontFamilies.bodyRegular, marginTop: 2 },
});
