import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearner } from "@/hooks/useLearners";
import { useBrain, labelForDomain } from "@/hooks/useBrain";
import { isFlagOn } from "@/lib/feature-flags";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { Card, Button } from "@/components/ui";
import { LoadingState } from "@aivo/mobile-ui";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

const STAGES = [
  {
    key: "signals",
    label: "Reading the signals",
    desc: "Baseline answers, parent input, IEP, and accessibility needs.",
  },
  {
    key: "mastery",
    label: "Mapping mastery",
    desc: "Where your child is strong and where to support.",
  },
  {
    key: "accommodations",
    label: "Choosing supports",
    desc: "Accommodations that make learning accessible.",
  },
  { key: "tutors", label: "Picking tutors", desc: "Tutor personas matched to your child." },
  { key: "identity", label: "Shaping personality", desc: "A calm, encouraging style." },
  { key: "paths", label: "Drawing the path", desc: "An ordered plan of what's next." },
  { key: "review", label: "Ready for your review", desc: "Approve or ask for changes." },
];

/**
 * Parent brain-clone watch + approval (MOB-PAR-006) — mirror of web's
 * `/parent/learners/[learnerId]/brain-clone-watch`. Closes the gap where
 * mobile-only parents couldn't approve the initial clone. Shows the
 * build stages with XAI decisions and an approve/amend action.
 */
export default function ParentBrainCloneWatchScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const id = childId ?? "";
  const { data: learner } = useLearner(id);
  const { data: brain, isLoading, isFetching, refetch } = useBrain(id);

  const approved = brain?.approvalStatus === "approved";
  const decisions = brain?.xaiExplanation;

  // Parity with web-v2 Sprint 5: when the clone isn't ready yet, don't render
  // an empty timeline that looks broken — show an explicit "still building"
  // state with a refresh, so the visual build is never a dead end. The brain
  // hook returns {} (not null) when no clone exists, so detect emptiness via
  // the markers a built brain always carries. Gated by VISUAL_BRAIN_BUILD so
  // the change is reversible.
  const cloneReady = Boolean(
    brain && (brain.version || brain.xaiExplanation || brain.masteryLevels),
  );
  const showPending = !isLoading && !cloneReady && isFlagOn("VISUAL_BRAIN_BUILD");

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("brainClone.title", "Brain profile")} />
      {isLoading ? (
        <LoadingState />
      ) : showPending ? (
        <Card tone="hero" style={{ gap: spacing.sm, alignItems: "center" }}>
          <Ionicons name="hourglass-outline" size={30} color={palette.primary} />
          <Text style={[styles.heading, { color: palette.ink, textAlign: "center" }]}>
            {t("brainClone.pendingTitle", {
              name: learner?.firstName ?? t("parentHub.learner", "your learner"),
              defaultValue: `Building ${learner?.firstName ?? "your learner"}'s brain`,
            })}
          </Text>
          <Text style={[styles.body, { color: palette.inkMuted, textAlign: "center" }]}>
            {t(
              "brainClone.pendingBody",
              "We're assembling the brain from the baseline now. This can take a moment — refresh to check again.",
            )}
          </Text>
          <Button
            title={t("brainClone.refresh", "Refresh")}
            onPress={() => refetch()}
            loading={isFetching}
            fullWidth
            size="lg"
            style={{ marginTop: spacing.sm }}
          />
        </Card>
      ) : (
        <View style={{ gap: spacing.md }}>
          <Card tone="hero" style={{ gap: 6 }}>
            <Text style={[styles.heading, { color: palette.ink }]}>
              {approved
                ? t("brainClone.approvedTitle", "Brain profile approved")
                : t("brainClone.reviewTitle", {
                    name: learner?.firstName ?? t("parentHub.learner", "your learner"),
                    defaultValue: `Review ${learner?.firstName ?? "your learner"}'s brain profile`,
                  })}
            </Text>
            <Text style={[styles.body, { color: palette.inkMuted }]}>
              {t("brainClone.intro", "Here's how AIVO built a learning profile from what we know.")}
            </Text>
          </Card>

          {STAGES.map((s, i) => (
            <View key={s.key} style={styles.stageRow}>
              <View style={styles.rail}>
                <View style={[styles.node, { backgroundColor: palette.primary }]}>
                  <Text style={styles.nodeNum}>{i + 1}</Text>
                </View>
                {i < STAGES.length - 1 ? (
                  <View style={[styles.line, { backgroundColor: palette.border }]} />
                ) : null}
              </View>
              <View style={{ flex: 1, paddingBottom: spacing.md }}>
                <Text style={[styles.stageLabel, { color: palette.ink }]}>
                  {t(`brainClone.${s.key}`, s.label)}
                </Text>
                <Text style={[styles.stageDesc, { color: palette.inkMuted }]}>
                  {t(`brainClone.${s.key}Desc`, s.desc)}
                </Text>
                {s.key === "mastery" && decisions?.mastery_decisions?.length ? (
                  <View style={styles.chips}>
                    {decisions.mastery_decisions.slice(0, 6).map((d, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.chip,
                          { borderColor: palette.border, backgroundColor: palette.bgRaised },
                        ]}
                      >
                        <Text style={[styles.chipText, { color: palette.ink }]}>
                          {labelForDomain(d.domain)} ·{" "}
                          {Math.round((d.score > 1 ? d.score / 100 : d.score) * 100)}%
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {s.key === "accommodations" && decisions?.accommodation_decisions?.length ? (
                  <View style={styles.chips}>
                    {decisions.accommodation_decisions.slice(0, 6).map((d, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.chip,
                          { borderColor: palette.border, backgroundColor: palette.bgRaised },
                        ]}
                      >
                        <Text style={[styles.chipText, { color: palette.ink }]}>
                          {d.display_label || d.accommodation}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          ))}

          {approved ? (
            <Card tone="raised" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
              <Text style={[styles.body, { color: palette.ink, flex: 1 }]}>
                {t(
                  "brainClone.alreadyApproved",
                  "You've approved this profile. AIVO is teaching with it.",
                )}
              </Text>
            </Card>
          ) : (
            <View style={{ gap: spacing.sm }}>
              <Button
                title={t("brainClone.approve", "Approve profile")}
                onPress={() => router.push(`/(parent)/recommendations` as Href)}
                fullWidth
                size="lg"
              />
              <Button
                title={t("brainClone.amend", "Ask for changes")}
                onPress={() => router.push(`/(parent)/recommendations` as Href)}
                variant="outline"
                fullWidth
                size="lg"
              />
            </View>
          )}
        </View>
      )}
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 18, fontFamily: fontFamilies.displayBold },
  body: { fontSize: 14, fontFamily: fontFamilies.bodyRegular, lineHeight: 21 },
  stageRow: { flexDirection: "row", gap: spacing.md },
  rail: { alignItems: "center", width: 28 },
  node: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  nodeNum: { color: "#fff", fontSize: 13, fontFamily: fontFamilies.bodyBold },
  line: { width: 2, flex: 1, marginTop: 2 },
  stageLabel: { fontSize: 15, fontFamily: fontFamilies.bodyBold },
  stageDesc: { fontSize: 13, fontFamily: fontFamilies.bodyRegular, marginTop: 2, lineHeight: 19 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.lg, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: fontFamilies.bodySemiBold },
});
