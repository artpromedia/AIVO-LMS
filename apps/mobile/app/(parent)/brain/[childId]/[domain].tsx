import React, { useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useResponsiveType } from "@/src/design/useResponsiveType";
import { useLearner } from "@/hooks/useLearners";
import { useBrainDomains, labelForDomain } from "@/hooks/useBrain";
import { AivoCard, LoadingState } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";

export default function DomainDrillDown() {
  const { childId, domain } = useLocalSearchParams<{
    childId: string;
    domain: string;
  }>();
  const insets = useSafeAreaInsets();
  const { data: learner } = useLearner(childId);
  const { domains, isLoading } = useBrainDomains(childId, {
    enrolledGrade: learner?.gradeLevel ?? null,
  });
  const { t } = useTranslation();
  const type = useResponsiveType();

  const targetLabel = useMemo(() => labelForDomain(domain || ""), [domain]);
  const domainData = domains.find((d) => d.domain.toLowerCase() === targetLabel.toLowerCase());

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
        {targetLabel}
      </Text>
      <Text style={styles.subtitle}>Grade Ladder & Skill Breakdown</Text>

      <AivoCard style={styles.ladderCard}>
        <View style={styles.ladderHeader}>
          <Text style={styles.ladderLabel}>
            {t("parentBrain.enrolledGrade", { grade: "" }).trim()}
          </Text>
          <Text style={styles.ladderValue}>{domainData?.enrolledGrade || "N/A"}</Text>
        </View>
        <View style={styles.ladderBar}>
          <View style={[styles.ladderFill, { height: `${domainData?.masteryPercent || 0}%` }]} />
          <View style={styles.ladderMarker}>
            <Text style={styles.markerText}>{domainData?.functioningGrade || "N/A"}</Text>
          </View>
        </View>
        <View style={styles.ladderFooter}>
          <Text style={styles.ladderLabel}>
            {t("parentBrain.functioningGrade", { grade: "" }).trim()}
          </Text>
          <Text style={styles.ladderValue}>{domainData?.functioningGrade || "N/A"}</Text>
        </View>
      </AivoCard>

      <Text style={[styles.sectionTitle, { marginBottom: spacing.md }]}>Accommodations</Text>
      {domainData?.accommodations?.length ? (
        domainData.accommodations.map((acc) => (
          <AivoCard key={acc} style={styles.accCard}>
            <Ionicons name="shield-checkmark" size={20} color={colors.success} />
            <Text style={styles.accText}>{acc}</Text>
          </AivoCard>
        ))
      ) : (
        <Text style={styles.noData}>No accommodations for this domain</Text>
      )}

      {domainData && domainData.tutors.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: spacing.lg, marginBottom: spacing.md }]}>
            Recommended Tutors
          </Text>
          {domainData.tutors.map((tutor) => (
            <AivoCard key={tutor} style={styles.accCard}>
              <Ionicons name="school-outline" size={20} color={colors.primary} />
              <Text style={styles.accText}>{tutor}</Text>
            </AivoCard>
          ))}
        </>
      )}

      <Text style={[styles.sectionTitle, { marginTop: spacing.lg, marginBottom: spacing.md }]}>
        Session History
      </Text>
      <AivoCard>
        <Text style={styles.noData}>Session history will appear after learning sessions</Text>
      </AivoCard>
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
  ladderCard: { marginBottom: spacing.lg, alignItems: "center" as const },
  ladderHeader: { alignItems: "center", marginBottom: spacing.md },
  ladderLabel: { fontSize: 12, fontFamily: "Nunito-Regular", color: colors.textSecondary },
  ladderValue: { fontSize: 18, fontFamily: "Nunito-Bold", color: colors.text },
  ladderBar: {
    width: 40,
    height: 200,
    backgroundColor: colors.border,
    borderRadius: 20,
    justifyContent: "flex-end",
    alignItems: "center",
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  ladderFill: { width: "100%", backgroundColor: colors.primary + "40", borderRadius: 20 },
  ladderMarker: {
    position: "absolute",
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  markerText: { fontSize: 12, fontFamily: "Nunito-Bold", color: "#FFF" },
  ladderFooter: { alignItems: "center" },
  sectionTitle: { fontSize: 18, fontFamily: "Nunito-Bold", color: colors.text },
  accCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    marginBottom: spacing.sm,
  },
  accText: { fontSize: 14, fontFamily: "Nunito-Regular", color: colors.text, flex: 1 },
  noData: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    textAlign: "center",
    padding: spacing.md,
  },
});
