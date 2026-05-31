import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useBrainDomains } from "@/hooks/useBrain";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { MasteryBar, LoadingState, EmptyState } from "@aivo/mobile-ui";
import { Card } from "@/components/ui";
import { subjectAccent, masteryLabel } from "@/lib/subject-display";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Learner subject detail — mirror of web's `/learner/subjects/[subjectId]`
 * (MOB-LRN-003). Shows the subject's mastery, the supports + tutors the
 * brain has switched on for it, and a CTA into a lesson. The per-skill
 * mastery grid is pending a skills REST endpoint on mobile (Partial).
 */
export default function SubjectDetailScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const palette = useSensoryPalette();
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const { domains, isLoading } = useBrainDomains(user?.id ?? "");

  const name = decodeURIComponent(subjectId ?? "");
  const domain = useMemo(
    () => domains.find((d) => d.domain.toLowerCase() === name.toLowerCase()),
    [domains, name],
  );
  const accent = subjectAccent(name);

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
      ) : !domain ? (
        <EmptyState
          title={t("subjects.notFoundTitle", "Subject not found")}
          message={t("subjects.notFoundBody", "Head back to your subjects to pick one.")}
        />
      ) : (
        <>
          <Card tone="raised" style={styles.card}>
            <Text style={[styles.eyebrow, { color: accent }]}>
              {masteryLabel(domain.masteryPercent)}
            </Text>
            <MasteryBar
              value={domain.masteryPercent}
              tone={accent}
              caption={t("subjects.masteryCaption", "Your mastery so far")}
            />
          </Card>

          {domain.tutors.length > 0 && (
            <Card tone="raised" style={styles.card}>
              <Text style={[styles.sectionTitle, { color: palette.ink }]}>
                {t("subjects.tutors", "Your tutors")}
              </Text>
              <View style={styles.chips}>
                {domain.tutors.map((tutor) => (
                  <View
                    key={tutor}
                    style={[
                      styles.chip,
                      { borderColor: palette.border, backgroundColor: palette.bgPage },
                    ]}
                  >
                    <Ionicons name="sparkles" size={14} color={accent} />
                    <Text style={[styles.chipText, { color: palette.ink }]}>{tutor}</Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {domain.accommodations.length > 0 && (
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
            accessibilityLabel={t("subjects.startLesson", "Start a lesson")}
            onPress={() => router.push("/(learner)/homework" as Href)}
            style={[styles.cta, { backgroundColor: accent }]}
          >
            <Ionicons name="play" size={18} color="#fff" />
            <Text style={styles.ctaText}>{t("subjects.startLesson", "Start a lesson")}</Text>
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
  ctaText: { color: "#fff", fontSize: 16, fontFamily: fontFamilies.bodyBold },
});
