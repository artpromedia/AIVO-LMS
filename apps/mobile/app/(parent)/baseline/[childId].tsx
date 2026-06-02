import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearner } from "@/hooks/useLearners";
import { useBrain, useBrainDomains } from "@/hooks/useBrain";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { Card } from "@/components/ui";
import { MasteryBar, LoadingState } from "@aivo/mobile-ui";
import { summarizeDomains } from "@/lib/learner-progress";
import { subjectAccent } from "@/lib/subject-display";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { INCLUSIVE_WARM_PALETTE } from "@aivo/brand";

/**
 * Parent baseline (MOB-PAR-005) — mirror of web's
 * `/parent/learners/[learnerId]/baseline` (+ pending/summary states).
 * Shows the baseline status derived from the brain profile, and a
 * results summary once mastery exists.
 */
export default function ParentBaselineScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const id = childId ?? "";
  const { data: learner } = useLearner(id);
  const { data: brain, isLoading } = useBrain(id);
  const { domains } = useBrainDomains(id, { enrolledGrade: learner?.gradeLevel ?? null });
  const summary = useMemo(
    () =>
      summarizeDomains(
        domains.map((d) => ({ domain: d.domain, masteryPercent: d.masteryPercent })),
      ),
    [domains],
  );

  const status: "pending" | "ready" =
    summary.total > 0 || brain?.approvalStatus === "approved" ? "ready" : "pending";

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("parentBaseline.title", "Baseline")} />
      {isLoading ? (
        <LoadingState />
      ) : status === "pending" ? (
        <Card tone="raised" style={{ gap: spacing.sm, alignItems: "center" }}>
          <View style={[styles.iconWrap, { backgroundColor: INCLUSIVE_WARM_PALETTE.primarySoft }]}>
            <Ionicons name="hourglass-outline" size={28} color={palette.primary} />
          </View>
          <Text style={[styles.heading, { color: palette.ink }]}>
            {t("parentBaseline.pendingTitle", "Baseline in progress")}
          </Text>
          <Text style={[styles.body, { color: palette.inkMuted, textAlign: "center" }]}>
            {t("parentBaseline.pendingBody", {
              name: learner?.firstName ?? t("parentHub.learner", "Your learner"),
              defaultValue: `${learner?.firstName ?? "Your learner"}'s starting point is being measured. Results show up here when it's done.`,
            })}
          </Text>
        </Card>
      ) : (
        <View style={{ gap: spacing.md }}>
          <Card tone="raised" style={{ gap: spacing.sm }}>
            <Text style={[styles.eyebrow, { color: palette.inkMuted }]}>
              {t("parentBaseline.results", "Starting point")}
            </Text>
            <Text style={[styles.heading, { color: palette.ink }]}>
              {summary.overallMastery}% {t("parentBaseline.overall", "overall")}
            </Text>
            <MasteryBar value={summary.overallMastery} showValue={false} />
          </Card>
          <Card tone="raised" style={{ gap: spacing.sm }}>
            <Text style={[styles.eyebrow, { color: palette.inkMuted }]}>
              {t("parentBaseline.bySubject", "By subject")}
            </Text>
            {summary.subjects.map((s) => (
              <MasteryBar
                key={s.name}
                label={s.name}
                value={s.mastery}
                tone={subjectAccent(s.name)}
              />
            ))}
          </Card>
        </View>
      )}
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: { fontSize: 18, fontFamily: fontFamilies.displayBold },
  eyebrow: {
    fontSize: 12,
    fontFamily: fontFamilies.bodyBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  body: { fontSize: 14, fontFamily: fontFamilies.bodyRegular, lineHeight: 21 },
});
