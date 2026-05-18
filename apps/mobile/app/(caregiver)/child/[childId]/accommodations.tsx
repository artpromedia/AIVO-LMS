import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useResponsiveType } from "@/src/design/useResponsiveType";
import { useBrainDomains } from "@/hooks/useBrain";
import { useLearner } from "@/hooks/useLearners";
import { AivoCard, LoadingState, EmptyState } from "@aivo/mobile-ui";
import { colors, spacing } from "@/constants/colors";

export default function AccommodationsScreen() {
  const { t } = useTranslation();
  const type = useResponsiveType();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const insets = useSafeAreaInsets();
  const { data: learner } = useLearner(childId);
  const { domains, isLoading } = useBrainDomains(childId, {
    enrolledGrade: learner?.gradeLevel ?? null,
  });
  if (isLoading) return <LoadingState />;

  const allAccommodations = domains.flatMap((d) =>
    d.accommodations.map((a) => ({ domain: d.domain, accommodation: a })),
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
    >
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>{t("common.back")}</Text>
      </Pressable>
      <Text style={[styles.title, { fontSize: type.h1.fontSize, lineHeight: type.h1.lineHeight }]}>{t("caregiverAccommodations.title")}</Text>
      <Text style={styles.subtitle}>{t("caregiverAccommodations.subtitle")}</Text>

      {allAccommodations.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="shield-outline" size={48} color={colors.textSecondary} />}
          title={t("caregiverAccommodations.noTitle")}
          message={t("caregiverAccommodations.noMessage")}
        />
      ) : (
        allAccommodations.map((item, i) => (
          <AivoCard key={i} style={styles.accCard}>
            <View style={styles.accRow}>
              <Ionicons name="shield-checkmark" size={20} color={colors.success} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.accName}>{item.accommodation}</Text>
                <Text style={styles.accDomain}>{item.domain}</Text>
              </View>
            </View>
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
  accCard: { marginBottom: spacing.sm },
  accRow: { flexDirection: "row", alignItems: "center" },
  accName: { fontSize: 15, fontFamily: "Nunito-Bold", color: colors.text },
  accDomain: {
    fontSize: 12,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: 2,
  },
});
