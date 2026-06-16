import React, { useState, useCallback } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearner } from "@/hooks/useLearners";
import { useSubmitParentAssessment } from "@/hooks/useParentAssessment";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { OnboardingStepper } from "@/src/components/onboarding/OnboardingStepper";
import { Card, Button } from "@/components/ui";
import { colors, spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { INCLUSIVE_WARM_PALETTE } from "@aivo/brand";

type Option = { value: string; label: string };

interface Step {
  key: string;
  title: string;
  prompt: string;
  /** "select" persists a structured functioning-level signal; "text" is a
   *  free-text section stored on the assessment's responses. */
  kind: "select" | "text";
  /** Required selects must be answered before the assessment can submit. */
  required?: boolean;
  options?: Option[];
  placeholder?: string;
}

// The three required selects drive the server-side functioning-level router
// (assessment-svc → determineFunctioningLevel); the free-text sections are
// preserved on the row's `responses` for the tutor + brain build.
const STEPS: Step[] = [
  {
    key: "communicationMode",
    title: "Communication",
    prompt: "How does your child communicate best?",
    kind: "select",
    required: true,
    options: [
      { value: "verbal", label: "Speaks in sentences" },
      { value: "limited_verbal", label: "Some words / phrases" },
      { value: "non_verbal", label: "Non-speaking" },
      { value: "aac_device", label: "Uses an AAC device" },
      { value: "sign_language", label: "Sign language" },
      { value: "pre_symbolic", label: "Pre-symbolic" },
    ],
  },
  {
    key: "responseMethod",
    title: "Responding",
    prompt: "How do they answer questions most comfortably?",
    kind: "select",
    required: true,
    options: [
      { value: "voice", label: "Voice" },
      { value: "typing", label: "Typing" },
      { value: "touch_select", label: "Tapping / selecting" },
      { value: "switch_scan", label: "Switch scanning" },
      { value: "partner_response", label: "Through a partner" },
    ],
  },
  {
    key: "deviceInteraction",
    title: "Using a device",
    prompt: "How do they use a tablet or computer?",
    kind: "select",
    required: true,
    options: [
      { value: "independent", label: "Independently" },
      { value: "guided", label: "With guidance" },
      { value: "switch_access", label: "Switch access" },
      { value: "eye_gaze", label: "Eye gaze" },
      { value: "partner_assisted", label: "Partner-assisted" },
    ],
  },
  {
    key: "attentionSpan",
    title: "Focus",
    prompt: "How long can they usually stay focused?",
    kind: "select",
    options: [
      { value: "typical", label: "Typical for their age" },
      { value: "short", label: "Short" },
      { value: "very_short", label: "Very short" },
      { value: "variable", label: "Varies a lot" },
      { value: "task_dependent", label: "Depends on the task" },
    ],
  },
  {
    key: "goals",
    title: "Goals",
    prompt: "What do you hope AIVO helps with?",
    kind: "text",
    placeholder: "e.g. confidence in reading",
  },
  {
    key: "strengths",
    title: "Strengths",
    prompt: "What is your child great at?",
    kind: "text",
    placeholder: "e.g. curious, loves stories",
  },
  {
    key: "challenges",
    title: "Challenges",
    prompt: "Where do they need support?",
    kind: "text",
    placeholder: "e.g. focus, math facts",
  },
  {
    key: "sensory",
    title: "Sensory",
    prompt: "Any sensory needs to know about?",
    kind: "text",
    placeholder: "e.g. quiet spaces",
  },
  {
    key: "motivation",
    title: "Motivation",
    prompt: "What motivates them?",
    kind: "text",
    placeholder: "e.g. earning badges",
  },
  {
    key: "concerns",
    title: "Concerns",
    prompt: "Anything else we should know?",
    kind: "text",
    placeholder: "Optional",
  },
];

const REQUIRED_KEYS = STEPS.filter((s) => s.required).map((s) => s.key);
const TEXT_KEYS = STEPS.filter((s) => s.kind === "text").map((s) => s.key);

/**
 * Parent assessment wizard (MOB-PAR-004) — mirror of web's multi-step
 * `/parent/learners/[learnerId]/assessment`. Per-section state with a
 * progress stepper. On submit it PERSISTS to assessment-svc (the wizard was
 * previously local-state only and never saved); the three required selects
 * drive the functioning-level router and the free-text sections are kept on
 * the row's responses.
 */
export default function ParentAssessmentScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const id = childId ?? "";
  const { data: learner } = useLearner(id);
  const submit = useSubmitParentAssessment();

  const [phase, setPhase] = useState<"intro" | "steps" | "review" | "done">("intro");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const set = useCallback((k: string, v: string) => setAnswers((a) => ({ ...a, [k]: v })), []);
  const name = learner?.firstName ?? t("parentHub.learner", "your learner");

  const labelFor = useCallback((s: Step, value: string | undefined): string => {
    if (!value) return t("assessment.skipped", "—");
    if (s.kind === "select") return s.options?.find((o) => o.value === value)?.label ?? value;
    return value;
  }, [t]);

  const handleSubmit = useCallback(async () => {
    // No silent success (parity with web-v2): require the structured signals,
    // and only advance to "done" once the server confirms the save.
    const firstMissing = REQUIRED_KEYS.findIndex((k) => !answers[k]);
    if (firstMissing !== -1) {
      const missingStepIndex = STEPS.findIndex((s) => s.key === REQUIRED_KEYS[firstMissing]);
      Alert.alert(
        t("common.error", "Please finish"),
        t("assessment.missingRequired", "Please answer the communication questions first."),
      );
      setPhase("steps");
      setStep(missingStepIndex === -1 ? 0 : missingStepIndex);
      return;
    }
    const additionalResponses: Record<string, string> = {};
    for (const k of TEXT_KEYS) {
      const v = answers[k]?.trim();
      if (v) additionalResponses[k] = v;
    }
    try {
      await submit.mutateAsync({
        learnerId: id,
        communicationMode: answers.communicationMode as never,
        responseMethod: answers.responseMethod as never,
        deviceInteraction: answers.deviceInteraction as never,
        attentionSpan: (answers.attentionSpan as never) || undefined,
        additionalResponses,
      });
      setPhase("done");
    } catch (e: any) {
      Alert.alert(
        t("common.error", "Couldn't save"),
        e?.message || t("assessment.submitFailed", "We couldn't save the assessment. Try again."),
      );
    }
  }, [answers, id, submit, t]);

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
            {t(
              "assessment.introBody",
              "A few short questions help AIVO personalise from day one. There are no wrong answers, and you can edit later.",
            )}
          </Text>
        </Card>
        <Button
          title={t("assessment.begin", "Begin")}
          onPress={() => setPhase("steps")}
          fullWidth
          size="lg"
          style={{ marginTop: spacing.md }}
        />
      </ResponsiveScreen>
    );
  }

  if (phase === "done") {
    return (
      <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
        <ScreenHeader title={t("assessment.doneTitle", "All done")} />
        <Card tone="raised" style={{ gap: spacing.sm, alignItems: "center" }}>
          <View style={[styles.iconWrap, { backgroundColor: colors.success + "1A" }]}>
            <Ionicons name="checkmark-circle" size={30} color={colors.success} />
          </View>
          <Text style={[styles.h1, { color: palette.ink, textAlign: "center" }]}>
            {t("assessment.submitted", "Thank you!")}
          </Text>
          <Text style={[styles.body, { color: palette.inkMuted, textAlign: "center" }]}>
            {t("assessment.submittedBody", {
              name,
              defaultValue: `We'll use this to tailor ${name}'s experience.`,
            })}
          </Text>
        </Card>
        <Button
          title={t("assessment.backToProfile", "Back to profile")}
          onPress={() => router.replace(`/(parent)/learners/${id}` as never)}
          fullWidth
          size="lg"
          style={{ marginTop: spacing.md }}
        />
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
              <Text style={[styles.reviewLabel, { color: palette.inkMuted }]}>
                {t(`assessment.${s.key}`, s.title)}
              </Text>
              <Text style={[styles.reviewVal, { color: palette.ink }]}>
                {labelFor(s, answers[s.key]?.trim())}
              </Text>
            </Card>
          ))}
        </View>
        <Button
          title={t("assessment.submit", "Submit")}
          onPress={handleSubmit}
          loading={submit.isPending}
          fullWidth
          size="lg"
          style={{ marginTop: spacing.md }}
        />
        <Pressable accessibilityRole="button"
          onPress={() => {
            setPhase("steps");
            setStep(0);
          }}
          style={{ paddingVertical: spacing.md, alignItems: "center" }}
        >
          <Text style={[styles.editLink, { color: palette.primary }]}>
            {t("assessment.edit", "Edit answers")}
          </Text>
        </Pressable>
      </ResponsiveScreen>
    );
  }

  const current = STEPS[step];
  const last = step === STEPS.length - 1;
  const canAdvance = !current.required || Boolean(answers[current.key]);

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("assessment.title", "About your learner")} />
      <OnboardingStepper steps={STEPS.length} current={step} />
      <Card tone="raised" style={{ gap: spacing.sm }}>
        <Text style={[styles.stepTitle, { color: palette.ink }]}>
          {t(`assessment.${current.key}`, current.title)}
        </Text>
        <Text style={[styles.prompt, { color: palette.inkMuted }]}>
          {t(`assessment.${current.key}Prompt`, current.prompt)}
        </Text>
        {current.kind === "select" ? (
          <View style={styles.options}>
            {current.options?.map((o) => {
              const selected = answers[current.key] === o.value;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => set(current.key, o.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.optionChip,
                    {
                      borderColor: selected ? palette.primary : palette.border,
                      backgroundColor: selected ? palette.primary : palette.bgPage,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: selected ? colors.white : palette.ink },
                    ]}
                  >
                    {o.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <TextInput
            value={answers[current.key] ?? ""}
            onChangeText={(v) => set(current.key, v)}
            placeholder={current.placeholder}
            placeholderTextColor={palette.inkMuted}
            multiline
            style={[
              styles.input,
              { borderColor: palette.border, color: palette.ink, backgroundColor: palette.bgPage },
            ]}
            accessibilityLabel={current.prompt}
          />
        )}
      </Card>
      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
        {step > 0 ? (
          <View style={{ flex: 1 }}>
            <Button
              title={t("common.back", "Back")}
              onPress={() => setStep((n) => n - 1)}
              variant="outline"
              fullWidth
            />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Button
            title={last ? t("assessment.review", "Review") : t("common.next", "Next")}
            onPress={() => (last ? setPhase("review") : setStep((n) => n + 1))}
            disabled={!canAdvance}
            fullWidth
          />
        </View>
      </View>
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  h1: { fontSize: 20, fontFamily: fontFamilies.displayBold },
  body: { fontSize: 14, fontFamily: fontFamilies.bodyRegular, lineHeight: 21 },
  stepTitle: { fontSize: 18, fontFamily: fontFamilies.displayBold },
  prompt: { fontSize: 14, fontFamily: fontFamilies.bodyRegular },
  input: {
    minHeight: 96,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 16,
    fontFamily: fontFamilies.bodyRegular,
    textAlignVertical: "top",
  },
  options: { gap: spacing.sm },
  optionChip: {
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  optionText: { fontSize: 15, fontFamily: fontFamilies.bodySemiBold },
  reviewLabel: {
    fontSize: 12,
    fontFamily: fontFamilies.bodyBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  reviewVal: { fontSize: 15, fontFamily: fontFamilies.bodyRegular },
  editLink: { fontSize: 14, fontFamily: fontFamilies.bodyBold },
  stepCount: { fontSize: 12 },
});
