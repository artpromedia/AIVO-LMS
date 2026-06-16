import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearner } from "@/hooks/useLearners";
import { useBrainDomains } from "@/hooks/useBrain";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { Card } from "@/components/ui";
import { MasteryBar, LoadingState, EmptyState } from "@aivo/mobile-ui";
import { summarizeDomains } from "@/lib/learner-progress";
import { subjectAccent } from "@/lib/subject-display";
import { colors, spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Parent learner summary (MOB-PAR-016) — mirror of web's
 * `/parent/learners/[learnerId]/summary`. A plain-language "how is my
 * child doing" view: overall mastery, strongest subjects, and what to
 * keep practising — derived from brain-svc mastery.
 */
export default function ParentSummaryScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const id = childId ?? "";
  const { data: learner } = useLearner(id);
  const { domains, isLoading } = useBrainDomains(id, {
    enrolledGrade: learner?.gradeLevel ?? null,
  });

  const summary = useMemo(
    () =>
      summarizeDomains(
        domains.map((d) => ({ domain: d.domain, masteryPercent: d.masteryPercent })),
      ),
    [domains],
  );
  const strongest = summary.subjects.filter(
    (s) => s.level === "mastered" || s.level === "proficient",
  );
  const practice = summary.subjects.filter(
    (s) => s.level === "emerging" || s.level === "developing",
  );

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
          {t("parentSummary.title", "Summary")}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {isLoading ? (
        <LoadingState />
      ) : summary.total === 0 ? (
        <EmptyState
          title={t("parentSummary.emptyTitle", "Nothing to summarise yet")}
          message={t(
            "parentSummary.emptyBody",
            "Once lessons begin, you'll see a plain-language recap here.",
          )}
        />
      ) : (
        <>
          <Card tone="raised" style={styles.heroCard}>
            <Text style={[styles.heroLine, { color: palette.ink }]}>
              {t("parentSummary.headline", {
                name: learner?.firstName ?? "Your learner",
                pct: summary.overallMastery,
                defaultValue: `${learner?.firstName ?? "Your learner"} is at ${summary.overallMastery}% overall mastery.`,
              })}
            </Text>
            <MasteryBar value={summary.overallMastery} showValue={false} />
          </Card>

          {strongest.length > 0 && (
            <Card tone="raised" style={styles.card}>
              <View style={styles.cardHead}>
                <Ionicons name="star" size={18} color={colors.success} />
                <Text style={[styles.sectionTitle, { color: palette.ink }]}>
                  {t("parentSummary.strongest", "Strongest right now")}
                </Text>
              </View>
              <View style={styles.chips}>
                {strongest.map((s) => (
                  <View
                    key={s.name}
                    style={[
                      styles.chip,
                      { borderColor: palette.border, backgroundColor: palette.bgPage },
                    ]}
                  >
                    <View style={[styles.dot, { backgroundColor: subjectAccent(s.name) }]} />
                    <Text style={[styles.chipText, { color: palette.ink }]}>
                      {s.name} · {s.mastery}%
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {practice.length > 0 && (
            <Card tone="raised" style={styles.card}>
              <View style={styles.cardHead}>
                <Ionicons name="heart" size={18} color={colors.warning} />
                <Text style={[styles.sectionTitle, { color: palette.ink }]}>
                  {t("parentSummary.keepPracticing", "Keep practising")}
                </Text>
              </View>
              <View style={{ gap: 12, marginTop: spacing.sm }}>
                {practice.map((s) => (
                  <MasteryBar
                    key={s.name}
                    label={s.name}
                    value={s.mastery}
                    tone={subjectAccent(s.name)}
                  />
                ))}
              </View>
            </Card>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("parentSummary.openGradebook", "Open gradebook")}
            onPress={() => router.push(`/(parent)/gradebook/${id}` as never)}
            style={[styles.cta, { borderColor: palette.primary }]}
          >
            <Text style={[styles.ctaText, { color: palette.primary }]}>
              {t("parentSummary.openGradebook", "Open gradebook")}
            </Text>
            <Ionicons name="arrow-forward" size={18} color={palette.primary} />
          </Pressable>
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
  heroCard: { marginBottom: spacing.md, gap: spacing.sm },
  heroLine: { fontSize: 17, fontFamily: fontFamilies.bodyBold, lineHeight: 24 },
  card: { marginBottom: spacing.md, gap: 4 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 16, fontFamily: fontFamilies.displayBold },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 13, fontFamily: fontFamilies.bodySemiBold },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.xl,
    borderWidth: 1.5,
  },
  ctaText: { fontSize: 15, fontFamily: fontFamilies.bodyBold },
});
