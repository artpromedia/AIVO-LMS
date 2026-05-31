import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearner } from "@/hooks/useLearners";
import { useBrainDomains } from "@/hooks/useBrain";
import { useLearnerMilestones } from "@/hooks/useLearnerMilestones";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { Card } from "@/components/ui";
import { StatCard, MasteryBar, LoadingState } from "@aivo/mobile-ui";
import { summarizeDomains } from "@/lib/learner-progress";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Parent weekly snapshot (MOB-PAR-015) — mirror of web's
 * `/parent/learners/[learnerId]/snapshot`. A one-glance card of how the
 * week is going: mastery, skills mastered, streak, badges, and the most
 * recent milestone. Built from brain-svc mastery + family-svc milestones.
 */
export default function ParentSnapshotScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const id = childId ?? "";
  const { data: learner } = useLearner(id);
  const { domains, isLoading } = useBrainDomains(id, {
    enrolledGrade: learner?.gradeLevel ?? null,
  });
  const { data: milestones } = useLearnerMilestones(id);

  const summary = useMemo(
    () =>
      summarizeDomains(
        domains.map((d) => ({ domain: d.domain, masteryPercent: d.masteryPercent })),
      ),
    [domains],
  );
  const latestMilestone = milestones?.milestones?.[0];

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
          {t("parentSnapshot.title", "This week")}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {isLoading ? (
        <LoadingState />
      ) : (
        <>
          {learner ? (
            <Text style={[styles.subtitle, { color: palette.inkMuted }]}>
              {t("parentSnapshot.for", {
                name: learner.firstName,
                defaultValue: `How ${learner.firstName} is doing`,
              })}
            </Text>
          ) : null}

          <Card tone="raised" style={styles.card}>
            <Text style={[styles.eyebrow, { color: palette.inkMuted }]}>
              {t("parentSnapshot.mastery", "Overall mastery")}
            </Text>
            <MasteryBar value={summary.overallMastery} />
          </Card>

          <View style={styles.statRow}>
            <StatCard
              label={t("parentSnapshot.mastered", "Skills mastered")}
              value={summary.masteredCount}
              icon={<Ionicons name="star" size={18} color="#22c55e" />}
              color="#22c55e"
            />
            <StatCard
              label={t("parentSnapshot.streak", "Day streak")}
              value={milestones?.streak?.currentStreak ?? 0}
              icon={<Ionicons name="flame" size={18} color="#f59e0b" />}
              color="#f59e0b"
            />
            <StatCard
              label={t("parentSnapshot.badges", "Badges")}
              value={milestones?.badges?.length ?? 0}
              icon={<Ionicons name="ribbon" size={18} color={palette.accent} />}
              color={palette.accent}
            />
          </View>

          <Card tone="raised" style={styles.card}>
            <Text style={[styles.sectionTitle, { color: palette.ink }]}>
              {t("parentSnapshot.latest", "Latest milestone")}
            </Text>
            {latestMilestone ? (
              <View style={styles.milestoneRow}>
                <View style={[styles.milestoneIcon, { backgroundColor: palette.accentSoft }]}>
                  <Ionicons name="trophy" size={18} color={palette.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.milestoneTitle, { color: palette.ink }]}>
                    {latestMilestone.title}
                  </Text>
                  {latestMilestone.description ? (
                    <Text
                      style={[styles.milestoneDesc, { color: palette.inkMuted }]}
                      numberOfLines={2}
                    >
                      {latestMilestone.description}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : (
              <Text style={[styles.milestoneDesc, { color: palette.inkMuted }]}>
                {t("parentSnapshot.noMilestone", "No milestones yet this week.")}
              </Text>
            )}
          </Card>

          <View style={styles.linkRow}>
            <QuickLink
              label={t("parentHub.progress", "Progress")}
              icon="trending-up"
              onPress={() => router.push(`/(parent)/progress/${id}` as Href)}
              palette={palette}
            />
            <QuickLink
              label={t("parentHub.gradebook", "Gradebook")}
              icon="bar-chart"
              onPress={() => router.push(`/(parent)/gradebook/${id}` as Href)}
              palette={palette}
            />
            <QuickLink
              label={t("parentHub.milestones", "Milestones")}
              icon="ribbon"
              onPress={() => router.push(`/(parent)/milestones/${id}` as Href)}
              palette={palette}
            />
          </View>
        </>
      )}
    </ResponsiveScreen>
  );
}

function QuickLink({
  label,
  icon,
  onPress,
  palette,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  palette: ReturnType<typeof useSensoryPalette>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.quickLink, { backgroundColor: palette.bgRaised, borderColor: palette.border }]}
    >
      <Ionicons name={icon} size={20} color={palette.primary} />
      <Text style={[styles.quickLinkText, { color: palette.ink }]}>{label}</Text>
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
  subtitle: { fontSize: 14, fontFamily: fontFamilies.bodyRegular, marginBottom: spacing.sm },
  card: { marginBottom: spacing.md, gap: spacing.sm },
  eyebrow: {
    fontSize: 12,
    fontFamily: fontFamilies.bodyBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle: { fontSize: 16, fontFamily: fontFamilies.displayBold },
  milestoneRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  milestoneIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneTitle: { fontSize: 15, fontFamily: fontFamilies.bodyBold },
  milestoneDesc: { fontSize: 13, fontFamily: fontFamilies.bodyRegular, marginTop: 2 },
  linkRow: { flexDirection: "row", gap: spacing.sm },
  quickLink: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  quickLinkText: { fontSize: 12, fontFamily: fontFamilies.bodyBold },
});
