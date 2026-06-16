import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearner } from "@/hooks/useLearners";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { Card } from "@/components/ui";
import { SpeechBuddyConsentCard } from "@/components/parent/SpeechBuddyConsentCard";
import { LoadingState } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Parent per-learner settings (MOB-PAR-014) — mirror of web's
 * `/parent/learners/[learnerId]/settings`. Quick links to the editable
 * profile surfaces plus a delete-learner action.
 */
export default function ParentLearnerSettingsScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const id = childId ?? "";
  const { data: learner, isLoading } = useLearner(id);

  const LINKS: { icon: keyof typeof Ionicons.glyphMap; label: string; route: string }[] = [
    {
      icon: "person",
      label: t("learnerSettings.profile", "Profile"),
      route: `/(parent)/learners/${id}`,
    },
    {
      icon: "accessibility",
      label: t("a11y.title", "Accessibility"),
      route: `/(parent)/accessibility/${id}`,
    },
    {
      icon: "color-palette",
      label: t("parentSensory.title", "Sensory profile"),
      route: `/(parent)/sensory/${id}`,
    },
    {
      icon: "clipboard",
      label: t("parentHub.iep", "IEP / Supports"),
      route: `/(parent)/iep/${id}`,
    },
  ];

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("learnerSettings.title", "Settings")} />
      {isLoading ? (
        <LoadingState />
      ) : (
        <View style={{ gap: spacing.md }}>
          <Card tone="raised" style={{ gap: 4 }}>
            <Text style={[styles.name, { color: palette.ink }]}>
              {learner ? `${learner.firstName} ${learner.lastName}` : ""}
            </Text>
            <Text style={[styles.meta, { color: palette.inkMuted }]}>
              {t("common.grade", {
                grade: learner?.gradeLevel,
                defaultValue: `Grade ${learner?.gradeLevel ?? ""}`,
              })}
            </Text>
          </Card>

          <Card tone="raised" style={{ gap: 0 }}>
            {LINKS.map((l, i) => (
              <Pressable
                key={l.route}
                accessibilityRole="button"
                accessibilityLabel={l.label}
                onPress={() => router.push(l.route as Href)}
                style={[
                  styles.linkRow,
                  i > 0 && { borderTopWidth: 1, borderTopColor: palette.border },
                ]}
              >
                <Ionicons name={l.icon} size={20} color={palette.primary} />
                <Text style={[styles.linkText, { color: palette.ink }]}>{l.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={palette.inkMuted} />
              </Pressable>
            ))}
          </Card>

          <SpeechBuddyConsentCard learnerId={id} learnerName={learner?.firstName ?? ""} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("learnerSettings.delete", "Remove learner")}
            onPress={() => router.push("/(parent)/settings")}
            style={[styles.deleteBtn, { borderColor: colors.error }]}
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={styles.deleteText}>{t("learnerSettings.delete", "Remove learner")}</Text>
          </Pressable>
          <Text style={[styles.note, { color: palette.inkMuted }]}>
            {t(
              "learnerSettings.deleteNote",
              "Removing a learner is handled from account settings for safety.",
            )}
          </Text>
        </View>
      )}
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 18, fontFamily: fontFamilies.displayBold },
  meta: { fontSize: 13, fontFamily: fontFamilies.bodyRegular },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  linkText: { flex: 1, fontSize: 15, fontFamily: fontFamilies.bodyBold },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.xl,
    borderWidth: 1.5,
  },
  deleteText: { fontSize: 15, fontFamily: fontFamilies.bodyBold, color: colors.error },
  note: { fontSize: 12, fontFamily: fontFamilies.bodyRegular, textAlign: "center" },
});
