import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useResponsiveType } from "@/src/design/useResponsiveType";
import { useIEPGoals } from "@/hooks/useFamily";
import { AivoCard, LoadingState, EmptyState } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";

export default function CaregiverIEPGoals() {
  const { t } = useTranslation();
  const type = useResponsiveType();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const insets = useSafeAreaInsets();
  const { data: goals, isLoading } = useIEPGoals(childId);
  if (isLoading) return <LoadingState />;

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
        {t("caregiverIEP.title")}
      </Text>
      <Text style={styles.subtitle}>{t("caregiverIEP.subtitle")}</Text>

      {!goals?.length ? (
        <EmptyState
          icon={<Ionicons name="flag-outline" size={48} color={colors.textSecondary} />}
          title={t("caregiverIEP.noTitle")}
          message={t("caregiverIEP.noMessage")}
        />
      ) : (
        goals.map((g: any) => (
          <AivoCard key={g.id} style={styles.goalCard}>
            <View style={styles.goalHeader}>
              <Text style={styles.goalTitle}>{g.title}</Text>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor:
                      g.status === "met" ? colors.success + "20" : colors.info + "20",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: g.status === "met" ? colors.success : colors.info },
                  ]}
                >
                  {g.status}
                </Text>
              </View>
            </View>
            <View style={styles.bar}>
              <View style={[styles.fill, { width: `${g.progress}%` }]} />
            </View>
            <Text style={styles.pct}>{g.progress}% (Baseline → Current → Target)</Text>
          </AivoCard>
        ))
      )}
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
  goalCard: { marginBottom: spacing.sm },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  goalTitle: { fontSize: 15, fontFamily: "Nunito-Bold", color: colors.text, flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full },
  badgeText: { fontSize: 11, fontFamily: "Nunito-SemiBold" },
  bar: { height: 8, backgroundColor: colors.border, borderRadius: 4, marginBottom: 4 },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  pct: { fontSize: 12, fontFamily: "Nunito-Regular", color: colors.textSecondary },
});
