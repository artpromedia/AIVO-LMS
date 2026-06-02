import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { OnboardingScaffold } from "@/src/components/onboarding/OnboardingScaffold";
import { Button } from "@/components/ui";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Learner self-signup (MOB-ONB-013) — mirror of web's
 * /onboarding/learner/new. Minimal learner-facing join form.
 */
export default function LearnerNewScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  return (
    <OnboardingScaffold
      eyebrow={t("onboarding.learnerNew.eyebrow", "Welcome!")}
      title={t("onboarding.learnerNew.title", "Let's set up your space")}
      subtitle={t(
        "onboarding.learnerNew.subtitle",
        "Type your name and the class code your teacher or grown-up gave you.",
      )}
      onBack={() => router.back()}
      footer={
        <Button
          title={t("onboarding.common.continue", "Continue")}
          onPress={() => router.replace("/(auth)/pin")}
          fullWidth
          size="lg"
          disabled={name.trim().length === 0}
        />
      }
    >
      <View style={{ gap: spacing.md }}>
        <View style={{ gap: 6 }}>
          <Text style={[styles.label, { color: palette.ink }]}>
            {t("onboarding.learnerNew.name", "Your first name")}
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t("onboarding.learnerNew.namePh", "e.g. Sam")}
            placeholderTextColor={palette.inkMuted}
            style={[
              styles.input,
              {
                borderColor: palette.border,
                color: palette.ink,
                backgroundColor: palette.bgRaised,
              },
            ]}
            accessibilityLabel={t("onboarding.learnerNew.name", "Your first name")}
          />
        </View>
        <View style={{ gap: 6 }}>
          <Text style={[styles.label, { color: palette.ink }]}>
            {t("onboarding.learnerNew.code", "Class code (optional)")}
          </Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            placeholder="ABC123"
            placeholderTextColor={palette.inkMuted}
            style={[
              styles.input,
              {
                borderColor: palette.border,
                color: palette.ink,
                backgroundColor: palette.bgRaised,
              },
            ]}
            accessibilityLabel={t("onboarding.learnerNew.code", "Class code")}
          />
        </View>
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontFamily: fontFamilies.bodyBold },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    fontFamily: fontFamilies.bodyRegular,
  },
});
