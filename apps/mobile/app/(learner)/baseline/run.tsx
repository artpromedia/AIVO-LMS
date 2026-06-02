import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { Card, Button } from "@/components/ui";
import { LoadingState } from "@aivo/mobile-ui";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { fetchBaselineQuestions, type BaselineQuestion } from "@/src/api/baselineClient";

/**
 * Learner adaptive baseline runner (MOB-LRN-005) — mirror of web's
 * /learner/baseline/[baselineId]. Calm question flow with progress dots,
 * a break cadence, supports banner, and a completion hero.
 *
 * Questions come from assessment-svc (`/api/assessments/learner/baseline/
 * :learnerId`), which serves an AI-generated set or a curated fallback bank
 * — so there is no hardcoded client-side item source.
 */
const BREAK_EVERY = 3;

type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "not_ready"; message: string }
  | { kind: "ready"; questions: BaselineQuestion[] };

export default function LearnerBaselineRunScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { user } = useAuth();
  const learnerId = user?.id ?? "";

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [i, setI] = useState(0);
  const [onBreak, setOnBreak] = useState(false);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    if (!learnerId) {
      setState({ kind: "error" });
      return;
    }
    setState({ kind: "loading" });
    try {
      const res = await fetchBaselineQuestions(learnerId);
      if (res.status === "not_ready") {
        setState({ kind: "not_ready", message: res.message });
      } else {
        setState({ kind: "ready", questions: res.questions });
      }
    } catch {
      setState({ kind: "error" });
    }
  }, [learnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const questions = state.kind === "ready" ? state.questions : [];

  const answer = () => {
    const nextIdx = i + 1;
    if (nextIdx >= questions.length) return setDone(true);
    if (nextIdx % BREAK_EVERY === 0) setOnBreak(true);
    setI(nextIdx);
  };

  if (state.kind === "loading") {
    return (
      <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
        <LoadingState />
      </ResponsiveScreen>
    );
  }

  if (state.kind === "error") {
    return (
      <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
        <Card tone="hero" style={[styles.card, { alignItems: "center", marginTop: spacing.xl }]}>
          <View style={[styles.iconWrap, { backgroundColor: palette.accentSoft }]}>
            <Ionicons name="cloud-offline" size={30} color={palette.accent} />
          </View>
          <Text style={[styles.h1, { color: palette.ink, textAlign: "center" }]}>
            {t("baselineRun.errorTitle", "We couldn't load your baseline")}
          </Text>
          <Text style={[styles.body, { color: palette.inkMuted, textAlign: "center" }]}>
            {t("baselineRun.errorBody", "Check your connection and try again.")}
          </Text>
          <Button
            title={t("common.retry", "Try again")}
            onPress={() => void load()}
            fullWidth
            size="lg"
            style={{ marginTop: spacing.md }}
          />
        </Card>
      </ResponsiveScreen>
    );
  }

  if (state.kind === "not_ready") {
    return (
      <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
        <Card tone="hero" style={[styles.card, { alignItems: "center", marginTop: spacing.xl }]}>
          <View style={[styles.iconWrap, { backgroundColor: palette.accentSoft }]}>
            <Ionicons name="time" size={30} color={palette.accent} />
          </View>
          <Text style={[styles.h1, { color: palette.ink, textAlign: "center" }]}>
            {t("baselineRun.notReadyTitle", "Almost there")}
          </Text>
          <Text style={[styles.body, { color: palette.inkMuted, textAlign: "center" }]}>
            {state.message}
          </Text>
          <Button
            title={t("baselineRun.finish", "Finish")}
            onPress={() => router.replace("/(learner)" as never)}
            fullWidth
            size="lg"
            style={{ marginTop: spacing.md }}
          />
        </Card>
      </ResponsiveScreen>
    );
  }

  if (done) {
    return (
      <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
        <Card tone="hero" style={[styles.card, { alignItems: "center", marginTop: spacing.xl }]}>
          <View style={[styles.iconWrap, { backgroundColor: "#22c55e1A" }]}>
            <Ionicons name="checkmark-circle" size={34} color="#22c55e" />
          </View>
          <Text style={[styles.h1, { color: palette.ink, textAlign: "center" }]}>
            {t("baselineRun.doneTitle", "Great work!")}
          </Text>
          <Text style={[styles.body, { color: palette.inkMuted, textAlign: "center" }]}>
            {t(
              "baselineRun.doneBody",
              "You finished your baseline. AIVO will use this to build your learning plan.",
            )}
          </Text>
          <Button
            title={t("baselineRun.finish", "Finish")}
            onPress={() => router.replace("/(learner)" as never)}
            fullWidth
            size="lg"
            style={{ marginTop: spacing.md }}
          />
        </Card>
      </ResponsiveScreen>
    );
  }

  if (onBreak) {
    return (
      <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
        <Card tone="hero" style={[styles.card, { alignItems: "center", marginTop: spacing.xl }]}>
          <View style={[styles.iconWrap, { backgroundColor: palette.accentSoft }]}>
            <Ionicons name="cafe" size={30} color={palette.accent} />
          </View>
          <Text style={[styles.h1, { color: palette.ink }]}>
            {t("baselineRun.breakTitle", "Take a breath")}
          </Text>
          <Text style={[styles.body, { color: palette.inkMuted, textAlign: "center" }]}>
            {t("baselineRun.breakBody", "Stretch, sip some water, and continue when you're ready.")}
          </Text>
          <Button
            title={t("baselineRun.continue", "Keep going")}
            onPress={() => setOnBreak(false)}
            fullWidth
            size="lg"
            style={{ marginTop: spacing.md }}
          />
        </Card>
      </ResponsiveScreen>
    );
  }

  const item = questions[i];
  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <View style={[styles.supports, { backgroundColor: palette.accentSoft }]}>
        <Ionicons name="volume-high" size={16} color={palette.accent} />
        <Text style={[styles.supportsText, { color: palette.ink }]}>
          {t("baselineRun.supports", "Read-aloud + extra time are on")}
        </Text>
      </View>
      <View style={styles.dots}>
        {questions.map((_, idx) => (
          <View
            key={idx}
            style={[
              styles.dot,
              {
                backgroundColor: idx <= i ? palette.primary : palette.border,
                width: idx === i ? 22 : 8,
              },
            ]}
          />
        ))}
      </View>
      <Card tone="raised" style={[styles.card, { marginTop: spacing.md }]}>
        <Text style={[styles.count, { color: palette.inkMuted }]}>
          {t("baselineRun.progress", {
            n: i + 1,
            total: questions.length,
            defaultValue: `Question ${i + 1} of ${questions.length}`,
          })}
        </Text>
        <Text style={[styles.question, { color: palette.ink }]}>{item.q}</Text>
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          {item.options.map((opt, idx) => (
            <Pressable
              key={`${item.id}-${idx}`}
              accessibilityRole="button"
              accessibilityLabel={opt}
              onPress={answer}
              style={[
                styles.option,
                { borderColor: palette.border, backgroundColor: palette.bgPage },
              ]}
            >
              <Text style={[styles.optionText, { color: palette.ink }]}>{opt}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  supports: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },
  supportsText: { fontSize: 12, fontFamily: fontFamilies.bodySemiBold },
  dots: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md },
  dot: { height: 8, borderRadius: 4 },
  card: { gap: spacing.sm },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  h1: { fontSize: 22, fontFamily: fontFamilies.displayBold },
  body: { fontSize: 14, fontFamily: fontFamilies.bodyRegular, lineHeight: 21 },
  count: {
    fontSize: 12,
    fontFamily: fontFamilies.bodyBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  question: { fontSize: 19, fontFamily: fontFamilies.displayBold, lineHeight: 26 },
  option: {
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  optionText: { fontSize: 16, fontFamily: fontFamilies.bodyBold },
});
