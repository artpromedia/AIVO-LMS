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
  LoadingState,
  EmptyState,
  type MasteryCell,
  type ChartPoint,
} from "@aivo/mobile-ui";
import { Card } from "@/components/ui";
import { summarizeDomains } from "@/lib/learner-progress";
import { subjectAccent } from "@/lib/subject-display";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Learner progress — mirror of web's `/learner/progress` (MOB-LRN-010).
 * Calm mastery analytics built from the per-domain mastery the app
 * already has (brain-svc) plus the engagement streak. Uses the mobile
 * chart kit (MasteryBar / MasteryHeatStrip / DotChart). The
 * lessons-by-day trend + recent-activity list are pending a lesson-runs
 * REST endpoint on mobile (Partial).
 */
export default function LearnerProgressScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const palette = useSensoryPalette();
  const { domains, isLoading } = useBrainDomains(user?.id ?? "");
  const { data: engagement } = useEngagement(user?.id ?? "");

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
        </>
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
