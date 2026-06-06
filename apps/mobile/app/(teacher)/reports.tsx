import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useConnectedLearners, useIEPGoals } from "@/hooks/useFamily";
import { useBrainDomains } from "@/hooks/useBrain";
import { summarizeDomains } from "@/lib/learner-progress";
import { distribution, type LearnerMastery } from "@/lib/mastery-distribution";
import { StatCard, MasteryBar, EmptyState } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";

interface ConnectedLearner {
  id: string;
  name: string;
  functioningLevel: string | null;
  gradeLevel: string | null;
}

interface RollupAgg {
  overall: number;
  hasIep: boolean;
  hasData: boolean;
}

/**
 * Teacher reports — mobile parity for web's `teacher/reports` mastery
 * rollup. Renders KPI summary cards (caseload size, classroom average,
 * on-track count, IEPs on file), the class mastery distribution, and a
 * per-learner rollup table built from **real** brain-svc mastery and
 * family-svc IEP data. Each learner reports its aggregate up through an
 * effect (stable hook order — one row component per learner) so the KPIs
 * stay live as data streams in.
 *
 * The four "report type" cards and the lighter snapshot live on the
 * Analytics tab; this screen is the drill-in detail it links to.
 */
export default function TeacherReportsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: learnersRaw } = useConnectedLearners();
  const learners: ConnectedLearner[] = useMemo(
    () => (Array.isArray(learnersRaw) ? learnersRaw : []),
    [learnersRaw],
  );

  const [aggs, setAggs] = useState<Record<string, RollupAgg>>({});
  const report = useCallback((id: string, value: RollupAgg) => {
    setAggs((prev) => {
      const cur = prev[id];
      if (cur && cur.overall === value.overall && cur.hasIep === value.hasIep) return prev;
      return { ...prev, [id]: value };
    });
  }, []);

  const masteries: LearnerMastery[] = learners
    .filter((l) => aggs[l.id]?.hasData)
    .map((l) => ({ learnerId: l.id, overall: aggs[l.id]!.overall }));
  const dist = useMemo(() => distribution(masteries), [masteries]);
  const onTrack = dist.bands.stretching + dist.bands.onGrade;
  const iepCount = learners.filter((l) => aggs[l.id]?.hasIep).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
    >
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t("common.back", "Back")}
          hitSlop={8}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("teacherReports.title", "Reports")}</Text>
          <Text style={styles.subtitle}>
            {t("teacherReportsDetail.subtitle", "Classroom mastery rollup")}
          </Text>
        </View>
      </View>

      {learners.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="people-outline" size={48} color={colors.textSecondary} />}
          title={t("teacherReports.noLearnersTitle", "No learners connected")}
          message={t(
            "teacherReports.noLearnersMessage",
            "Reports will appear once parents invite you to their learner teams.",
          )}
        />
      ) : (
        <>
          {/* KPI summary */}
          <View style={styles.kpiRow}>
            <StatCard
              label={t("teacherReportsDetail.learners", "Learners")}
              value={learners.length}
              icon={<Ionicons name="people" size={18} color={colors.primary} />}
              color={colors.primary}
            />
            <StatCard
              label={t("teacherReportsDetail.avgMastery", "Avg mastery")}
              value={`${dist.average}%`}
              icon={<Ionicons name="stats-chart" size={18} color={colors.info} />}
              color={colors.info}
            />
          </View>
          <View style={styles.kpiRow}>
            <StatCard
              label={t("teacherReportsDetail.onTrack", "On track")}
              value={onTrack}
              icon={<Ionicons name="trending-up" size={18} color={colors.success} />}
              color={colors.success}
            />
            <StatCard
              label={t("teacherReportsDetail.iepOnFile", "IEPs on file")}
              value={iepCount}
              icon={<Ionicons name="flag" size={18} color={colors.accent} />}
              color={colors.accent}
            />
          </View>

          <Text style={styles.sectionTitle}>
            {t("teacherReportsDetail.rollup", "Learner rollup")}
          </Text>
          {learners.map((l) => (
            <LearnerReportRow key={l.id} learner={l} onAggregate={report} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function LearnerReportRow({
  learner,
  onAggregate,
}: {
  learner: ConnectedLearner;
  onAggregate: (id: string, value: RollupAgg) => void;
}) {
  const { t } = useTranslation();
  const { domains, isLoading } = useBrainDomains(learner.id, {
    enrolledGrade: learner.gradeLevel,
  });
  const { data: iepRaw } = useIEPGoals(learner.id);

  const summary = useMemo(
    () =>
      summarizeDomains(
        domains.map((d) => ({ domain: d.domain, masteryPercent: d.masteryPercent })),
      ),
    [domains],
  );

  const hasIep = useMemo(() => {
    if (Array.isArray(iepRaw)) return iepRaw.length > 0;
    const goals = (iepRaw as { goals?: unknown[] } | undefined)?.goals;
    return Array.isArray(goals) && goals.length > 0;
  }, [iepRaw]);

  useEffect(() => {
    onAggregate(learner.id, {
      overall: summary.overallMastery,
      hasIep,
      hasData: summary.total > 0,
    });
  }, [learner.id, summary.overallMastery, summary.total, hasIep, onAggregate]);

  return (
    <View style={styles.rowCard}>
      <View style={styles.rowTop}>
        <Text style={styles.rowName} numberOfLines={1}>
          {learner.name}
        </Text>
        {hasIep && (
          <View style={styles.iepBadge}>
            <Text style={styles.iepBadgeText}>{t("teacherReportsDetail.iep", "IEP")}</Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <Text style={styles.rowMeta}>{t("common.loading", "Loading...")}</Text>
      ) : summary.total === 0 ? (
        <Text style={styles.rowMeta}>
          {t("teacherReportsDetail.noData", "No mastery data yet")}
        </Text>
      ) : (
        <>
          <MasteryBar
            value={summary.overallMastery}
            label={t("teacherReportsDetail.overall", "Overall mastery")}
          />
          <Text style={styles.rowMeta}>
            {t("teacherReportsDetail.subjectCount", {
              count: summary.subjects.length,
              defaultValue: `${summary.subjects.length} subjects`,
            })}{" "}
            ·{" "}
            {t("teacherReportsDetail.mastered", {
              count: summary.masteredCount,
              defaultValue: `${summary.masteredCount} mastered`,
            })}
          </Text>
        </>
      )}

      <View style={styles.actionsRow}>
        <Pressable
          style={styles.actionBtn}
          onPress={() => router.push(`/(teacher)/student/${learner.id}/insight` as Href)}
          accessibilityRole="button"
          accessibilityLabel={t("teacherReportsDetail.openLearner", {
            name: learner.name,
            defaultValue: `Open ${learner.name}`,
          })}
        >
          <Text style={styles.actionText}>{t("teacherReportsDetail.open", "Open")}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </Pressable>
        {hasIep && (
          <Pressable
            style={styles.actionBtn}
            onPress={() => router.push(`/(teacher)/student/${learner.id}/iep` as Href)}
            accessibilityRole="button"
            accessibilityLabel={t("teacherReportsDetail.openGoals", {
              name: learner.name,
              defaultValue: `Open IEP goals for ${learner.name}`,
            })}
          >
            <Text style={styles.actionText}>{t("teacherReportsDetail.goals", "Goals")}</Text>
            <Ionicons name="flag-outline" size={14} color={colors.primary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.lg },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontFamily: "Nunito-ExtraBold", color: colors.text },
  subtitle: { fontSize: 14, fontFamily: "Nunito-Regular", color: colors.textSecondary },
  kpiRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Nunito-Bold",
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  rowCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 6,
  },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowName: { fontSize: 15, fontFamily: "Nunito-Bold", color: colors.text, flex: 1 },
  rowMeta: { fontSize: 12, fontFamily: "Nunito-Regular", color: colors.textSecondary },
  iepBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.accent + "22",
    marginLeft: 8,
  },
  iepBadgeText: { fontSize: 10, fontFamily: "Nunito-Bold", color: colors.accent },
  actionsRow: { flexDirection: "row", gap: spacing.md, marginTop: 4 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  actionText: { fontSize: 13, fontFamily: "Nunito-Bold", color: colors.primary },
});
