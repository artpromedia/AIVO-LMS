import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { useTranslation } from "@/hooks/useTranslation";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Shared back-button + title header used by the per-learner parent
 * detail screens, so each screen body stays focused on its content.
 */
export function ScreenHeader({ title }: { title: string }) {
  const palette = useSensoryPalette();
  const { t } = useTranslation();
  return (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={t("common.back", "Back")}
        hitSlop={8}
        style={[styles.backBtn, { backgroundColor: palette.bgRaised, borderColor: palette.border }]}
      >
        <Ionicons name="chevron-back" size={22} color={palette.ink} />
      </Pressable>
      <Text style={[styles.title, { color: palette.ink }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ width: 44 }} />
    </View>
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
  title: { flex: 1, textAlign: "center", fontSize: 20, fontFamily: fontFamilies.displayBold },
});
