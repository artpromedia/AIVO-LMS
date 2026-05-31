import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { AccessibilitySettings } from "@/src/components/settings/AccessibilitySettings";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Global accessibility settings — the mobile mirror of web's
 * `/settings/accessibility` (MOB-A11Y-001). Role-agnostic: reachable
 * from any role's settings. Per-learner overrides live on each
 * learner's own accessibility screen.
 */
export default function GlobalAccessibilityScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t("common.back", "Back")}
          hitSlop={8}
          style={[
            styles.backBtn,
            { backgroundColor: palette.bgRaised, borderColor: palette.border },
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={palette.ink} />
        </Pressable>
        <Text style={[styles.title, { color: palette.ink }]}>
          {t("a11y.title", "Accessibility")}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <AccessibilitySettings
        scopeNote={t(
          "a11y.globalScope",
          "These defaults apply across AIVO and can be overridden for each learner.",
        )}
      />
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 22, fontFamily: fontFamilies.displayBold },
});
