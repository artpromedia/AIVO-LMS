import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearners } from "@/hooks/useLearners";
import { useBrainDomains } from "@/hooks/useBrain";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { Card } from "@/components/ui";
import { MasteryBar, EmptyState, LoadingState } from "@aivo/mobile-ui";
import { summarizeDomains } from "@/lib/learner-progress";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

interface LearnerLite {
  id: string;
  firstName: string;
  lastName: string;
  gradeLevel: string;
}

/**
 * Parent reports (MOB-PAR-020) — mirror of web's `/parent/reports`. A
 * weekly-metrics card per learner (overall mastery, subjects tracked,
 * skills mastered), each routing into that child's gradebook. Built from
 * brain-svc mastery; lesson-count metrics arrive with the lesson-runs
 * endpoint.
 */
export default function ParentReportsScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { data: learners, isLoading } = useLearners();

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
          {t("parentReports.title", "Reports")}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {isLoading ? (
        <LoadingState />
      ) : !learners || learners.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="bar-chart-outline" size={48} color={palette.inkMuted} />}
          title={t("parentReports.emptyTitle", "No reports yet")}
          message={t("parentReports.emptyBody", "Add a learner to see weekly reports.")}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {learners.map((l) => (
            <ReportCard key={l.id} learner={l} />
          ))}
        </View>
      )}
    </ResponsiveScreen>
  );
}

function ReportCard({ learner }: { learner: LearnerLite }) {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { domains, isLoading } = useBrainDomains(learner.id, { enrolledGrade: learner.gradeLevel });
  const summary = useMemo(
    () =>
      summarizeDomains(
        domains.map((d) => ({ domain: d.domain, masteryPercent: d.masteryPercent })),
      ),
    [domains],
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${learner.firstName} ${learner.lastName}`}
      onPress={() => router.push(`/(parent)/gradebook/${learner.id}` as Href)}
    >
      <Card tone="raised" style={styles.card}>
        <View style={styles.cardHead}>
          <View style={[styles.avatar, { backgroundColor: palette.accentSoft }]}>
            <Text style={[styles.initial, { color: palette.accent }]}>
              {learner.firstName?.[0] ?? "?"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: palette.ink }]}>
              {learner.firstName} {learner.lastName}
            </Text>
            <Text style={[styles.meta, { color: palette.inkMuted }]}>
              {isLoading
                ? t("common.loading", "Loading…")
                : t("parentReports.tracked", {
                    count: summary.total,
                    mastered: summary.masteredCount,
                    defaultValue: `${summary.total} subjects · ${summary.masteredCount} mastered`,
                  })}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.inkMuted} />
        </View>
        {!isLoading && summary.total > 0 ? (
          <View style={{ marginTop: spacing.sm }}>
            <MasteryBar
              value={summary.overallMastery}
              caption={t("parentReports.overall", "Overall mastery")}
            />
          </View>
        ) : null}
      </Card>
    </Pressable>
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
  card: { gap: spacing.sm },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: 18, fontFamily: fontFamilies.displayBold },
  name: { fontSize: 16, fontFamily: fontFamilies.bodyBold },
  meta: { fontSize: 13, fontFamily: fontFamilies.bodyRegular, marginTop: 2 },
});
