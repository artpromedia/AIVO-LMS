import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { OnboardingScaffold } from "@/src/components/onboarding/OnboardingScaffold";
import { OnboardingStepper } from "@/src/components/onboarding/OnboardingStepper";
import { Button } from "@/components/ui";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { INCLUSIVE_WARM_PALETTE } from "@aivo/brand";

type OnboardRole = "parent" | "teacher";

interface RoleOption {
  id: OnboardRole;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc: string;
}

/**
 * Role selection (MOB-ONB-003) — mirror of web's `/onboarding/role`,
 * scoped to the two roles that self-sign-up on mobile (parent, teacher).
 * Caregivers / therapists join by invite; learners are created by a
 * parent. Continues into permission priming, then account creation.
 */
export default function RoleScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const [selected, setSelected] = useState<OnboardRole | null>(null);

  const ROLES: RoleOption[] = [
    {
      id: "parent",
      icon: "heart",
      label: t("onboarding.role.parentLabel", "Parent or guardian"),
      desc: t("onboarding.role.parentDesc", "Set up your child and follow their learning."),
    },
    {
      id: "teacher",
      icon: "school",
      label: t("onboarding.role.teacherLabel", "Teacher"),
      desc: t("onboarding.role.teacherDesc", "Support your students and see class insights."),
    },
  ];

  return (
    <OnboardingScaffold
      eyebrow={t("onboarding.role.eyebrow", "Step 1 of 3")}
      title={t("onboarding.role.title", "How will you use AIVO?")}
      subtitle={t("onboarding.role.subtitle", "We'll tailor setup to fit you.")}
      onBack={() => router.back()}
      footer={
        <Button
          title={t("onboarding.common.continue", "Continue")}
          onPress={() =>
            router.push(`/(onboarding)/permissions?role=${selected ?? "parent"}` as Href)
          }
          fullWidth
          size="lg"
          disabled={!selected}
        />
      }
    >
      <OnboardingStepper steps={3} current={0} />
      <View style={{ gap: spacing.md }}>
        {ROLES.map((r) => {
          const active = selected === r.id;
          return (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={r.label}
              onPress={() => setSelected(r.id)}
              style={[
                styles.card,
                {
                  borderColor: active ? palette.primary : palette.border,
                  backgroundColor: active ? INCLUSIVE_WARM_PALETTE.primarySoft : palette.bgRaised,
                  borderWidth: active ? 2 : 1,
                },
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: palette.bgPage }]}>
                <Ionicons name={r.icon} size={24} color={palette.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardLabel, { color: palette.ink }]}>{r.label}</Text>
                <Text style={[styles.cardDesc, { color: palette.inkMuted }]}>{r.desc}</Text>
              </View>
              {active ? (
                <Ionicons name="checkmark-circle" size={22} color={palette.primary} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  cardLabel: { fontSize: 16, fontFamily: fontFamilies.bodyBold },
  cardDesc: { fontSize: 13, fontFamily: fontFamilies.bodyRegular, marginTop: 2 },
});
