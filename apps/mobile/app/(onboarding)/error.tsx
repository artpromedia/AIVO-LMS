import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { OnboardingScaffold } from "@/src/components/onboarding/OnboardingScaffold";
import { Button } from "@/components/ui";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Onboarding error fallback (MOB-ONB-014) — mirror of web's
 * `/onboarding/error`. Friendly recovery when a setup step fails;
 * optional `?reason=` is surfaced for support.
 */
export default function OnboardingErrorScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { reason } = useLocalSearchParams<{ reason?: string }>();

  return (
    <OnboardingScaffold
      title={t("onboarding.error.title", "Something went sideways")}
      subtitle={t(
        "onboarding.error.subtitle",
        "That step didn't finish. It's usually a hiccup — let's try again.",
      )}
      footer={
        <>
          <Button
            title={t("onboarding.error.retry", "Try again")}
            onPress={() => router.replace("/(onboarding)/welcome" as Href)}
            fullWidth
            size="lg"
          />
          <Button
            title={t("onboarding.error.signIn", "Go to sign in")}
            onPress={() => router.replace("/(auth)/login")}
            variant="outline"
            fullWidth
            size="lg"
          />
        </>
      }
    >
      <View style={styles.center}>
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: palette.bgRaised, borderColor: palette.border },
          ]}
        >
          <Ionicons name="cloud-offline-outline" size={40} color={palette.inkMuted} />
        </View>
        {reason ? (
          <Text style={[styles.reason, { color: palette.inkMuted }]}>
            {t("onboarding.error.code", "Reference")}: {reason}
          </Text>
        ) : null}
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  reason: { fontSize: 12, fontFamily: fontFamilies.bodyRegular },
});
