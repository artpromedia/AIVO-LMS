import React from "react";
import { Text, ScrollView, Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useResponsiveType } from "@/src/design/useResponsiveType";
import { useLearner } from "@/hooks/useLearners";
import { AivoCard, AivoButton } from "@aivo/mobile-ui";
import BrainCloneCard from "@/src/components/brain/BrainCloneCard";
import { colors, spacing } from "@/constants/colors";

export default function TherapistClientProfile() {
  const { t } = useTranslation();
  const type = useResponsiveType();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: learner } = useLearner(id);
  const learnerName = learner ? `${learner.firstName} ${learner.lastName}`.trim() : "Client";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
    >
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>{t("common.back")}</Text>
      </Pressable>
      <Text style={[styles.title, { fontSize: type.h1.fontSize, lineHeight: type.h1.lineHeight }]}>
        {t("therapistClient.overview", { name: learner?.firstName || "Client" })}
      </Text>
      <Text style={styles.subtitle}>{t("therapistClient.brainProfile")}</Text>

      <AivoCard style={styles.overviewCard}>
        <Ionicons name="shield-checkmark" size={24} color={colors.success} />
        <Text style={styles.hipaaLabel}>HIPAA-Scoped Access</Text>
        <Text style={styles.levelText}>{learner?.functioningLevel || "Standard"}</Text>
      </AivoCard>

      <View style={styles.brainWrap}>
        <BrainCloneCard
          learnerId={id}
          learnerName={learnerName}
          enrolledGrade={learner?.gradeLevel ?? null}
          variant="full"
        />
      </View>

      <View style={styles.actions}>
        <AivoButton
          title={t("therapistClient.goalsTitle")}
          onPress={() => router.push(`/(therapist)/client/${id}/goals` as any)}
          style={{ flex: 1, marginRight: 8 }}
        />
        <AivoButton
          title={t("therapistClient.notesTitle")}
          onPress={() => router.push(`/(therapist)/client/${id}/notes` as any)}
          variant="outline"
          style={{ flex: 1 }}
        />
      </View>
      <AivoButton
        title={t("therapistClient.generateReport")}
        onPress={() => router.push(`/(therapist)/client/${id}/reports` as any)}
        variant="secondary"
        style={{ marginTop: spacing.sm }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 16, fontFamily: "Nunito-SemiBold", color: colors.primary },
  title: { fontSize: 22, fontFamily: "Nunito-ExtraBold", color: colors.text },
  subtitle: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  overviewCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    marginBottom: spacing.lg,
  },
  hipaaLabel: { fontSize: 14, fontFamily: "Nunito-SemiBold", color: colors.success },
  levelText: { fontSize: 14, fontFamily: "Nunito-Bold", color: colors.text, marginLeft: "auto" },
  brainWrap: { marginBottom: spacing.lg },
  actions: { flexDirection: "row", marginTop: spacing.md },
});
