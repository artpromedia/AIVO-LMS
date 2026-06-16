import React, { useState } from "react";
import { View, Text, ScrollView, TextInput, StyleSheet, Alert, Pressable } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useTranslation } from "@/hooks/useTranslation";
import { useAddLearner } from "@/hooks/useLearners";
import { validateBirthDate } from "@/lib/birth-date";
import { isFlagOn } from "@/lib/feature-flags";
import { AivoCard, AivoButton } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";
import { useWindowSizeClass } from "@/src/design/useWindowSizeClass";
import { CONTENT_MAX_WIDTH, pickBySizeClass } from "@/src/design/responsive";

export default function OnboardScreen() {
  const insets = useSafeAreaInsets();
  const addLearner = useAddLearner();
  const [step, setStep] = useState(0);
  const { t } = useTranslation();
  const { sizeClass, width: winWidth, isTablet } = useWindowSizeClass();
  const hPad = pickBySizeClass(sizeClass, {
    compact: spacing.md,
    medium: spacing.lg,
    expanded: spacing.xl,
  });
  const contentWidth = Math.min(winWidth - hPad * 2, CONTENT_MAX_WIDTH.reading);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    gradeLevel: "",
    dateOfBirth: "",
    pin: "",
  });

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const [createdLearnerId, setCreatedLearnerId] = useState<string | null>(null);

  const handleAddChild = async () => {
    // COPPA age gate (Sprint A6): birth date is required — it determines
    // the under-13 consent regime for this learner.
    if (!form.firstName || !form.gradeLevel || !form.pin || validateBirthDate(form.dateOfBirth)) {
      Alert.alert(t("parentOnboard.missingInfo"), t("parentOnboard.fillRequired"));
      return;
    }
    try {
      const created = await addLearner.mutateAsync(form);
      // Advance to the baseline-assessment step instead of bouncing back
      // to the dashboard. Tablet onboarding now guides the parent through
      // profile intake → IEP upload → baseline → review.
      setCreatedLearnerId((created as { id?: string } | null)?.id ?? null);
      setStep(4);
    } catch {
      Alert.alert(t("common.error"), t("parentOnboard.addChildFailed"));
    }
  };

  // Onboarding now spans five steps so the parent reaches the personalized
  // learning profile review instead of stopping at "child added".
  const steps = [
    t("parentOnboard.stepChildInfo"),
    t("parentOnboard.stepGrade"),
    t("parentOnboard.stepIEP"),
    t("parentOnboard.stepReview"),
    t("parentOnboard.stepBaseline", { defaultValue: "Baseline" }),
  ];

  return (
    <ScrollView
      style={[styles.container, { paddingHorizontal: hPad }]}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: 40,
        alignItems: "center",
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ width: contentWidth }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backRow}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>{t("common.back")}</Text>
        </Pressable>

        <Text style={styles.title}>{t("parentOnboard.title")}</Text>
        <Text style={styles.subtitle}>{t("parentOnboard.subtitle")}</Text>

        <View style={styles.stepper}>
          {steps.map((s, i) => (
            <View key={s} style={styles.stepItem}>
              <View style={[styles.stepCircle, i <= step && styles.stepActive]}>
                <Text style={[styles.stepNum, i <= step && styles.stepNumActive]}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepLabel, i <= step && styles.stepLabelActive]}>{s}</Text>
            </View>
          ))}
        </View>

        <AivoCard style={styles.formCard}>
          {step === 0 && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("parentOnboard.firstName")}</Text>
                <TextInput accessibilityLabel={t("parentOnboard.firstNamePlaceholder")}
                  style={styles.input}
                  value={form.firstName}
                  onChangeText={(v) => updateField("firstName", v)}
                  placeholder={t("parentOnboard.firstNamePlaceholder")}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("parentOnboard.lastName")}</Text>
                <TextInput accessibilityLabel={t("parentOnboard.lastNamePlaceholder")}
                  style={styles.input}
                  value={form.lastName}
                  onChangeText={(v) => updateField("lastName", v)}
                  placeholder={t("parentOnboard.lastNamePlaceholder")}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <AivoButton title={t("common.next")} onPress={() => setStep(1)} size="lg" />
            </>
          )}

          {step === 1 && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("parentLearnerNew.birthDate", "Birth date (YYYY-MM-DD)")}</Text>
                <TextInput
                  accessibilityLabel={t("parentLearnerNew.birthDate", "Birth date (YYYY-MM-DD)")}
                  style={styles.input}
                  value={form.dateOfBirth}
                  onChangeText={(v) => updateField("dateOfBirth", v)}
                  placeholder="2017-09-01"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("parentOnboard.gradeLevel")}</Text>
                <TextInput accessibilityLabel={t("parentOnboard.gradePlaceholder")}
                  style={styles.input}
                  value={form.gradeLevel}
                  onChangeText={(v) => updateField("gradeLevel", v)}
                  placeholder={t("parentOnboard.gradePlaceholder")}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("parentOnboard.learnerPin")}</Text>
                <TextInput accessibilityLabel={t("parentOnboard.pinPlaceholder")}
                  style={styles.input}
                  value={form.pin}
                  onChangeText={(v) => updateField("pin", v.replace(/\D/g, "").slice(0, 4))}
                  placeholder={t("parentOnboard.pinPlaceholder")}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry
                />
              </View>
              <View style={styles.btnRow}>
                <AivoButton
                  title={t("common.back")}
                  onPress={() => setStep(0)}
                  variant="outline"
                  size="lg"
                  style={{ flex: 1, marginRight: 8 }}
                />
                <AivoButton
                  title={t("common.next")}
                  onPress={() => setStep(2)}
                  size="lg"
                  style={{ flex: 1 }}
                />
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <View style={styles.uploadArea}>
                <Ionicons name="document-outline" size={40} color={colors.textSecondary} />
                <Text style={styles.uploadTitle}>{t("parentOnboard.uploadIEPOptional")}</Text>
                <Text style={styles.uploadDesc}>{t("parentOnboard.uploadIEPLater")}</Text>
                <AivoButton
                  title={t("parentOnboard.uploadIEP")}
                  onPress={() =>
                    Alert.alert(
                      t("parentOnboard.uploadIEP"),
                      t("parentOnboard.uploadIEPMobileUnavailable"),
                    )
                  }
                  variant="outline"
                  size="sm"
                  style={{ marginTop: spacing.md }}
                />
              </View>
              <View style={styles.btnRow}>
                <AivoButton
                  title={t("common.back")}
                  onPress={() => setStep(1)}
                  variant="outline"
                  size="lg"
                  style={{ flex: 1, marginRight: 8 }}
                />
                <AivoButton
                  title={t("parentOnboard.skipContinue")}
                  onPress={() => setStep(3)}
                  size="lg"
                  style={{ flex: 1 }}
                />
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.reviewTitle}>{t("parentOnboard.review")}</Text>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>{t("parentOnboard.name")}</Text>
                <Text style={styles.reviewValue}>
                  {form.firstName} {form.lastName}
                </Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>{t("common.grade", { grade: "" }).trim()}</Text>
                <Text style={styles.reviewValue}>{form.gradeLevel}</Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>{t("parentOnboard.pin")}</Text>
                <Text style={styles.reviewValue}>****</Text>
              </View>
              <View style={styles.btnRow}>
                <AivoButton
                  title={t("common.back")}
                  onPress={() => setStep(2)}
                  variant="outline"
                  size="lg"
                  style={{ flex: 1, marginRight: 8 }}
                />
                <AivoButton
                  title={t("parent.addChild")}
                  onPress={handleAddChild}
                  loading={addLearner.isPending}
                  size="lg"
                  style={{ flex: 1 }}
                />
              </View>
            </>
          )}

          {step === 4 && (
            <>
              <Ionicons
                name="rocket-outline"
                size={isTablet ? 56 : 40}
                color={colors.primary}
                style={{ alignSelf: "center" }}
              />
              <Text style={[styles.reviewTitle, { textAlign: "center", marginTop: spacing.md }]}>
                {t("parentOnboard.baselineTitle", {
                  defaultValue: "Start the baseline assessment",
                })}
              </Text>
              <Text style={[styles.uploadDesc, { textAlign: "center", marginBottom: spacing.md }]}>
                {t("parentOnboard.baselineDesc", {
                  defaultValue:
                    "We'll generate a short adaptive baseline so your child's tutors can personalize from day one.",
                })}
              </Text>

              {/* Parity with web-v2 Sprint 3: an optional "invite your child's
                  team" step before the baseline, gated by COLLAB_INVITE_STEP.
                  Collaborators add their perspective before the brain builds. */}
              {isFlagOn("COLLAB_INVITE_STEP") && createdLearnerId ? (
                <AivoButton
                  title={t("parentOnboard.inviteTeam", {
                    defaultValue: "Invite your child's team (optional)",
                  })}
                  onPress={() => router.push(`/(parent)/team/${createdLearnerId}` as any)}
                  variant="outline"
                  size="lg"
                  icon={<Ionicons name="people" size={18} color={colors.primary} />}
                  style={{ marginBottom: spacing.sm }}
                />
              ) : null}

              <AivoButton
                title={t("parentOnboard.launchBaseline", {
                  defaultValue: "Launch baseline assessment",
                })}
                onPress={() => {
                  if (createdLearnerId) {
                    router.replace(`/(parent)/brain/${createdLearnerId}` as any);
                  } else {
                    router.replace("/(parent)" as any);
                  }
                }}
                size="lg"
                icon={<Ionicons name="play" size={18} color={colors.white} />}
              />
              <AivoButton
                title={t("parentOnboard.skipBaseline", { defaultValue: "Skip for now" })}
                onPress={() => router.replace("/(parent)" as any)}
                variant="outline"
                size="lg"
                style={{ marginTop: spacing.sm }}
              />
            </>
          )}
        </AivoCard>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 16, fontFamily: "Nunito-SemiBold", color: colors.primary },
  title: { fontSize: 24, fontFamily: "Nunito-ExtraBold", color: colors.text },
  subtitle: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  stepper: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.lg },
  stepItem: { alignItems: "center", flex: 1 },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepActive: { backgroundColor: colors.primary },
  stepNum: { fontSize: 14, fontFamily: "Nunito-Bold", color: colors.textSecondary },
  stepNumActive: { color: colors.white },
  stepLabel: {
    fontSize: 11,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  stepLabelActive: { color: colors.primary, fontFamily: "Nunito-SemiBold" },
  formCard: {},
  inputGroup: { marginBottom: spacing.md },
  label: { fontSize: 14, fontFamily: "Nunito-SemiBold", color: colors.text, marginBottom: 6 },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    fontFamily: "Nunito-Regular",
    color: colors.text,
    backgroundColor: colors.surface,
  },
  btnRow: { flexDirection: "row", marginTop: spacing.md },
  uploadArea: {
    alignItems: "center",
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: radius.xl,
    marginBottom: spacing.md,
  },
  uploadTitle: { fontSize: 16, fontFamily: "Nunito-Bold", color: colors.text, marginTop: 8 },
  uploadDesc: {
    fontSize: 13,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: 4,
  },
  reviewTitle: {
    fontSize: 18,
    fontFamily: "Nunito-Bold",
    color: colors.text,
    marginBottom: spacing.md,
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  reviewLabel: { fontSize: 14, fontFamily: "Nunito-Regular", color: colors.textSecondary },
  reviewValue: { fontSize: 14, fontFamily: "Nunito-Bold", color: colors.text },
});
