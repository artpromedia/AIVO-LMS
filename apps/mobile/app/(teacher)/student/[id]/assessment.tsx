import React, { useState, useCallback, useMemo } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearner } from "@/hooks/useLearners";
import {
  useSubmitTeacherAssessment,
  useTeacherAssessmentStatus,
} from "@/hooks/useTeacherAssessment";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { OnboardingStepper } from "@/src/components/onboarding/OnboardingStepper";
import { Card, Button } from "@/components/ui";
import { colors, spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { INCLUSIVE_WARM_PALETTE } from "@aivo/brand";
import {
  TEACHER_ASSESSMENT_SECTIONS,
  TEACHER_ASSESSMENT_TOTAL_REQUIRED,
  requiredQuestionCount,
  withName,
  type TAQuestion,
  type TASection,
} from "@/lib/teacher/assessment-content";
import type { TeacherAssessmentAnswers } from "@/lib/teacher/assessment-projection";

type QValue = string | string[] | undefined;

function isAnswered(q: TAQuestion, value: QValue): boolean {
  if (q.type === "multi") return Array.isArray(value) && value.length > 0;
  if (q.type === "text") return typeof value === "string" && value.trim().length > 0;
  return typeof value === "string" && value.length > 0;
}

function sectionRequiredAnswered(
  section: TASection,
  sectionAns: Record<string, unknown> | undefined,
): number {
  return section.questions.filter(
    (q) => !q.optional && isAnswered(q, sectionAns?.[q.id] as QValue),
  ).length;
}

/**
 * Teacher classroom-assessment wizard (mobile) — tablet-first mirror of
 * web-v2's A5 three-state flow (intro → 8-section/54-question stepper →
 * review/submit). Section-per-step keeps each step short enough for a phone
 * while the capped reading width keeps it comfortable on a tablet. On submit it
 * PERSISTS to assessment-svc (system of record; sets the contribution signal
 * the parent "Contributed" badge reads) and best-effort mirrors a summary to
 * family-svc for the brain-clone collaborator fold. RBAC is re-enforced
 * server-side (assessment-svc checks the ACCEPTED learner_teachers link).
 */
export default function TeacherAssessmentScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const learnerId = id ?? "";
  const { data: learner } = useLearner(learnerId);
  const { data: status } = useTeacherAssessmentStatus(learnerId);
  const submit = useSubmitTeacherAssessment();

  const name = learner?.firstName?.trim() || t("teacherAssessment.learner", "this student");

  const [phase, setPhase] = useState<"intro" | "steps" | "review" | "done">("intro");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<TeacherAssessmentAnswers>({});
  const [mirrorDeferred, setMirrorDeferred] = useState(false);

  const setSingle = useCallback((sid: TASection["id"], qid: string, value: string) => {
    setAnswers((prev) => {
      const sec = { ...(prev[sid] ?? {}) };
      // Tapping the selected option again clears it.
      if (sec[qid] === value) delete sec[qid];
      else sec[qid] = value;
      return { ...prev, [sid]: sec };
    });
  }, []);

  const toggleMulti = useCallback((sid: TASection["id"], qid: string, value: string) => {
    setAnswers((prev) => {
      const sec = { ...(prev[sid] ?? {}) };
      const list = Array.isArray(sec[qid]) ? [...(sec[qid] as string[])] : [];
      const at = list.indexOf(value);
      if (at === -1) list.push(value);
      else list.splice(at, 1);
      sec[qid] = list;
      return { ...prev, [sid]: sec };
    });
  }, []);

  const setText = useCallback((sid: TASection["id"], qid: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [sid]: { ...(prev[sid] ?? {}), [qid]: value } }));
  }, []);

  const totalRequiredAnswered = useMemo(
    () =>
      TEACHER_ASSESSMENT_SECTIONS.reduce(
        (n, s) => n + sectionRequiredAnswered(s, answers[s.id] as Record<string, unknown>),
        0,
      ),
    [answers],
  );
  const percent = TEACHER_ASSESSMENT_TOTAL_REQUIRED
    ? Math.round((totalRequiredAnswered / TEACHER_ASSESSMENT_TOTAL_REQUIRED) * 100)
    : 0;
  // Submit is allowed as soon as ANY question (required OR optional) is
  // answered — a teacher may contribute only narrative notes, which web and the
  // backend both accept. Progress % above still reflects required coverage.
  const hasAnyAnswer = useMemo(
    () =>
      TEACHER_ASSESSMENT_SECTIONS.some((s) =>
        s.questions.some((q) =>
          isAnswered(q, (answers[s.id] as Record<string, QValue> | undefined)?.[q.id]),
        ),
      ),
    [answers],
  );

  const goToReview = useCallback(() => setPhase("review"), []);
  const editSection = useCallback((idx: number) => {
    setSectionIndex(idx);
    setPhase("steps");
  }, []);

  const handleSubmit = useCallback(async () => {
    // No silent success (parity with web-v2): only advance to "done" once
    // assessment-svc confirms a persisted row. A deferred family-svc mirror is
    // surfaced, not swallowed.
    try {
      const res = await submit.mutateAsync({ learnerId, learnerName: name, answers });
      setMirrorDeferred(res.mirror === "deferred");
      setPhase("done");
    } catch (e) {
      Alert.alert(
        t("common.error", "Couldn't save"),
        (e as Error)?.message ||
          t("teacherAssessment.submitFailed", "We couldn't save the assessment. Try again."),
      );
    }
  }, [answers, learnerId, name, submit, t]);

  /* ----- intro ----- */
  if (phase === "intro") {
    return (
      <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
        <ScreenHeader title={t("teacherAssessment.title", "Classroom assessment")} />
        <Card tone="hero" style={{ gap: spacing.sm }}>
          <View style={[styles.iconWrap, { backgroundColor: INCLUSIVE_WARM_PALETTE.primarySoft }]}>
            <Ionicons name="school" size={26} color={palette.primary} />
          </View>
          <Text style={[styles.h1, { color: palette.ink }]}>
            {withName(t("teacherAssessment.introTitle", "Share your read on {name}"), name)}
          </Text>
          <Text style={[styles.body, { color: palette.inkMuted }]}>
            {withName(
              t(
                "teacherAssessment.introBody",
                "Eight short sections capture how {name} learns in your classroom. Your professional insight shapes their AIVO support. Answer what you can — every section is optional and you can stop and review at any time.",
              ),
              name,
            )}
          </Text>
          {status?.completed ? (
            <View style={[styles.notice, { backgroundColor: palette.primary + "12" }]}>
              <Ionicons name="checkmark-circle" size={16} color={palette.primary} />
              <Text style={[styles.noticeText, { color: palette.ink }]}>
                {t(
                  "teacherAssessment.alreadyContributed",
                  "You've already contributed. Submitting again updates your responses.",
                )}
              </Text>
            </View>
          ) : null}
        </Card>
        <Button
          title={
            status?.completed
              ? t("teacherAssessment.update", "Update responses")
              : t("teacherAssessment.begin", "Begin")
          }
          onPress={() => {
            setSectionIndex(0);
            setPhase("steps");
          }}
          fullWidth
          size="lg"
          style={{ marginTop: spacing.md }}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={{ paddingVertical: spacing.md, alignItems: "center" }}
        >
          <Text style={[styles.editLink, { color: palette.primary }]}>
            {t("common.cancel", "Cancel")}
          </Text>
        </Pressable>
      </ResponsiveScreen>
    );
  }

  /* ----- done ----- */
  if (phase === "done") {
    return (
      <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
        <ScreenHeader title={t("teacherAssessment.doneTitle", "Thank you")} />
        <Card tone="raised" style={{ gap: spacing.sm, alignItems: "center" }}>
          <View style={[styles.iconWrap, { backgroundColor: colors.success + "1A" }]}>
            <Ionicons name="checkmark-circle" size={30} color={colors.success} />
          </View>
          <Text style={[styles.h1, { color: palette.ink, textAlign: "center" }]}>
            {t("teacherAssessment.submitted", "Insight saved")}
          </Text>
          <Text style={[styles.body, { color: palette.inkMuted, textAlign: "center" }]}>
            {withName(
              t(
                "teacherAssessment.submittedBody",
                "Your classroom read on {name} is now part of their AIVO support. Their family can see you've contributed.",
              ),
              name,
            )}
          </Text>
          {mirrorDeferred ? (
            <Text style={[styles.deferredNote, { color: palette.inkMuted }]}>
              {t(
                "teacherAssessment.mirrorDeferred",
                "Your responses saved. The collaborator summary will sync shortly.",
              )}
            </Text>
          ) : null}
        </Card>
        <Button
          title={t("teacherAssessment.backToStudent", "Back to student")}
          onPress={() => router.replace(`/(teacher)/student/${learnerId}` as never)}
          fullWidth
          size="lg"
          style={{ marginTop: spacing.md }}
        />
      </ResponsiveScreen>
    );
  }

  /* ----- review ----- */
  if (phase === "review") {
    return (
      <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
        <ScreenHeader title={t("teacherAssessment.reviewTitle", "Review & submit")} />
        <Card tone="hero" style={{ gap: 4 }}>
          <Text style={[styles.h1, { color: palette.ink }]}>
            {t("teacherAssessment.reviewComplete", { defaultValue: `${percent}% complete`, percent })}
          </Text>
          <Text style={[styles.body, { color: palette.inkMuted }]}>
            {t(
              "teacherAssessment.reviewBody",
              "Review your sections below. You can submit a partial contribution — answer more anytime.",
            )}
          </Text>
        </Card>
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          {TEACHER_ASSESSMENT_SECTIONS.map((s, idx) => {
            const answered = sectionRequiredAnswered(s, answers[s.id] as Record<string, unknown>);
            const required = requiredQuestionCount(s.id);
            const complete = required > 0 && answered >= required;
            return (
              <Card key={s.id} tone="raised" style={styles.reviewRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reviewLabel, { color: palette.inkMuted }]}>
                    {t("teacherAssessment.sectionN", {
                      defaultValue: `Section ${idx + 1}`,
                      n: idx + 1,
                    })}
                  </Text>
                  <Text style={[styles.reviewVal, { color: palette.ink }]}>{s.title}</Text>
                  <Text style={[styles.reviewCount, { color: palette.inkMuted }]}>
                    {t("teacherAssessment.answeredCount", {
                      defaultValue: `${answered} of ${required} answered`,
                      answered,
                      required,
                    })}
                  </Text>
                </View>
                <View style={styles.reviewRight}>
                  {complete ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  ) : (
                    <View style={[styles.dot, { borderColor: palette.border }]} />
                  )}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => editSection(idx)}
                    hitSlop={8}
                  >
                    <Text style={[styles.editLink, { color: palette.primary }]}>
                      {t("teacherAssessment.edit", "Edit")}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            );
          })}
        </View>
        <Button
          title={t("teacherAssessment.submit", "Submit assessment")}
          onPress={handleSubmit}
          loading={submit.isPending}
          disabled={!hasAnyAnswer}
          fullWidth
          size="lg"
          style={{ marginTop: spacing.md }}
        />
        {!hasAnyAnswer ? (
          <Text style={[styles.deferredNote, { color: palette.inkMuted, textAlign: "center" }]}>
            {t("teacherAssessment.answerSomething", "Answer at least one question to submit.")}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => editSection(0)}
          style={{ paddingVertical: spacing.md, alignItems: "center" }}
        >
          <Text style={[styles.editLink, { color: palette.primary }]}>
            {t("teacherAssessment.editAll", "Back to questions")}
          </Text>
        </Pressable>
      </ResponsiveScreen>
    );
  }

  /* ----- steps ----- */
  const section = TEACHER_ASSESSMENT_SECTIONS[sectionIndex];
  const last = sectionIndex === TEACHER_ASSESSMENT_SECTIONS.length - 1;
  const sectionAns = (answers[section.id] ?? {}) as Record<string, QValue>;

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("teacherAssessment.title", "Classroom assessment")} />
      <OnboardingStepper steps={TEACHER_ASSESSMENT_SECTIONS.length} current={sectionIndex} />
      <Card tone="hero" style={{ gap: 4, marginBottom: spacing.sm }}>
        <Text style={[styles.reviewLabel, { color: palette.inkMuted }]}>
          {t("teacherAssessment.sectionOf", {
            defaultValue: `Section ${sectionIndex + 1} of ${TEACHER_ASSESSMENT_SECTIONS.length}`,
            current: sectionIndex + 1,
            total: TEACHER_ASSESSMENT_SECTIONS.length,
          })}
        </Text>
        <Text style={[styles.stepTitle, { color: palette.ink }]}>{section.title}</Text>
        <Text style={[styles.prompt, { color: palette.inkMuted }]}>
          {withName(section.subtitle, name)}
        </Text>
      </Card>

      <View style={{ gap: spacing.sm }}>
        {section.questions.map((q) => {
          const value = sectionAns[q.id];
          return (
            <Card key={q.id} tone="raised" style={{ gap: spacing.sm }}>
              <View style={{ gap: 2 }}>
                <Text style={[styles.qPrompt, { color: palette.ink }]}>
                  {withName(q.prompt, name)}
                  {q.optional ? (
                    <Text style={[styles.optional, { color: palette.inkMuted }]}>
                      {"  "}
                      {t("teacherAssessment.optional", "Optional")}
                    </Text>
                  ) : null}
                </Text>
                {q.helper ? (
                  <Text style={[styles.helper, { color: palette.inkMuted }]}>
                    {withName(q.helper, name)}
                  </Text>
                ) : null}
              </View>

              {q.type === "text" ? (
                <TextInput
                  value={typeof value === "string" ? value : ""}
                  onChangeText={(v) => setText(section.id, q.id, v)}
                  placeholder={q.placeholder ? withName(q.placeholder, name) : undefined}
                  placeholderTextColor={palette.inkMuted}
                  multiline
                  style={[
                    styles.input,
                    {
                      borderColor: palette.border,
                      color: palette.ink,
                      backgroundColor: palette.bgPage,
                    },
                  ]}
                  accessibilityLabel={withName(q.prompt, name)}
                />
              ) : (
                <View style={styles.options}>
                  {q.options?.map((o) => {
                    const selected =
                      q.type === "multi"
                        ? Array.isArray(value) && value.includes(o.value)
                        : value === o.value;
                    return (
                      <Pressable
                        key={o.value}
                        onPress={() =>
                          q.type === "multi"
                            ? toggleMulti(section.id, q.id, o.value)
                            : setSingle(section.id, q.id, o.value)
                        }
                        accessibilityRole={q.type === "multi" ? "checkbox" : "radio"}
                        accessibilityState={{ checked: selected, selected }}
                        style={[
                          styles.optionChip,
                          {
                            borderColor: selected ? palette.primary : palette.border,
                            backgroundColor: selected ? palette.primary : palette.bgPage,
                          },
                        ]}
                      >
                        {q.type === "multi" ? (
                          <Ionicons
                            name={selected ? "checkbox" : "square-outline"}
                            size={18}
                            color={selected ? colors.white : palette.inkMuted}
                          />
                        ) : null}
                        <Text
                          style={[styles.optionText, { color: selected ? colors.white : palette.ink }]}
                        >
                          {o.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </Card>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Button
            title={t("common.back", "Back")}
            onPress={() =>
              sectionIndex > 0 ? setSectionIndex((n) => n - 1) : setPhase("intro")
            }
            variant="outline"
            fullWidth
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title={last ? t("teacherAssessment.review", "Review") : t("common.next", "Next")}
            onPress={() => (last ? goToReview() : setSectionIndex((n) => n + 1))}
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
  prompt: { fontSize: 14, fontFamily: fontFamilies.bodyRegular, lineHeight: 20 },
  qPrompt: { fontSize: 15, fontFamily: fontFamilies.bodySemiBold, lineHeight: 21 },
  optional: { fontSize: 12, fontFamily: fontFamilies.bodyRegular },
  helper: { fontSize: 13, fontFamily: fontFamilies.bodyRegular },
  input: {
    minHeight: 88,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 16,
    fontFamily: fontFamilies.bodyRegular,
    textAlignVertical: "top",
  },
  options: { gap: spacing.sm },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  optionText: { fontSize: 15, fontFamily: fontFamilies.bodySemiBold, flexShrink: 1 },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  noticeText: { fontSize: 13, fontFamily: fontFamilies.bodySemiBold, flexShrink: 1 },
  reviewRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  reviewRight: { alignItems: "flex-end", gap: 6 },
  reviewLabel: {
    fontSize: 12,
    fontFamily: fontFamilies.bodyBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  reviewVal: { fontSize: 15, fontFamily: fontFamilies.bodySemiBold },
  reviewCount: { fontSize: 12, fontFamily: fontFamilies.bodyRegular, marginTop: 2 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5 },
  editLink: { fontSize: 14, fontFamily: fontFamilies.bodyBold },
  deferredNote: { fontSize: 12, fontFamily: fontFamilies.bodyRegular, marginTop: spacing.sm },
});
