import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { OnboardingScaffold } from "@/src/components/onboarding/OnboardingScaffold";
import { Button } from "@/components/ui";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Parent verify (MOB-ONB-010) — mirror of web's /onboarding/parent-verify.
 * Confirms email/phone with a 6-digit code before child setup.
 */
export default function ParentVerifyScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const [code, setCode] = useState("");

  return (
    <OnboardingScaffold
      eyebrow={t("onboarding.verify.eyebrow", "Verify it's you")}
      title={t("onboarding.verify.title", "Enter your code")}
      subtitle={t(
        "onboarding.verify.subtitle",
        "We sent a 6-digit code to your email. Enter it to continue.",
      )}
      onBack={() => router.back()}
      footer={
        <Button
          title={t("onboarding.common.continue", "Continue")}
          onPress={() => router.push("/(onboarding)/child-approval" as Href)}
          fullWidth
          size="lg"
          disabled={code.trim().length < 6}
        />
      }
    >
      <View
        style={[styles.codeBox, { borderColor: palette.border, backgroundColor: palette.bgRaised }]}
      >
        <Ionicons name="mail-open-outline" size={22} color={palette.primary} />
        <TextInput
          value={code}
          onChangeText={(v) => setCode(v.replace(/[^0-9]/g, "").slice(0, 6))}
          keyboardType="number-pad"
          placeholder="000000"
          placeholderTextColor={palette.inkMuted}
          style={[styles.codeInput, { color: palette.ink }]}
          accessibilityLabel={t("onboarding.verify.codeLabel", "Verification code")}
        />
      </View>
      <Text style={[styles.resend, { color: palette.primary }]}>
        {t("onboarding.verify.resend", "Resend code")}
      </Text>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 56,
    borderWidth: 1.5,
    borderRadius: radius.lg,
  },
  codeInput: { flex: 1, fontSize: 24, letterSpacing: 8, fontFamily: fontFamilies.displayBold },
  resend: {
    fontSize: 14,
    fontFamily: fontFamilies.bodyBold,
    textAlign: "center",
    marginTop: spacing.md,
  },
});
