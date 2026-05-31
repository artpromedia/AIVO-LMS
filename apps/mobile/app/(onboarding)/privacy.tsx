import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { OnboardingScaffold } from "@/src/components/onboarding/OnboardingScaffold";
import { Collapsible } from "@/src/components/onboarding/Collapsible";
import { Button } from "@/components/ui";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { INCLUSIVE_WARM_PALETTE } from "@aivo/brand";

/**
 * Privacy summary (MOB-ONB-006) — mirror of web's `/onboarding/privacy`.
 * "What does AIVO do with my data?" with progressive disclosure plus a
 * reassurance callout (CCPA / GDPR posture).
 */
export default function PrivacyScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const li = (text: string) => (
    <View style={styles.liRow}>
      <Text style={[styles.bullet, { color: palette.primary }]}>•</Text>
      <Text style={[styles.body, { color: palette.inkMuted }]}>{text}</Text>
    </View>
  );

  return (
    <OnboardingScaffold
      eyebrow={t("onboarding.privacy.eyebrow", "Privacy")}
      title={t("onboarding.privacy.title", "Your data, explained")}
      subtitle={t("onboarding.privacy.subtitle", "What we collect, why, and who can see it.")}
      onBack={() => router.back()}
      footer={
        <Button
          title={t("onboarding.common.back", "Back")}
          onPress={() => router.back()}
          fullWidth
          size="lg"
        />
      }
    >
      <View
        style={[
          styles.reassure,
          { backgroundColor: INCLUSIVE_WARM_PALETTE.primarySoft, borderColor: palette.border },
        ]}
      >
        <Ionicons name="shield-checkmark" size={20} color={palette.primary} />
        <Text style={[styles.reassureText, { color: palette.ink }]}>
          {t(
            "onboarding.privacy.reassure",
            "We never sell your data. You can export or delete it any time, in line with GDPR and US state privacy laws.",
          )}
        </Text>
      </View>

      <Collapsible summary={t("onboarding.privacy.collectSummary", "What we collect")} defaultOpen>
        {li(t("onboarding.privacy.collectAccount", "Account details (name, email)."))}
        {li(
          t(
            "onboarding.privacy.collectLearner",
            "Learning activity and mastery to personalise lessons.",
          ),
        )}
        {li(t("onboarding.privacy.collectDevice", "Basic device info to keep the app working."))}
      </Collapsible>
      <Collapsible summary={t("onboarding.privacy.aiSummary", "How AI uses it")}>
        <Text style={[styles.body, { color: palette.inkMuted }]}>
          {t(
            "onboarding.privacy.aiBody",
            "Learning data tailors tutoring to your child. It is not used to train third-party models.",
          )}
        </Text>
      </Collapsible>
      <Collapsible summary={t("onboarding.privacy.whoSummary", "Who can see it")}>
        {li(t("onboarding.privacy.whoYou", "You and the grown-ups on the account."))}
        {li(t("onboarding.privacy.whoTeachers", "Linked teachers and support staff you approve."))}
        {li(
          t(
            "onboarding.privacy.whoStaff",
            "AIVO staff, only to keep the service safe and working.",
          ),
        )}
      </Collapsible>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  reassure: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  reassureText: { flex: 1, fontSize: 13, fontFamily: fontFamilies.bodySemiBold, lineHeight: 19 },
  liRow: { flexDirection: "row", gap: 8 },
  bullet: { fontSize: 14, lineHeight: 21 },
  body: { flex: 1, fontSize: 14, fontFamily: fontFamilies.bodyRegular, lineHeight: 21 },
});
