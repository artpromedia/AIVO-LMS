import React, { useState } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearner } from "@/hooks/useLearners";
import { useBrain, labelForDomain } from "@/hooks/useBrain";
import { isFlagOn } from "@/lib/feature-flags";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { Card, Button } from "@/components/ui";
import { LoadingState } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";
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
 * Path of the web review page for a learner — the mobile mirror of
 * `apps/web-v2/app/parent/learners/[learnerId]/brain-clone-watch`. Also
 * what "Copy link" copies when the build has no web origin configured.
 */
function webReviewPath(learnerId: string): string {
  return `/parent/learners/${learnerId}/brain-clone-watch`;
}

/**
 * Web-app origin for the parent review link. The mobile app has no
 * canonical web-origin constant yet (`constants/api.ts` only knows
 * API-service origins), so this resolves the same way those service
 * origins do: the `EXPO_PUBLIC_WEB_URL` build-time env var in
 * production builds, and the local web-v2 dev server in development
 * (port 5000 per `apps/web-v2/package.json`, host mapping matching
 * `DEV_HOST` in `constants/api.ts`). Returns null when a production
 * build shipped without `EXPO_PUBLIC_WEB_URL`; the handoff card then
 * renders its copy-link-only state instead of a dead "open" button.
 * If a second screen ever needs web URLs, graduate this into a shared
 * constant next to `constants/api.ts`.
 */
function resolveWebOrigin(): string | null {
  const configured = (process.env.EXPO_PUBLIC_WEB_URL || "").replace(/\/+$/, "");
  if (configured) return configured;
  if (__DEV__) {
    return (
      Platform.select({
        android: "http://10.0.2.2:5000",
        default: "http://localhost:5000",
      }) ?? null
    );
  }
  return null;
}

/**
 * Parent brain-clone watch (MOB-PAR-006) — mirror of web's
 * `/parent/learners/[learnerId]/brain-clone-watch`. Parents review the
 * build stages and XAI decisions here; the approval itself (which
 * captures COPPA consent + the Responsible-AI acknowledgement) happens
 * on the web review page. Mobile therefore treats web review as the
 * product contract: the unapproved state renders an honest open/copy
 * handoff instead of approval controls this screen cannot honor.
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
            <WebReviewHandoff
              learnerId={id}
              name={learner?.firstName ?? t("parentHub.learner", "your learner")}
            />
          )}
        </View>
      )}
    </ResponsiveScreen>
  );
}

type HandoffNotice = "copied" | "openFailed" | "copyFailed";

/**
 * Honest unapproved-state handoff. Mobile shows the full review above;
 * the approval itself — which captures COPPA consent and the
 * Responsible-AI acknowledgement — lives on the web review page, so this
 * card opens (or copies) that page's link instead of rendering
 * approve/amend controls the app cannot honor.
 * When no web origin is configured for the build, the open button is
 * not rendered at all (never a dead tap) and copy-link carries the
 * page path.
 */
function WebReviewHandoff({ learnerId, name }: { learnerId: string; name: string }) {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const [notice, setNotice] = useState<HandoffNotice | null>(null);

  const path = webReviewPath(learnerId);
  const origin = resolveWebOrigin();
  const url = origin ? `${origin}${path}` : null;

  // Only rendered behind `url ?`, so `url` is always a string here; guard
  // anyway so a future caller can't fall through to a dead tap.
  const handleOpen = async () => {
    if (!url) {
      setNotice("openFailed");
      return;
    }
    try {
      await Linking.openURL(url);
      setNotice(null);
    } catch {
      setNotice("openFailed");
    }
  };

  const handleCopy = async () => {
    try {
      const copied = await Clipboard.setStringAsync(url ?? path);
      setNotice(copied ? "copied" : "copyFailed");
    } catch {
      setNotice("copyFailed");
    }
  };

  const noticeText =
    notice === "copied"
      ? url
        ? t("brainClone.linkCopied", "Link copied — paste it into your browser when you're ready.")
        : t(
            "brainClone.pathCopied",
            "Copied — paste it after your AIVO web address in your browser.",
          )
      : notice === "openFailed"
        ? t(
            "brainClone.openOnWebFailed",
            "We couldn't open your browser from here. Copy the link instead — it works anywhere.",
          )
        : notice === "copyFailed"
          ? t(
              "brainClone.copyLinkFailed",
              "Copying didn't work on this device. Sign in to AIVO on the web to review and approve.",
            )
          : null;

  return (
    <Card tone="raised" style={{ gap: spacing.sm }}>
      <View style={styles.handoffRow}>
        <Ionicons name="laptop-outline" size={22} color={palette.primary} />
        <Text style={[styles.body, { color: palette.ink, flex: 1 }]}>
          {t("brainClone.webHandoff", {
            name,
            defaultValue: `Reviewing and approving ${name}'s profile happens on the web for now.`,
          })}
        </Text>
      </View>
      {url ? (
        <Button
          title={t("brainClone.openOnWeb", "Open on the web")}
          accessibilityLabel={t("brainClone.openOnWebA11y", {
            name,
            defaultValue: `Open ${name}'s profile review on the web`,
          })}
          onPress={handleOpen}
          fullWidth
          size="lg"
        />
      ) : (
        <Text style={[styles.body, { color: palette.inkMuted }]}>
          {t(
            "brainClone.webHandoffNoLink",
            "Sign in to AIVO on the web to review and approve. Copy the link below to have it ready.",
          )}
        </Text>
      )}
      <Button
        title={t("brainClone.copyLink", "Copy link")}
        accessibilityLabel={t("brainClone.copyLinkA11y", {
          name,
          defaultValue: `Copy the link to ${name}'s profile review`,
        })}
        onPress={handleCopy}
        variant="outline"
        fullWidth
        size="lg"
      />
      {noticeText ? (
        <View style={styles.handoffRow} accessibilityLiveRegion="polite">
          <Ionicons
            name={notice === "copied" ? "checkmark-circle" : "alert-circle"}
            size={18}
            color={notice === "copied" ? palette.primary : colors.error}
          />
          <Text style={[styles.notice, { color: palette.ink, flex: 1 }]}>{noticeText}</Text>
        </View>
      ) : null}
    </Card>
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
  handoffRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  notice: { fontSize: 13, fontFamily: fontFamilies.bodySemiBold, lineHeight: 19 },
});
