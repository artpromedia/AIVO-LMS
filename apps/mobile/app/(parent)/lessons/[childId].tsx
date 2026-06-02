import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearner } from "@/hooks/useLearners";
import { useLessonSessions } from "@/hooks/useGradebook";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { Card } from "@/components/ui";
import { LoadingState, EmptyState } from "@aivo/mobile-ui";
import { subjectAccent } from "@/lib/subject-display";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Parent lesson recaps (MOB-PAR-011) — mirror of web's
 * `/parent/learners/[learnerId]/lessons`. Plain-language per-lesson
 * recaps from learning-svc session history.
 */
export default function ParentLessonsScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const { data: learner } = useLearner(childId ?? "");
  const { data: sessions, isLoading } = useLessonSessions(childId ?? "");

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("parentLessons.title", "Lessons")} />

      {isLoading ? (
        <LoadingState />
      ) : !sessions || sessions.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="book-outline" size={48} color={palette.inkMuted} />}
          title={t("parentLessons.emptyTitle", "No lessons yet")}
          message={t("parentLessons.emptyBody", "Lesson recaps appear here as your child learns.")}
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {learner ? (
            <Text style={[styles.subtitle, { color: palette.inkMuted }]}>
              {t("parentLessons.for", {
                name: learner.firstName,
                defaultValue: `Recent lessons for ${learner.firstName}`,
              })}
            </Text>
          ) : null}
          {sessions.map((s) => {
            const accent = subjectAccent(s.subject);
            const done = Boolean(s.completedAt) || (s.status ?? "").toUpperCase() === "COMPLETED";
            return (
              <Card key={s.id} tone="raised" style={styles.card}>
                <View style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: accent }]} />
                  <Text style={[styles.subject, { color: palette.ink }]}>{s.subject}</Text>
                  <Text style={[styles.date, { color: palette.inkMuted }]}>
                    {fmtDate(s.completedAt ?? s.startedAt)}
                  </Text>
                </View>
                <Text style={[styles.recap, { color: palette.inkMuted }]}>
                  {done
                    ? t("parentLessons.completed", {
                        subject: s.subject,
                        xp: s.xpEarned ?? 0,
                        defaultValue: `Finished a ${s.subject} lesson and earned ${s.xpEarned ?? 0} XP.`,
                      })
                    : t("parentLessons.inProgress", {
                        subject: s.subject,
                        defaultValue: `Working through a ${s.subject} lesson.`,
                      })}
                </Text>
              </Card>
            );
          })}
        </View>
      )}
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 14, fontFamily: fontFamilies.bodyRegular, marginBottom: spacing.xs },
  card: { gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  subject: { flex: 1, fontSize: 15, fontFamily: fontFamilies.bodyBold },
  date: { fontSize: 12, fontFamily: fontFamilies.bodyRegular },
  recap: { fontSize: 14, fontFamily: fontFamilies.bodyRegular, lineHeight: 20 },
});
