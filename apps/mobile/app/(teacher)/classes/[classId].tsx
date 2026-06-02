import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useConnectedLearners } from "@/hooks/useFamily";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { Card } from "@/components/ui";
import { EmptyState, LoadingState } from "@aivo/mobile-ui";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

interface S {
  id: string;
  firstName?: string;
  lastName?: string;
  gradeLevel?: string;
}

/**
 * Teacher class detail (MOB-TCH-005) — mirror of web's
 * /teacher/classes/[classId]. The roster for one grade band.
 */
export default function TeacherClassDetailScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const grade = decodeURIComponent(classId ?? "");
  const { data, isLoading } = useConnectedLearners();
  const roster = useMemo(
    () => ((data as S[] | undefined) ?? []).filter((s) => (s.gradeLevel || "—") === grade),
    [data, grade],
  );

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("teacherClasses.grade", { grade, defaultValue: `Grade ${grade}` })} />
      {isLoading ? (
        <LoadingState />
      ) : roster.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="people-outline" size={48} color={palette.inkMuted} />}
          title={t("teacherClasses.emptyRosterTitle", "No students in this class")}
          message={t("teacherClasses.emptyRosterBody", "Students appear here once enrolled.")}
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {roster.map((s) => (
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
                <Text style={[styles.name, { color: palette.ink }]}>
                  {s.firstName} {s.lastName}
                </Text>
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: 16, fontFamily: fontFamilies.displayBold },
  name: { flex: 1, fontSize: 15, fontFamily: fontFamilies.bodyBold },
});
