import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearner } from "@/hooks/useLearners";
import { useBrainDomains } from "@/hooks/useBrain";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { useColumns, MasteryBar } from "@aivo/mobile-ui";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { Card } from "@/components/ui";
import { summarizeDomains } from "@/lib/learner-progress";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

interface Metric {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: (id: string) => string;
}

/**
 * Parent profile-v2 metric hub (MOB-PAR-012) — mirror of web's
 * `/parent/learners/[learnerId]/profile-v2`. A learning hero + metric
 * cards linking to each detail surface.
 */
export default function ParentProfileV2Screen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const id = childId ?? "";
  const { data: learner } = useLearner(id);
  const { domains } = useBrainDomains(id, { enrolledGrade: learner?.gradeLevel ?? null });
  const summary = useMemo(
    () =>
      summarizeDomains(
        domains.map((d) => ({ domain: d.domain, masteryPercent: d.masteryPercent })),
      ),
    [domains],
  );
  const columns = useColumns({ compact: 2, medium: 3, expanded: 3 });

  const METRICS: Metric[] = [
    {
      key: "baseline",
      icon: "flag",
      label: t("profileV2.baseline", "Baseline"),
      route: (i) => `/(parent)/progress/${i}`,
    },
    {
      key: "brain",
      icon: "bulb",
      label: t("profileV2.brain", "Brain profile"),
      route: (i) => `/(parent)/brain/${i}`,
    },
    {
      key: "iep",
      icon: "clipboard",
      label: t("profileV2.iep", "IEP"),
      route: (i) => `/(parent)/iep/${i}`,
    },
    {
      key: "sensory",
      icon: "color-palette",
      label: t("profileV2.sensory", "Sensory"),
      route: (i) => `/(parent)/sensory/${i}`,
    },
    {
      key: "a11y",
      icon: "accessibility",
      label: t("profileV2.a11y", "Accessibility"),
      route: (i) => `/(parent)/accessibility/${i}`,
    },
    {
      key: "gradebook",
      icon: "bar-chart",
      label: t("profileV2.gradebook", "Gradebook"),
      route: (i) => `/(parent)/gradebook/${i}`,
    },
  ];

  return (
    <ResponsiveScreen maxWidth="dashboard" background={palette.bgPage}>
      <ScreenHeader title={t("profileV2.title", "Learner profile")} />

      <Card tone="hero" style={styles.hero}>
        <Text style={[styles.name, { color: palette.ink }]}>
          {learner ? `${learner.firstName} ${learner.lastName}` : t("common.loading", "Loading…")}
        </Text>
        <Text style={[styles.eyebrow, { color: palette.inkMuted }]}>
          {t("profileV2.overall", "Overall mastery")}
        </Text>
        <MasteryBar value={summary.overallMastery} />
      </Card>

      <View style={styles.grid}>
        {METRICS.map((m) => (
          <View key={m.key} style={[styles.cell, { flexBasis: `${100 / columns}%` }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={m.label}
              onPress={() => router.push(m.route(id) as Href)}
              style={[
                styles.tile,
                { backgroundColor: palette.bgRaised, borderColor: palette.border },
              ]}
            >
              <View style={[styles.tileIcon, { backgroundColor: palette.bgPage }]}>
                <Ionicons name={m.icon} size={22} color={palette.primary} />
              </View>
              <Text style={[styles.tileLabel, { color: palette.ink }]}>{m.label}</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm, marginBottom: spacing.md },
  name: { fontSize: 20, fontFamily: fontFamilies.displayBold },
  eyebrow: {
    fontSize: 12,
    fontFamily: fontFamilies.bodyBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -spacing.xs },
  cell: { padding: spacing.xs },
  tile: {
    alignItems: "center",
    gap: 8,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: { fontSize: 12, fontFamily: fontFamilies.bodyBold, textAlign: "center" },
});
