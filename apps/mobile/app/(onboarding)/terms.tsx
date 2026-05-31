import React from "react";
import { Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { OnboardingScaffold } from "@/src/components/onboarding/OnboardingScaffold";
import { Collapsible } from "@/src/components/onboarding/Collapsible";
import { Button } from "@/components/ui";
import { fontFamilies } from "@/constants/typography";

/**
 * Terms of service (MOB-ONB-005) — mirror of web's `/onboarding/terms`.
 * Progressive-disclosure legal sections.
 */
export default function TermsScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const body = (text: string) => (
    <Text style={[styles.body, { color: palette.inkMuted }]}>{text}</Text>
  );

  return (
    <OnboardingScaffold
      eyebrow={t("onboarding.terms.eyebrow", "Legal")}
      title={t("onboarding.terms.title", "Terms of service")}
      subtitle={t("onboarding.terms.subtitle", "The plain-language version is right here.")}
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
      <Collapsible
        summary={t("onboarding.terms.agreeSummary", "What you're agreeing to")}
        defaultOpen
      >
        {body(
          t(
            "onboarding.terms.agreeBody",
            "By using AIVO you agree to use it lawfully and to keep your account secure. You can stop using it at any time.",
          ),
        )}
      </Collapsible>
      <Collapsible summary={t("onboarding.terms.aivoSummary", "What AIVO provides")}>
        {body(
          t(
            "onboarding.terms.aivoBody",
            "AIVO offers AI-assisted tutoring and progress tools. It is a learning aid, not a replacement for professional or medical advice.",
          ),
        )}
      </Collapsible>
      <Collapsible summary={t("onboarding.terms.childrenSummary", "Accounts for children")}>
        {body(
          t(
            "onboarding.terms.childrenBody",
            "A parent or guardian creates and supervises a child's account and consents on their behalf.",
          ),
        )}
      </Collapsible>
      <Collapsible summary={t("onboarding.terms.wrongSummary", "If something goes wrong")}>
        {body(
          t(
            "onboarding.terms.wrongBody",
            "Tell us and we'll help. Some legal limits on liability apply, as set out in the full terms.",
          ),
        )}
      </Collapsible>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 14, fontFamily: fontFamilies.bodyRegular, lineHeight: 21 },
});
