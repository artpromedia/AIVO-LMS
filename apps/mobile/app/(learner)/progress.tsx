import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useBrainDomains } from "@/hooks/useBrain";
import { useEngagement } from "@/hooks/useEngagement";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import {
  StatCard,
  MasteryBar,
  MasteryHeatStrip,
  DotChart,
  TrendChart,
  LoadingState,
  EmptyState,
  type MasteryCell,
  type ChartPoint,
} from "@aivo/mobile-ui";
import { Card } from "@/components/ui";
import { summarizeDomains } from "@/lib/learner-progress";
import { subjectAccent } from "@/lib/subject-display";
import { useLessonSessions } from "@/hooks/useGradebook";
import { lessonsByDay } from "@/lib/gradebook-logic";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Learner progress — mirror of web's `/learner/progress` (MOB-LRN-010).
 * Calm mastery analytics built from per-domain mastery (brain-svc) + the
 * engagement streak, plus the lessons-by-day trend and recent activity
 * from learning-svc. Uses the mobile chart kit (MasteryBar /
 * MasteryHeatStrip / DotChart / TrendChart).
 */
export default function LearnerProgressScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const palette = useSensoryPalette();
  const { domains, isLoading } = useBrainDomains(user?.id ?? "");
  const { data: engagement } = useEngagement(user?.id ?? "");
  const { data: lessonSessions } = useLessonSessions(user?.id ?? "");
  const trend = useMemo(() => lessonsByDay(lessonSessions ?? []), [lessonSessions]);
  const recent = useMemo(() => (lessonSessions ?? []).slice(0, 5), [lessonSessions]);

  const summary = useMemo(
    () =>
      summarizeDomains(
        domains.map((d) => ({ domain: d.domain, masteryPercent: d.masteryPercent })),
      ),
    [domains],
  );

  const cells: MasteryCell[] = summary.subjects.map((s) => ({
    code: s.name,
    name: s.name,
    level: s.level,
  }));
  const points: ChartPoint[] = summary.subjects.map((s) => ({
    label: s.name.slice(0, 4),
    value: s.mastery,
  }));

  return (
    <ResponsiveScreen maxWidth="dashboard" background={palette.bgPage}>
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
          {t("progress.title", "Progress")}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {isLoading ? (
        <LoadingState />
      ) : summary.total === 0 ? (
        <EmptyState
          title={t("progress.emptyTitle", "No progress yet")}
          message={t("progress.emptyBody", "Finish a few lessons and your mastery shows up here.")}
        />
      ) : (
        <>
          {/* Overall mastery hero */}
          <Card tone="raised" style={styles.card}>
            <Text style={[styles.eyebrow, { color: palette.inkMuted }]}>
              {t("progress.overall", "Overall mastery")}
            </Text>
            <Text style={[styles.bigPct, { color: palette.primary }]}>
              {summary.overallMastery}%
            </Text>
            <MasteryBar value={summary.overallMastery} showValue={false} />
          </Card>

          {/* Stat row */}
          <View style={styles.statRow}>
            <StatCard
              label={t("progress.mastered", "Mastered")}
              value={summary.masteredCount}
              icon={<Ionicons name="star" size={18} color="#22c55e" />}
              color="#22c55e"
            />
            <StatCard
              label={t("progress.needsSupport", "Needs support")}
              value={summary.needsSupportCount}
              icon={<Ionicons name="heart" size={18} color="#ef4444" />}
              color="#ef4444"
            />
            <StatCard
              label={t("progress.streak", "Day streak")}
              value={engagement?.streakDays ?? 0}
              icon={<Ionicons name="flame" size={18} color="#f59e0b" />}
              color="#f59e0b"
            />
          </View>

          {/* Per-subject mastery */}
          <Card tone="raised" style={styles.card}>
            <Text style={[styles.sectionTitle, { color: palette.ink }]}>
              {t("progress.bySubject", "By subject")}
            </Text>
            <View style={{ gap: 14, marginTop: spacing.sm }}>
              {summary.subjects.map((s) => (
                <MasteryBar
                  key={s.name}
                  label={s.name}
                  value={s.mastery}
                  tone={subjectAccent(s.name)}
                />
              ))}
            </View>
          </Card>

          {/* Lessons completed per day */}
          <Card tone="raised" style={styles.card}>
            <Text style={[styles.sectionTitle, { color: palette.ink }]}>
              {t("progress.lessonsByDay", "Lessons this week")}
            </Text>
            <View style={{ marginTop: spacing.sm }}>
              <TrendChart
                data={trend}
                ariaLabel={t("progress.lessonsByDayAria", "Lessons completed per day")}
              />
            </View>
          </Card>

          {/* Heat strip + comparison dots */}
          <Card tone="raised" style={styles.card}>
            <Text style={[styles.sectionTitle, { color: palette.ink }]}>
              {t("progress.overview", "Mastery overview")}
            </Text>
            <View style={{ marginTop: spacing.sm }}>
              <MasteryHeatStrip cells={cells} />
            </View>
            <View style={{ marginTop: spacing.md }}>
              <DotChart data={points} ariaLabel={t("progress.compareAria", "Mastery by subject")} />
            </View>
          </Card>

          {recent.length > 0 && (
            <Card tone="raised" style={styles.card}>
              <Text style={[styles.sectionTitle, { color: palette.ink }]}>
                {t("progress.recent", "Recent activity")}
              </Text>
              <View style={{ gap: 10, marginTop: spacing.sm }}>
                {recent.map((ls) => (
                  <View key={ls.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: subjectAccent(ls.subject),
                      }}
                    />
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 14,
                        fontFamily: fontFamilies.bodyBold,
                        color: palette.ink,
                      }}
                    >
                      {ls.subject}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: fontFamilies.bodyRegular,
                        color: palette.inkMuted,
                      }}
                    >
                      {fmtDate(ls.completedAt ?? ls.startedAt)}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          )}
        </>
      )}
    </ResponsiveScreen>
  );
}

function fmtDate(iso?: string | null): string {
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
  card: { marginBottom: spacing.md, gap: 4 },
  eyebrow: {
    fontSize: 12,
    fontFamily: fontFamilies.bodyBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bigPct: { fontSize: 44, fontFamily: fontFamilies.displayBold, marginVertical: 2 },
  sectionTitle: { fontSize: 16, fontFamily: fontFamilies.displayBold },
  statRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
});
