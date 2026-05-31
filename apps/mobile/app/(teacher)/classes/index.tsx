import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useConnectedLearners } from "@/hooks/useFamily";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { Card } from "@/components/ui";
import { EmptyState, LoadingState } from "@aivo/mobile-ui";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

interface S { id: string; gradeLevel?: string }

/**
 * Teacher classes (MOB-TCH-004) — mirror of web's /teacher/classes.
 * Groups the teacher's students into class bands by grade.
 */
export default function TeacherClassesScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { data, isLoading } = useConnectedLearners();
  const students = (data as S[] | undefined) ?? [];
  const classes = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of students) {
      const g = s.gradeLevel || "—";
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [students]);

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("teacherClasses.title", "Classes")} />
      {isLoading ? (
        <LoadingState />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="people-outline" size={48} color={palette.inkMuted} />}
          title={t("teacherClasses.emptyTitle", "No classes yet")}
          message={t("teacherClasses.emptyBody", "Students you teach will be grouped into classes here.")}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {classes.map(([grade, count]) => (
            <Pressable
              key={grade}
              accessibilityRole="button"
              accessibilityLabel={t("teacherClasses.grade", { grade, defaultValue: `Grade ${grade}` })}
              onPress={() => router.push(`/(teacher)/classes/${encodeURIComponent(grade)}` as Href)}
            >
              <Card tone="raised" style={styles.row}>
                <View style={[styles.iconWrap, { backgroundColor: palette.accentSoft }]}>
                  <Ionicons name="school" size={20} color={palette.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: palette.ink }]}>
                    {t("teacherClasses.grade", { grade, defaultValue: `Grade ${grade}` })}
                  </Text>
                  <Text style={[styles.meta, { color: palette.inkMuted }]}>
                    {t("teacherClasses.count", { count, defaultValue: `${count} students` })}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={palette.inkMuted} />
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 16, fontFamily: fontFamilies.bodyBold },
  meta: { fontSize: 13, fontFamily: fontFamilies.bodyRegular, marginTop: 2 },
});
