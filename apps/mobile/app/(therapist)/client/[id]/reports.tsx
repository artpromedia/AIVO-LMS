import React from "react";
import { Text, ScrollView, Pressable, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { AivoCard, AivoButton, EmptyState } from "@aivo/mobile-ui";
import { colors, spacing } from "@/constants/colors";

export default function ProgressReports() {
  const { t } = useTranslation();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- route param reserved for future use
  const { id: _id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
    >
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>{t("common.back")}</Text>
      </Pressable>
      <Text style={styles.title}>{t("therapistClient.reportsTitle")}</Text>
      <Text style={styles.subtitle}>{t("therapistClient.reportsSubtitle")}</Text>

      <AivoCard style={styles.genCard}>
        <Ionicons name="document-text" size={32} color={colors.primary} />
        <Text style={styles.genTitle}>{t("therapistClient.generateReport")}</Text>
        <Text style={styles.genDesc}>
          CPT code aligned progress report for insurance documentation
        </Text>
        <AivoButton
          title={t("therapistClient.generateReport")}
          onPress={() => Alert.alert("Report", "Report generation coming soon")}
          style={{ marginTop: spacing.md }}
        />
      </AivoCard>

      <Text style={[styles.sectionTitle, { marginBottom: spacing.md }]}>Previous Reports</Text>
      <EmptyState
        icon={<Ionicons name="folder-open-outline" size={48} color={colors.textSecondary} />}
        title={t("therapistClient.noReportsTitle")}
        message={t("therapistClient.noReportsMessage")}
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
  genCard: { alignItems: "center" as const, paddingVertical: spacing.lg, marginBottom: spacing.lg },
  genTitle: { fontSize: 18, fontFamily: "Nunito-Bold", color: colors.text, marginTop: 8 },
  genDesc: {
    fontSize: 13,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
  sectionTitle: { fontSize: 18, fontFamily: "Nunito-Bold", color: colors.text },
});
