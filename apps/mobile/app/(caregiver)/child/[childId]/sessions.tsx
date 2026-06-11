import React from "react";
import { Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useResponsiveType } from "@/src/design/useResponsiveType";
import { EmptyState } from "@aivo/mobile-ui";
import { colors, spacing } from "@/constants/colors";

export default function SessionLogScreen() {
  const { t } = useTranslation();
  const type = useResponsiveType();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- route param reserved for future use
  const { childId: _childId } = useLocalSearchParams<{ childId: string }>();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
    >
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backRow}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>{t("common.back")}</Text>
      </Pressable>
      <Text style={[styles.title, { fontSize: type.h1.fontSize, lineHeight: type.h1.lineHeight }]}>
        {t("caregiverSessions.title")}
      </Text>
      <Text style={styles.subtitle}>{t("caregiverSessions.subtitle")}</Text>

      <EmptyState
        icon={<Ionicons name="time-outline" size={48} color={colors.textSecondary} />}
        title={t("caregiverSessions.noTitle")}
        message={t("caregiverSessions.noMessage")}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 16, fontFamily: "Nunito-SemiBold", color: colors.primary },
  title: { fontSize: 24, fontFamily: "Nunito-ExtraBold", color: colors.text },
  subtitle: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
});
