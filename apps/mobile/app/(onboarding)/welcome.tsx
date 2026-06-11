import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { OnboardingScaffold } from "@/src/components/onboarding/OnboardingScaffold";
import { Button } from "@/components/ui";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Onboarding welcome (MOB-ONB-002) — brand entry with sign-in / create-
 * account actions and links to terms + privacy. Mirror of web's
 * `/onboarding/welcome`.
 */
export default function WelcomeScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();

  return (
    <OnboardingScaffold
      eyebrow={t("onboarding.welcome.eyebrow", "Welcome to AIVO")}
      title={t("onboarding.welcome.title", "Learning that adapts to your child")}
      subtitle={t(
        "onboarding.welcome.subtitle",
        "A calm, inclusive tutor that meets every learner where they are.",
      )}
      footer={
        <>
          <Button
            title={t("onboarding.welcome.signIn", "Sign in")}
            onPress={() => router.push("/(auth)/login")}
            fullWidth
            size="lg"
          />
          <Button
            title={t("onboarding.welcome.createAccount", "Create an account")}
            onPress={() => router.push("/(onboarding)/role" as Href)}
            variant="outline"
            fullWidth
            size="lg"
          />
          <View style={styles.legalRow}>
            <Pressable accessibilityRole="button" onPress={() => router.push("/(onboarding)/terms" as Href)} hitSlop={8}>
              <Text style={[styles.legalLink, { color: palette.inkMuted }]}>
                {t("onboarding.common.terms", "Terms")}
              </Text>
            </Pressable>
            <Text style={[styles.legalDot, { color: palette.inkMuted }]}>·</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push("/(onboarding)/privacy" as Href)} hitSlop={8}>
              <Text style={[styles.legalLink, { color: palette.inkMuted }]}>
                {t("onboarding.common.privacy", "Privacy")}
              </Text>
            </Pressable>
          </View>
        </>
      }
    >
      <View style={{ gap: spacing.sm }}>
        <Bullet
          text={t(
            "onboarding.welcome.bullet1",
            "Personalised lessons from a baseline, not a one-size test.",
          )}
          palette={palette}
        />
        <Bullet
          text={t(
            "onboarding.welcome.bullet2",
            "Accessibility and sensory supports built in from day one.",
          )}
          palette={palette}
        />
        <Bullet
          text={t(
            "onboarding.welcome.bullet3",
            "Parents and teachers stay in the loop on real progress.",
          )}
          palette={palette}
        />
      </View>
    </OnboardingScaffold>
  );
}

function Bullet({
  text,
  palette,
}: {
  text: string;
  palette: ReturnType<typeof useSensoryPalette>;
}) {
  return (
    <View style={styles.bullet}>
      <View style={[styles.dot, { backgroundColor: palette.primary }]} />
      <Text style={[styles.bulletText, { color: palette.ink }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bullet: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  bulletText: { flex: 1, fontSize: 15, fontFamily: fontFamilies.bodyRegular, lineHeight: 22 },
  legalRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  legalLink: { fontSize: 13, fontFamily: fontFamilies.bodySemiBold },
  legalDot: { fontSize: 13 },
});
