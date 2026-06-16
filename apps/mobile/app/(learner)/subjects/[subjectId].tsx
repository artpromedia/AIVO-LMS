import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useBrainDomains } from "@/hooks/useBrain";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import {
  MasteryBar,
  MasteryHeatStrip,
  LoadingState,
  EmptyState,
  type MasteryCell,
} from "@aivo/mobile-ui";
import { Card } from "@/components/ui";
import { useGradebook } from "@/hooks/useGradebook";
import { skillsForSubject } from "@/lib/gradebook-logic";
import { masteryLabel } from "@/lib/subject-display";
import { getSubjectBySlug, getDiscoverableSubjects, TUTORS } from "@aivo/brand";
import { colors, spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Learner subject detail — mirror of web's `/learner/subjects/[subjectId]`
 * (MOB-LRN-003). Sprint 1 (subject/tutor UX): resolved from the canonical
 * `@aivo/brand` registry by slug so every subject (not just brain-seeded
 * ones) is reachable. Shows the subject's mastery (merged from brain-svc
 * when present), per-skill grid, its tutor, and a CTA that launches the
 * subject's tutor session end-to-end.
 */
export default function SubjectDetailScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const palette = useSensoryPalette();
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const { domains, isLoading } = useBrainDomains(user?.id ?? "");

  const slug = decodeURIComponent(subjectId ?? "");
  // Resolve by slug; fall back to a name match for any legacy deep link.
  const subject =
    getSubjectBySlug(slug) ??
    getDiscoverableSubjects().find((s) => s.name.toLowerCase() === slug.toLowerCase());
  const tutor = subject ? TUTORS[subject.tutorKey] : undefined;
  const name = subject?.name ?? slug;
  const accent = tutor?.color ?? colors.accent;
  const domain = useMemo(
    () => domains.find((d) => d.domain.toLowerCase() === name.toLowerCase()),
    [domains, name],
  );
  const masteryPct = domain?.masteryPercent ?? 0;
  const { data: gradebook } = useGradebook(user?.id ?? "");
  const skills = useMemo(() => skillsForSubject(gradebook ?? [], name), [gradebook, name]);

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
        <Text style={[styles.title, { color: palette.ink }]} numberOfLines={1}>
          {name}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {isLoading ? (
        <LoadingState />
      ) : !subject ? (
        <EmptyState
          title={t("subjects.notFoundTitle", "Subject not found")}
          message={t("subjects.notFoundBody", "Head back to your subjects to pick one.")}
        />
      ) : (
        <>
          <Card tone="raised" style={styles.card}>
            <Text style={[styles.eyebrow, { color: accent }]}>{masteryLabel(masteryPct)}</Text>
            <MasteryBar
              value={masteryPct}
              tone={accent}
              caption={t("subjects.masteryCaption", "Your mastery so far")}
            />
          </Card>

          {skills.length > 0 && (
            <Card tone="raised" style={styles.card}>
              <Text style={[styles.sectionTitle, { color: palette.ink }]}>
                {t("subjects.skills", "Skills")}
              </Text>
              <View style={{ marginTop: spacing.sm }}>
                <MasteryHeatStrip
                  cells={skills.map(
                    (sk): MasteryCell => ({ code: sk.skill, name: sk.skill, level: sk.level }),
                  )}
                />
              </View>
              <View style={{ gap: 12, marginTop: spacing.md }}>
                {skills.map((sk) => (
                  <MasteryBar key={sk.skill} label={sk.skill} value={sk.score} tone={accent} />
                ))}
              </View>
            </Card>
          )}

          {tutor && (
            <Card tone="raised" style={styles.card}>
              <Text style={[styles.sectionTitle, { color: palette.ink }]}>
                {t("subjects.tutors", "Your tutor")}
              </Text>
              <View style={styles.chips}>
                <View
                  style={[
                    styles.chip,
                    { borderColor: palette.border, backgroundColor: palette.bgPage },
                  ]}
                >
                  <Ionicons name="sparkles" size={14} color={accent} />
                  <Text style={[styles.chipText, { color: palette.ink }]}>
                    {tutor.name} · {tutor.domain}
                  </Text>
                </View>
                <View
                  style={[
                    styles.chip,
                    { borderColor: palette.border, backgroundColor: palette.bgPage },
                  ]}
                >
                  <Ionicons name="chatbubbles" size={14} color={accent} />
                  <Text style={[styles.chipText, { color: palette.ink }]}>
                    {t("subjects.agenticScope", "Guidance for PRE-K through grade 12")}
                  </Text>
                </View>
              </View>
            </Card>
          )}

          {(domain?.accommodations.length ?? 0) > 0 && domain && (
            <Card tone="raised" style={styles.card}>
              <Text style={[styles.sectionTitle, { color: palette.ink }]}>
                {t("subjects.supports", "Supports turned on")}
              </Text>
              <View style={styles.chips}>
                {domain.accommodations.map((a) => (
                  <View
                    key={a}
                    style={[
                      styles.chip,
                      { borderColor: palette.border, backgroundColor: palette.bgPage },
                    ]}
                  >
                    <Ionicons name="heart" size={14} color={accent} />
                    <Text style={[styles.chipText, { color: palette.ink }]}>{a}</Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("subjects.exploreWithTutor", "Explore with your tutor")}
            onPress={() => router.push(`/(learner)/tutor/${subject.tutorKey}` as Href)}
            style={[styles.cta, { backgroundColor: accent }]}
          >
            <Ionicons name="chatbubbles" size={18} color={colors.white} />
            <Text style={styles.ctaText}>
              {t("subjects.exploreWithTutor", "Explore with your tutor")}
            </Text>
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
  title: { flex: 1, textAlign: "center", fontSize: 20, fontFamily: fontFamilies.displayBold },
  card: { marginBottom: spacing.md, gap: spacing.sm },
  eyebrow: {
    fontSize: 12,
    fontFamily: fontFamilies.bodyBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionTitle: { fontSize: 16, fontFamily: fontFamilies.displayBold },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontFamily: fontFamilies.bodySemiBold },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: radius.xl,
  },
  ctaText: { color: colors.white, fontSize: 16, fontFamily: fontFamilies.bodyBold },
});
