import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useBrainDomains } from "@/hooks/useBrain";
import { LoadingState } from "@aivo/mobile-ui";
import { Card } from "@/components/ui";
import { colors, spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";

export default function GradebookScreen() {
  const { user } = useAuth();
  const { domains, isLoading } = useBrainDomains(user?.id || "");
  const { t } = useTranslation();

  if (isLoading) return <LoadingState />;

  return (
    <ResponsiveScreen maxWidth="reading" background={colors.background}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backRow}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>{t("common.back")}</Text>
      </Pressable>
      <Text style={styles.title}>{t("learnerGradebook.title")}</Text>
      <Text style={styles.subtitle}>{t("learnerGradebook.subtitle")}</Text>

      {domains.map((domain) => (
        <Card key={domain.domain} style={styles.subjectCard}>
          <View style={styles.subjectHeader}>
            <Text style={styles.subjectName}>{domain.domain}</Text>
            <Text style={styles.subjectGrade}>{domain.masteryPercent}%</Text>
          </View>
          <View style={styles.masteryBar}>
            <View style={[styles.masteryFill, { width: `${domain.masteryPercent}%` }]} />
          </View>
          <Text style={styles.gradeInfo}>
            {t("learnerGradebook.functioningAt", {
              functioning: domain.functioningGrade,
              enrolled: domain.enrolledGrade,
            })}
          </Text>
        </Card>
      ))}
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 16, fontFamily: fontFamilies.bodySemiBold, color: colors.primary },
  title: { fontSize: 24, fontFamily: fontFamilies.bodyExtraBold, color: colors.text },
  subtitle: {
    fontSize: 14,
    fontFamily: fontFamilies.bodyRegular,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  subjectCard: { marginBottom: spacing.sm },
  subjectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  subjectName: { fontSize: 16, fontFamily: fontFamilies.bodyBold, color: colors.text },
  subjectGrade: { fontSize: 18, fontFamily: fontFamilies.bodyExtraBold, color: colors.primary },
  masteryBar: {
    height: 10,
    backgroundColor: colors.border,
    borderRadius: 5,
    overflow: "hidden",
    marginBottom: 4,
  },
  masteryFill: { height: 10, backgroundColor: colors.primary, borderRadius: 5 },
  gradeInfo: { fontSize: 12, fontFamily: fontFamilies.bodyRegular, color: colors.textSecondary },
});
