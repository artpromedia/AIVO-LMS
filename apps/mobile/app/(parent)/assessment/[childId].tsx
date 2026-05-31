import React, { useState, useCallback } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearner } from "@/hooks/useLearners";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { OnboardingStepper } from "@/src/components/onboarding/OnboardingStepper";
import { Card, Button } from "@/components/ui";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { INCLUSIVE_WARM_PALETTE } from "@aivo/brand";

interface Step {
  key: string;
  title: string;
  prompt: string;
  placeholder: string;
}

const STEPS: Step[] = [
  { key: "goals", title: "Goals", prompt: "What do you hope AIVO helps with?", placeholder: "e.g. confidence in reading" },
  { key: "strengths", title: "Strengths", prompt: "What is your child great at?", placeholder: "e.g. curious, loves stories" },
  { key: "challenges", title: "Challenges", prompt: "Where do they need support?", placeholder: "e.g. focus, math facts" },
  { key: "communication", title: "Communication", prompt: "How do they communicate best?", placeholder: "e.g. visuals, short steps" },
  { key: "sensory", title: "Sensory", prompt: "Any sensory needs to know about?", placeholder: "e.g. quiet spaces" },
  { key: "motivation", title: "Motivation", prompt: "What motivates them?", placeholder: "e.g. earning badges" },
  { key: "concerns", title: "Concerns", prompt: "Anything else we should know?", placeholder: "Optional" },
];

/**
 * Parent assessment wizard (MOB-PAR-004) — mirror of web's multi-step
 * `/parent/learners/[learnerId]/assessment`. Per-section state with a
 * progress stepper; review + submit land on the submitted screen.
 * (Intro/review/submitted states are folded into this single flow.)
 */
export default function ParentAssessmentScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const id = childId ?? "";
  const { data: learner } = useLearner(id);

  const [phase, setPhase] = useState<"intro" | "steps" | "review" | "done">("intro");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const set = useCallback((k: string, v: string) => setAnswers((a) => ({ ...a, [k]: v })), []);
  const name = learner?.firstName ?? t("parentHub.learner", "your learner");

  if (phase === "intro") {
    return (
      <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
        <ScreenHeader title={t("assessment.title", "Getting to know your learner")} />
        <Card tone="hero" style={{ gap: spacing.sm }}>
          <View style={[styles.iconWrap, { backgroundColor: INCLUSIVE_WARM_PALETTE.primarySoft }]}>
            <Ionicons name="sparkles" size={26} color={palette.primary} />
          </View>
          <Text style={[styles.h1, { color: palette.ink }]}>
            {t("assessment.introTitle", { name, defaultValue: `Tell us about ${name}` })}
          </Text>
          <Text style={[styles.body, { color: palette.inkMuted }]}>
            {t("assessment.introBody", "A few short questions help AIVO personalise from day one. There are no wrong answers, and you can edit later.")}
          </Text>
        </Card>
        <Button title={t("assessment.begin", "Begin")} onPress={() => setPhase("steps")} fullWidth size="lg" style={{ marginTop: spacing.md }} />
      </ResponsiveScreen>
    );
  }

  if (phase === "done") {
    return (
      <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
        <ScreenHeader title={t("assessment.doneTitle", "All done")} />
        <Card tone="raised" style={{ gap: spacing.sm, alignItems: "center" }}>
          <View style={[styles.iconWrap, { backgroundColor: "#22c55e1A" }]}>
            <Ionicons name="checkmark-circle" size={30} color="#22c55e" />
          </View>
          <Text style={[styles.h1, { color: palette.ink, textAlign: "center" }]}>
            {t("assessment.submitted", "Thank you!")}
          </Text>
          <Text style={[styles.body, { color: palette.inkMuted, textAlign: "center" }]}>
            {t("assessment.submittedBody", { name, defaultValue: `We'll use this to tailor ${name}'s experience.` })}
          </Text>
        </Card>
        <Button title={t("assessment.backToProfile", "Back to profile")} onPress={() => router.replace(`/(parent)/learners/${id}` as never)} fullWidth size="lg" style={{ marginTop: spacing.md }} />
      </ResponsiveScreen>
    );
  }

  if (phase === "review") {
    return (
      <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
        <ScreenHeader title={t("assessment.reviewTitle", "Review")} />
        <View style={{ gap: spacing.sm }}>
          {STEPS.map((s) => (
            <Card key={s.key} tone="raised" style={{ gap: 4 }}>
              <Text style={[styles.reviewLabel, { color: palette.inkMuted }]}>{t(`assessment.${s.key}`, s.title)}</Text>
              <Text style={[styles.reviewVal, { color: palette.ink }]}>
                {answers[s.key]?.trim() || t("assessment.skipped", "—")}
              </Text>
            </Card>
          ))}
        </View>
        <Button title={t("assessment.submit", "Submit")} onPress={() => setPhase("done")} fullWidth size="lg" style={{ marginTop: spacing.md }} />
        <Pressable onPress={() => { setPhase("steps"); setStep(0); }} style={{ paddingVertical: spacing.md, alignItems: "center" }}>
          <Text style={[styles.editLink, { color: palette.primary }]}>{t("assessment.edit", "Edit answers")}</Text>
        </Pressable>
      </ResponsiveScreen>
    );
  }

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("assessment.title", "About your learner")} />
      <OnboardingStepper steps={STEPS.length} current={step} />
      <Card tone="raised" style={{ gap: spacing.sm }}>
        <Text style={[styles.stepTitle, { color: palette.ink }]}>{t(`assessment.${current.key}`, current.title)}</Text>
        <Text style={[styles.prompt, { color: palette.inkMuted }]}>{t(`assessment.${current.key}Prompt`, current.prompt)}</Text>
        <TextInput
          value={answers[current.key] ?? ""}
          onChangeText={(v) => set(current.key, v)}
          placeholder={current.placeholder}
          placeholderTextColor={palette.inkMuted}
          multiline
          style={[styles.input, { borderColor: palette.border, color: palette.ink, backgroundColor: palette.bgPage }]}
          accessibilityLabel={current.prompt}
        />
      </Card>
      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
        {step > 0 ? (
          <View style={{ flex: 1 }}>
            <Button title={t("common.back", "Back")} onPress={() => setStep((n) => n - 1)} variant="outline" fullWidth />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Button
            title={last ? t("assessment.review", "Review") : t("common.next", "Next")}
            onPress={() => (last ? setPhase("review") : setStep((n) => n + 1))}
            fullWidth
          />
        </View>
      </View>
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  h1: { fontSize: 20, fontFamily: fontFamilies.displayBold },
  body: { fontSize: 14, fontFamily: fontFamilies.bodyRegular, lineHeight: 21 },
  stepTitle: { fontSize: 18, fontFamily: fontFamilies.displayBold },
  prompt: { fontSize: 14, fontFamily: fontFamilies.bodyRegular },
  input: { minHeight: 96, borderWidth: 1.5, borderRadius: radius.lg, padding: spacing.md, fontSize: 16, fontFamily: fontFamilies.bodyRegular, textAlignVertical: "top" },
  reviewLabel: { fontSize: 12, fontFamily: fontFamilies.bodyBold, textTransform: "uppercase", letterSpacing: 0.5 },
  reviewVal: { fontSize: 15, fontFamily: fontFamilies.bodyRegular },
  editLink: { fontSize: 14, fontFamily: fontFamilies.bodyBold },
  stepCount: { fontSize: 12 },
});
