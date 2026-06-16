import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { OnboardingStepper } from "@/src/components/onboarding/OnboardingStepper";
import { Card, Button } from "@/components/ui";
import { colors, spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { fetchBaselineSubjects, type BaselineSubject } from "@/src/api/baselineClient";

/**
 * Learner baseline pre-flight (MOB-LRN-004) — mirror of web's
 * /learner/baseline (+ intro/why/readiness/subjects). Calm, low-stim
 * multi-step flow that hands off to the adaptive runner.
 *
 * Subjects are fetched from assessment-svc (the same per-learner set the
 * runner uses), never a hardcoded client list — so a learner whose plan does
 * not include "Science"/"Writing" is not shown them, and web/mobile agree.
 */
export default function LearnerBaselineScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { user } = useAuth();
  const learnerId = user?.id ?? "";
  const [step, setStep] = useState(0);
  const [subjectsState, setSubjectsState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; subjects: BaselineSubject[] }
    | { kind: "error" }
  >({ kind: "loading" });
  const [picked, setPicked] = useState<string[]>([]);

  const loadSubjects = useCallback(async () => {
    if (!learnerId) {
      setSubjectsState({ kind: "error" });
      return;
    }
    setSubjectsState({ kind: "loading" });
    try {
      const subjects = await fetchBaselineSubjects(learnerId);
      setSubjectsState({ kind: "ready", subjects });
      // Default-select the first two, mirroring the prior UX, but from real data.
      setPicked(subjects.slice(0, 2).map((s) => s.key));
    } catch {
      setSubjectsState({ kind: "error" });
    }
  }, [learnerId]);

  useEffect(() => {
    void loadSubjects();
  }, [loadSubjects]);

  const next = () => setStep((n) => Math.min(n + 1, 3));

  const START_RUNNER = () => router.push(`/(learner)/baseline/run` as Href);

  if (step === 0) {
    return (
      <Shell palette={palette} step={step}>
        <Card tone="hero" style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: palette.accentSoft }]}>
            <Ionicons name="rocket" size={26} color={palette.accent} />
          </View>
          <Text style={[styles.h1, { color: palette.ink }]}>
            {t("baseline.introTitle", "Let's find your starting point")}
          </Text>
          <Text style={[styles.body, { color: palette.inkMuted }]}>
            {t(
              "baseline.introBody",
              "A short, friendly check-in. About 15 questions, with breaks. There are no wrong answers.",
            )}
          </Text>
        </Card>
        <Button
          title={t("common.next", "Next")}
          onPress={next}
          fullWidth
          size="lg"
          style={{ marginTop: spacing.md }}
        />
      </Shell>
    );
  }
  if (step === 1) {
    return (
      <Shell palette={palette} step={step}>
        <Card tone="raised" style={styles.card}>
          <Text style={[styles.h2, { color: palette.ink }]}>
            {t("baseline.whyTitle", "Why we ask")}
          </Text>
          {[
            t("baseline.why1", "It helps AIVO start at the right level for you."),
            t("baseline.why2", "Your supports (extra time, read-aloud) are on the whole way."),
            t("baseline.why3", "You can take a break whenever you need one."),
          ].map((line, i) => (
            <View key={i} style={styles.bullet}>
              <Ionicons name="checkmark-circle" size={18} color={palette.primary} />
              <Text style={[styles.body, { color: palette.ink, flex: 1 }]}>{line}</Text>
            </View>
          ))}
        </Card>
        <Button
          title={t("common.next", "Next")}
          onPress={next}
          fullWidth
          size="lg"
          style={{ marginTop: spacing.md }}
        />
      </Shell>
    );
  }
  if (step === 2) {
    return (
      <Shell palette={palette} step={step}>
        <Card tone="raised" style={styles.card}>
          <Text style={[styles.h2, { color: palette.ink }]}>
            {t("baseline.readyTitle", "Ready check")}
          </Text>
          {[
            t("baseline.ready1", "Somewhere calm to focus"),
            t("baseline.ready2", "Read-aloud is available"),
            t("baseline.ready3", "Breaks are okay anytime"),
            t("baseline.ready4", "Extra time is on"),
          ].map((line, i) => (
            <View key={i} style={[styles.checkRow, { borderColor: palette.border }]}>
              <Ionicons name="checkmark" size={18} color={colors.success} />
              <Text style={[styles.body, { color: palette.ink, flex: 1 }]}>{line}</Text>
            </View>
          ))}
        </Card>
        <Button
          title={t("common.next", "Next")}
          onPress={next}
          fullWidth
          size="lg"
          style={{ marginTop: spacing.md }}
        />
      </Shell>
    );
  }
  const subjects = subjectsState.kind === "ready" ? subjectsState.subjects : [];
  return (
    <Shell palette={palette} step={step}>
      <Card tone="raised" style={styles.card}>
        <Text style={[styles.h2, { color: palette.ink }]}>
          {t("baseline.subjectsTitle", "Pick subjects")}
        </Text>
        {subjectsState.kind === "loading" ? (
          <View style={styles.subjectsStatus}>
            <ActivityIndicator color={palette.primary} />
            <Text style={[styles.body, { color: palette.inkMuted }]}>
              {t("baseline.subjectsLoading", "Getting your subjects ready…")}
            </Text>
          </View>
        ) : subjectsState.kind === "error" || subjects.length === 0 ? (
          <View style={styles.subjectsStatus}>
            <Text style={[styles.body, { color: palette.inkMuted, textAlign: "center" }]}>
              {t(
                "baseline.subjectsEmpty",
                "We couldn't load your subjects just now. You can still start — AIVO will pick friendly questions for you.",
              )}
            </Text>
            <Button
              title={t("common.retry", "Try again")}
              onPress={() => void loadSubjects()}
              variant="outline"
              size="md"
              style={{ marginTop: spacing.sm }}
            />
          </View>
        ) : (
          <View style={styles.chips}>
            {subjects.map((s) => {
              const on = picked.includes(s.key);
              return (
                <Pressable
                  key={s.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() =>
                    setPicked((p) => (on ? p.filter((x) => x !== s.key) : [...p, s.key]))
                  }
                  style={[
                    styles.chip,
                    {
                      borderColor: on ? palette.primary : palette.border,
                      backgroundColor: on ? palette.primary : palette.bgRaised,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: on ? palette.bgRaised : palette.ink }]}>
                    {s.emoji ? `${s.emoji} ${s.label}` : s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>
      <Button
        title={t("baseline.start", "Start")}
        onPress={START_RUNNER}
        // Allow starting when subjects couldn't load (the runner doesn't depend
        // on the picker); otherwise require at least one pick.
        disabled={subjects.length > 0 && picked.length === 0}
        fullWidth
        size="lg"
        style={{ marginTop: spacing.md }}
      />
    </Shell>
  );
}

function Shell({
  children,
  palette,
  step,
}: {
  children: React.ReactNode;
  palette: ReturnType<typeof useSensoryPalette>;
  step: number;
}) {
  const { t } = useTranslation();
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
          {t("baseline.title", "Baseline")}
        </Text>
        <View style={{ width: 44 }} />
      </View>
      <OnboardingStepper steps={4} current={step} />
      {children}
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
  card: { gap: spacing.sm },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  h1: { fontSize: 20, fontFamily: fontFamilies.displayBold },
  h2: { fontSize: 18, fontFamily: fontFamilies.displayBold },
  body: { fontSize: 14, fontFamily: fontFamilies.bodyRegular, lineHeight: 21 },
  bullet: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.lg, borderWidth: 1 },
  chipText: { fontSize: 14, fontFamily: fontFamilies.bodyBold },
  subjectsStatus: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
});
