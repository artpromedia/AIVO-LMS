import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useResponsiveType } from "@/src/design/useResponsiveType";
import { useTherapyGoals } from "@/hooks/useFamily";
import { AivoCard, LoadingState, EmptyState } from "@aivo/mobile-ui";
import { colors, spacing } from "@/constants/colors";

export default function TherapyGoals() {
  const { t } = useTranslation();
  const type = useResponsiveType();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: goals, isLoading } = useTherapyGoals(id);
  if (isLoading) return <LoadingState />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
    >
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>{t("common.back")}</Text>
      </Pressable>
      <Text style={[styles.title, { fontSize: type.h1.fontSize, lineHeight: type.h1.lineHeight }]}>{t("therapistClient.goalsTitle")}</Text>
      <Text style={styles.subtitle}>{t("therapistClient.goalsSubtitle")}</Text>

      {!goals?.length ? (
        <EmptyState
          icon={<Ionicons name="flag-outline" size={48} color={colors.textSecondary} />}
          title={t("therapistClient.noGoalsTitle")}
          message={t("therapistClient.noGoalsMessage")}
          actionLabel={t("therapistClient.addGoal")}
          onAction={() => {}}
        />
      ) : (
        goals.map((g: any) => (
          <AivoCard key={g.id} style={styles.goalCard}>
            <Text style={styles.goalTitle}>{g.title}</Text>
            <View style={styles.bar}>
              <View style={[styles.fill, { width: `${g.progress}%` }]} />
            </View>
            <Text style={styles.pct}>{g.progress}%</Text>
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
  goalTitle: { fontSize: 15, fontFamily: "Nunito-Bold", color: colors.text, marginBottom: 8 },
  bar: { height: 8, backgroundColor: colors.border, borderRadius: 4, marginBottom: 4 },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  pct: { fontSize: 12, fontFamily: "Nunito-SemiBold", color: colors.textSecondary },
});
