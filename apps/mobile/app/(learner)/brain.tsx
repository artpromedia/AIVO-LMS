import React from "react";
import { Text, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { AivoCard } from "@aivo/mobile-ui";
import BrainCloneCard from "@/src/components/brain/BrainCloneCard";
import { colors, spacing } from "@/constants/colors";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";

export default function LearnerBrainScreen() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const learnerId = user?.id || "";
  const learnerName = user?.name || "Learner";

  return (
    <ResponsiveScreen maxWidth="reading" background={colors.background}>
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
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
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
