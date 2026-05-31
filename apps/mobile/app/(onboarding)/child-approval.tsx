import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { OnboardingScaffold } from "@/src/components/onboarding/OnboardingScaffold";
import { Card, Button } from "@/components/ui";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Child approval (MOB-ONB-012) — mirror of web's
 * /onboarding/child-approval. Parent confirms the child profile before
 * activation (COPPA verifiable consent).
 */
export default function ChildApprovalScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();

  return (
    <OnboardingScaffold
      eyebrow={t("onboarding.approve.eyebrow", "Almost there")}
      title={t("onboarding.approve.title", "Approve your child's account")}
      subtitle={t("onboarding.approve.subtitle", "As the parent or guardian, you approve this account and consent on your child's behalf.")}
      onBack={() => router.back()}
      footer={
        <>
          <Button
            title={t("onboarding.approve.approve", "Approve & activate")}
            onPress={() => router.replace("/(auth)/login")}
            fullWidth
            size="lg"
          />
          <Button
            title={t("onboarding.approve.later", "I'll do this later")}
            onPress={() => router.replace("/(auth)/login")}
            variant="outline"
            fullWidth
            size="lg"
          />
        </>
      }
    >
      <Card tone="raised" style={{ gap: spacing.sm }}>
        {[
          t("onboarding.approve.point1", "You can review and change settings anytime."),
          t("onboarding.approve.point2", "Your child's data is private and never sold."),
          t("onboarding.approve.point3", "You can export or delete data whenever you want."),
        ].map((line, i) => (
          <View key={i} style={styles.row}>
            <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
            <Text style={[styles.body, { color: palette.ink, flex: 1 }]}>{line}</Text>
          </View>
        ))}
      </Card>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  body: { fontSize: 14, fontFamily: fontFamilies.bodyRegular, lineHeight: 21 },
});
