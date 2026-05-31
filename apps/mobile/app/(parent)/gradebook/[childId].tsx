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
import {
  MasteryBar,
  MasteryHeatStrip,
  LoadingState,
  EmptyState,
  type MasteryCell,
} from "@aivo/mobile-ui";
import { summarizeDomains } from "@/lib/learner-progress";
import { subjectAccent } from "@/lib/subject-display";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Parent gradebook (MOB-PAR-008) — mirror of web's
 * `/parent/learners/[learnerId]/gradebook`. Subject averages + a mastery
 * heat overview for one child, built from brain-svc mastery via the
 * mobile chart kit.
 */
export default function ParentGradebookScreen() {
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
  const cells: MasteryCell[] = summary.subjects.map((s) => ({
    code: s.name,
    name: s.name,
    level: s.level,
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
        <Text style={[styles.title, { color: palette.ink }]} numberOfLines={1}>
          {t("parentGradebook.title", "Gradebook")}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {isLoading ? (
        <LoadingState />
      ) : summary.total === 0 ? (
        <EmptyState
          title={t("parentGradebook.emptyTitle", "No grades yet")}
          message={t(
            "parentGradebook.emptyBody",
            "Mastery appears here once lessons are underway.",
          )}
        />
      ) : (
        <>
          {learner ? (
            <Text style={[styles.subtitle, { color: palette.inkMuted }]}>
              {t("parentGradebook.for", {
                name: learner.firstName,
                defaultValue: `For ${learner.firstName}`,
              })}
            </Text>
          ) : null}

          <Card tone="raised" style={styles.card}>
            <Text style={[styles.sectionTitle, { color: palette.ink }]}>
              {t("parentGradebook.overview", "Mastery overview")}
            </Text>
            <View style={{ marginTop: spacing.sm }}>
              <MasteryHeatStrip cells={cells} />
            </View>
          </Card>

          <Card tone="raised" style={styles.card}>
            <Text style={[styles.sectionTitle, { color: palette.ink }]}>
              {t("parentGradebook.subjects", "Subjects")}
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
  title: { flex: 1, textAlign: "center", fontSize: 20, fontFamily: fontFamilies.displayBold },
  subtitle: { fontSize: 14, fontFamily: fontFamilies.bodyRegular, marginBottom: spacing.sm },
  card: { marginBottom: spacing.md, gap: 4 },
  sectionTitle: { fontSize: 16, fontFamily: fontFamilies.displayBold },
});
