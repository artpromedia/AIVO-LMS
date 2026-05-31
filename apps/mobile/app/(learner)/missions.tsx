import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useLessonSessions } from "@/hooks/useGradebook";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { Card } from "@/components/ui";
import { EmptyState, LoadingState } from "@aivo/mobile-ui";
import { splitLessons } from "@/lib/gradebook-logic";
import { subjectAccent } from "@/lib/subject-display";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Learner missions (MOB-LRN-008) — mirror of web's `/learner/missions`.
 * Lessons in progress that the learner can jump back into, from real
 * learning-svc session history.
 */
export default function LearnerMissionsScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const palette = useSensoryPalette();
  const { data: sessions, isLoading } = useLessonSessions(user?.id ?? "");
  const inProgress = useMemo(() => splitLessons(sessions ?? []).inProgress, [sessions]);

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
          {t("missions.title", "Missions")}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {isLoading ? (
        <LoadingState />
      ) : inProgress.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="rocket-outline" size={48} color={palette.inkMuted} />}
          title={t("missions.emptyTitle", "All caught up!")}
          message={t("missions.emptyBody", "Start a lesson and your missions show up here.")}
          actionLabel={t("missions.start", "Start a lesson")}
          onAction={() => router.push("/(learner)/quests" as Href)}
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {inProgress.map((s) => {
            const accent = subjectAccent(s.subject);
            return (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                accessibilityLabel={t("missions.continue", {
                  subject: s.subject,
                  defaultValue: `Continue ${s.subject}`,
                })}
                onPress={() => router.push(`/(learner)/stage/${s.id}` as Href)}
              >
                <Card tone="raised" style={styles.row}>
                  <View style={[styles.icon, { backgroundColor: `${accent}1A` }]}>
                    <Ionicons name="flag" size={20} color={accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.subject, { color: palette.ink }]}>{s.subject}</Text>
                    <Text style={[styles.meta, { color: palette.inkMuted }]}>
                      {t("missions.inProgress", "In progress")}
                    </Text>
                  </View>
                  <View style={[styles.continueBtn, { backgroundColor: accent }]}>
                    <Text style={styles.continueText}>{t("missions.go", "Go")}</Text>
                  </View>
                </Card>
              </Pressable>
            );
          })}
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
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  subject: { fontSize: 16, fontFamily: fontFamilies.bodyBold },
  meta: { fontSize: 13, fontFamily: fontFamilies.bodyRegular, marginTop: 2 },
  continueBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.full },
  continueText: { color: "#fff", fontSize: 13, fontFamily: fontFamilies.bodyBold },
});
