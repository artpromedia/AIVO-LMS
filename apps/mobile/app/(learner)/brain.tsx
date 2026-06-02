import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useBrainDomains } from "@/hooks/useBrain";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { MasteryBar, LoadingState, EmptyState } from "@aivo/mobile-ui";
import { Card } from "@/components/ui";
import { subjectAccent } from "@/lib/subject-display";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Learner "Your Brain" screen — mobile counterpart of web's
 * `/learner/brain-clone/[learnerId]`. The web route is a once-per-learner
 * post-baseline awakening animation; on mobile this is the durable, calm
 * view a learner returns to: the AI tutors helping them and the map of
 * what their personal AIVO brain has learned about how they learn.
 *
 * Reads the learner's own brain (`useAuth().user.id`) via brain-svc.
 */
export default function LearnerBrainScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const palette = useSensoryPalette();
  const { domains, isLoading } = useBrainDomains(user?.id ?? "");

  const tutors = useMemo(() => {
    const set = new Set<string>();
    for (const d of domains) for (const tu of d.tutors ?? []) set.add(tu);
    return Array.from(set);
  }, [domains]);

  const sortedDomains = useMemo(
    () => [...domains].sort((a, b) => b.masteryPercent - a.masteryPercent),
    [domains],
  );

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
          {t("learnerBrain.title", "Your Brain")}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {isLoading ? (
        <LoadingState />
      ) : domains.length === 0 ? (
        <EmptyState
          title={t("learnerBrain.emptyTitle", "Your brain is waking up")}
          message={t(
            "learnerBrain.emptyBody",
            "Finish your discovery adventure and your personal AIVO brain appears here.",
          )}
        />
      ) : (
        <>
          <Card tone="hero" style={styles.heroCard}>
            <View style={[styles.brainIcon, { backgroundColor: palette.accentSoft }]}>
              <Ionicons name="bulb" size={30} color={palette.accent} />
            </View>
            <Text style={[styles.heroTitle, { color: palette.ink }]}>
              {t("learnerBrain.heroTitle", "This is your AIVO brain")}
            </Text>
            <Text style={[styles.heroBody, { color: palette.inkMuted }]}>
              {t(
                "learnerBrain.heroBody",
                "It learns how you learn — and helps your tutors meet you exactly where you are.",
              )}
            </Text>
          </Card>

          {tutors.length > 0 ? (
            <Card tone="raised" style={styles.card}>
              <Text style={[styles.sectionTitle, { color: palette.ink }]}>
                {t("learnerBrain.tutors", "Tutors helping you")}
              </Text>
              <View style={styles.tutorRow}>
                {tutors.map((tu) => (
                  <View
                    key={tu}
                    style={[
                      styles.tutorChip,
                      { backgroundColor: palette.bgPage, borderColor: palette.border },
                    ]}
                  >
                    <Ionicons name="sparkles" size={14} color={palette.accent} />
                    <Text style={[styles.tutorName, { color: palette.ink }]}>{tu}</Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          <Card tone="raised" style={styles.card}>
            <Text style={[styles.sectionTitle, { color: palette.ink }]}>
              {t("learnerBrain.knows", "What your brain knows")}
            </Text>
            <View style={{ gap: 14, marginTop: spacing.sm }}>
              {sortedDomains.map((d) => (
                <MasteryBar
                  key={d.domain}
                  label={d.domain}
                  value={d.masteryPercent}
                  tone={subjectAccent(d.domain)}
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
  title: { fontSize: 22, fontFamily: fontFamilies.displayBold },
  heroCard: { alignItems: "center", gap: 8, marginBottom: spacing.md },
  brainIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { fontSize: 18, fontFamily: fontFamilies.displayBold, textAlign: "center" },
  heroBody: { fontSize: 14, fontFamily: fontFamilies.bodyRegular, textAlign: "center" },
  card: { marginBottom: spacing.md, gap: 4 },
  sectionTitle: { fontSize: 16, fontFamily: fontFamilies.displayBold },
  tutorRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm },
  tutorChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  tutorName: { fontSize: 13, fontFamily: fontFamilies.bodyBold, textTransform: "capitalize" },
});
