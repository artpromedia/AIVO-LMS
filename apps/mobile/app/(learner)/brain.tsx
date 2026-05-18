import React from "react";
import { Text, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { AivoCard } from "@aivo/mobile-ui";
import BrainCloneCard from "@/src/components/brain/BrainCloneCard";
import { colors, spacing } from "@/constants/colors";

export default function LearnerBrainScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useTranslation();

  const learnerId = user?.id || "";
  const learnerName = user?.name || "Learner";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
    >
      <Text style={styles.title}>{t("learnerBrain.title")}</Text>
      <Text style={styles.subtitle}>{t("learnerBrain.subtitle")}</Text>

      <AivoCard style={styles.brainCard}>
        <View style={styles.brainVisual}>
          <Ionicons name="bulb" size={48} color={colors.primary} />
        </View>
        <Text style={styles.brainLevel}>{t("learnerBrain.level", { level: "Standard" })}</Text>
      </AivoCard>

      <Text style={[styles.sectionTitle, { marginBottom: spacing.md }]}>
        {t("learnerBrain.mySubjects")}
      </Text>
      <BrainCloneCard learnerId={learnerId} learnerName={learnerName} variant="full" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  title: { fontSize: 24, fontFamily: "Nunito-ExtraBold", color: colors.text },
  subtitle: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  brainCard: {
    alignItems: "center" as const,
    marginBottom: spacing.lg,
    paddingVertical: spacing.lg,
  },
  brainVisual: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary + "15",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  brainLevel: { fontSize: 18, fontFamily: "Nunito-Bold", color: colors.text },
  sectionTitle: { fontSize: 18, fontFamily: "Nunito-Bold", color: colors.text },
});
