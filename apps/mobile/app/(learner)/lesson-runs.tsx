import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { Card } from "@/components/ui";
import { LoadingState, EmptyState } from "@aivo/mobile-ui";
import { useLessonSessions, isLiveSession } from "@/hooks/useGradebook";
import { subjectAccent } from "@/lib/subject-display";
import type { LessonSession } from "@/lib/gradebook-logic";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Learner lesson-runs history — mobile parity for web's
 * `learner/lesson-runs`. A read-only history of the learner's recent
 * lesson sessions (learning-svc `lesson_sessions`), newest first, with
 * real loading / empty / error states. Reached from the Progress screen
 * and from the stage player's completion screen.
 */
export default function LessonRunsScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const palette = useSensoryPalette();
  const { data, isLoading, isError, refetch } = useLessonSessions(user?.id ?? "");

  const sessions = useMemo(() => data ?? [], [data]);

  return (
    <ResponsiveScreen maxWidth="dashboard" background={palette.bgPage}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t("common.back", "Back")}
          hitSlop={8}
          style={[styles.backBtn, { backgroundColor: palette.bgRaised, borderColor: palette.border }]}
        >
          <Ionicons name="chevron-back" size={22} color={palette.ink} />
        </Pressable>
        <Text style={[styles.title, { color: palette.ink }]}>
          {t("lessonRuns.title", "Lesson history")}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {isLoading ? (
        <LoadingState message={t("common.loading", "Loading...")} />
      ) : isError ? (
        <EmptyState
          icon={<Ionicons name="cloud-offline-outline" size={48} color={palette.inkMuted} />}
          title={t("lessonRuns.errorTitle", "Couldn't load your history")}
          message={t("lessonRuns.errorBody", "Check your connection and try again.")}
          actionLabel={t("common.retry", "Retry")}
          onAction={() => refetch()}
        />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="book-outline" size={48} color={palette.inkMuted} />}
          title={t("lessonRuns.emptyTitle", "No lessons yet")}
          message={t("lessonRuns.emptyBody", "Finish a lesson and it shows up here.")}
        />
      ) : (
        sessions.map((s) => <LessonRunRow key={s.id} session={s} palette={palette} t={t} />)
      )}
    </ResponsiveScreen>
  );
}

function LessonRunRow({
  session,
  palette,
  t,
}: {
  session: LessonSession;
  palette: ReturnType<typeof useSensoryPalette>;
  t: (key: string, defaultValue?: string) => string;
}) {
  const live = isLiveSession(session);
  const accent = subjectAccent(session.subject);
  return (
    <Card tone="raised" style={styles.row}>
      <View style={[styles.dot, { backgroundColor: accent }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.subject, { color: palette.ink }]} numberOfLines={1}>
          {session.subject || t("lessonRuns.lesson", "Lesson")}
        </Text>
        <Text style={[styles.meta, { color: palette.inkMuted }]}>
          {formatDate(session.completedAt ?? session.startedAt)}
          {session.durationSeconds
            ? ` · ${Math.max(1, Math.round(session.durationSeconds / 60))} min`
            : ""}
        </Text>
      </View>
      {session.xpEarned ? (
        <Text style={[styles.xp, { color: accent }]}>+{session.xpEarned} XP</Text>
      ) : null}
      <View
        style={[
          styles.statusPill,
          {
            backgroundColor: live ? palette.primary + "22" : palette.bgPage,
          },
        ]}
      >
        <Text
          style={[styles.statusText, { color: live ? palette.primary : palette.inkMuted }]}
        >
          {live ? t("lessonRuns.inProgress", "In progress") : t("lessonRuns.done", "Done")}
        </Text>
      </View>
    </Card>
  );
}

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  subject: { fontSize: 15, fontFamily: fontFamilies.bodyBold },
  meta: { fontSize: 12, fontFamily: fontFamilies.bodyRegular, marginTop: 2 },
  xp: { fontSize: 13, fontFamily: fontFamilies.bodyBold, marginRight: 4 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  statusText: { fontSize: 11, fontFamily: fontFamilies.bodyBold },
});
