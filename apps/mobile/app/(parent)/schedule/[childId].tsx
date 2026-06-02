import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearner } from "@/hooks/useLearners";
import { useLessonSessions } from "@/hooks/useGradebook";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { Card } from "@/components/ui";
import { TrendChart, LoadingState } from "@aivo/mobile-ui";
import { lessonsByDay, splitLessons } from "@/lib/gradebook-logic";
import { subjectAccent } from "@/lib/subject-display";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Parent schedule (MOB-PAR-021) — mirror of web's `/parent/schedule`,
 * scoped to one child. Active lessons + a weekly activity trend from
 * learning-svc session history.
 */
export default function ParentScheduleScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  // Warm the learner cache for child-scoped screens; value not rendered here.
  useLearner(childId ?? "");
  const { data: sessions, isLoading } = useLessonSessions(childId ?? "");
  const trend = useMemo(() => lessonsByDay(sessions ?? []), [sessions]);
  const active = useMemo(() => splitLessons(sessions ?? []).inProgress, [sessions]);

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("parentSchedule.title", "Schedule")} />
      {isLoading ? (
        <LoadingState />
      ) : (
        <View style={{ gap: spacing.md }}>
          <Card tone="raised" style={{ gap: spacing.sm }}>
            <Text style={[styles.sectionTitle, { color: palette.ink }]}>
              {t("parentSchedule.thisWeek", "This week")}
            </Text>
            <TrendChart data={trend} ariaLabel={t("parentSchedule.trendAria", "Lessons per day")} />
          </Card>

          <Card tone="raised" style={{ gap: spacing.sm }}>
            <Text style={[styles.sectionTitle, { color: palette.ink }]}>
              {t("parentSchedule.active", "In progress")}
            </Text>
            {active.length === 0 ? (
              <Text style={[styles.empty, { color: palette.inkMuted }]}>
                {t("parentSchedule.noneActive", "Nothing in progress right now.")}
              </Text>
            ) : (
              active.map((s) => (
                <View key={s.id} style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: subjectAccent(s.subject) }]} />
                  <Text style={[styles.subject, { color: palette.ink }]}>{s.subject}</Text>
                  <Text style={[styles.tag, { color: palette.inkMuted }]}>
                    {t("parentSchedule.inProgress", "In progress")}
                  </Text>
                </View>
              ))
            )}
          </Card>
        </View>
      )}
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 16, fontFamily: fontFamilies.displayBold },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  subject: { flex: 1, fontSize: 15, fontFamily: fontFamilies.bodyBold },
  tag: { fontSize: 12, fontFamily: fontFamilies.bodyRegular },
  empty: { fontSize: 14, fontFamily: fontFamilies.bodyRegular },
});
