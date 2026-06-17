import React from "react";
import { Text, ScrollView, Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useResponsiveType } from "@/src/design/useResponsiveType";
import { useLearner } from "@/hooks/useLearners";
import { useTeacherAssessmentStatus } from "@/hooks/useTeacherAssessment";
import { AivoCard, AivoButton } from "@aivo/mobile-ui";
import BrainCloneCard from "@/src/components/brain/BrainCloneCard";
import { colors, spacing } from "@/constants/colors";

export default function StudentBrainProfile() {
  const { t } = useTranslation();
  const type = useResponsiveType();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: learner } = useLearner(id);
  const { data: assessmentStatus } = useTeacherAssessmentStatus(id);
  const learnerName = learner ? `${learner.firstName} ${learner.lastName}`.trim() : "Student";
  const contributed = !!assessmentStatus?.completed;

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
        {t("teacherStudent.brain", { name: learner?.firstName || "Student" })}
      </Text>
      <Text style={styles.subtitle}>{t("teacherStudent.readOnlyProfile")}</Text>

      <AivoCard style={styles.overviewCard}>
        <View style={styles.brainCircle}>
          <Ionicons name="bulb" size={36} color={colors.primary} />
        </View>
        <Text style={styles.levelText}>
          {t("teacherStudent.level", {
            level: learner?.functioningLevel || "Standard",
          })}
        </Text>
      </AivoCard>

      <View style={styles.brainWrap}>
        <BrainCloneCard
          learnerId={id}
          learnerName={learnerName}
          enrolledGrade={learner?.gradeLevel ?? null}
          variant="full"
        />
      </View>

      <AivoCard style={styles.assessmentCard}>
        <View style={styles.assessmentHeader}>
          <View style={styles.assessmentIcon}>
            <Ionicons name="school" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.assessmentTitle}>
              {t("teacherAssessment.cardTitle", "Classroom assessment")}
            </Text>
            <Text style={styles.assessmentSubtitle}>
              {contributed
                ? t("teacherAssessment.cardContributed", "You've contributed — tap to update")
                : t("teacherAssessment.cardPrompt", "Share how this student learns in your class")}
            </Text>
          </View>
          {contributed ? (
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          ) : null}
        </View>
        <AivoButton
          title={
            contributed
              ? t("teacherAssessment.updateResponses", "Update responses")
              : t("teacherAssessment.start", "Start assessment")
          }
          onPress={() => router.push(`/(teacher)/student/${id}/assessment` as any)}
          variant={contributed ? "outline" : "primary"}
          icon={
            <Ionicons
              name="clipboard-outline"
              size={18}
              color={contributed ? colors.primary : colors.white}
            />
          }
          style={{ marginTop: spacing.sm }}
        />
      </AivoCard>

      <View style={styles.actions}>
        <AivoButton
          title={t("teacherStudent.submitInsight")}
          onPress={() => router.push(`/(teacher)/student/${id}/insight` as any)}
          icon={<Ionicons name="chatbubble-outline" size={18} color={colors.white} />}
          style={{ flex: 1, marginRight: 8 }}
        />
        <AivoButton
          title={t("teacherStudent.uploadIEP")}
          onPress={() => router.push(`/(teacher)/student/${id}/iep` as any)}
          variant="outline"
          icon={<Ionicons name="document-outline" size={18} color={colors.primary} />}
          style={{ flex: 1 }}
        />
      </View>
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
  overviewCard: {
    alignItems: "center" as const,
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
  },
  brainCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary + "15",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  levelText: { fontSize: 16, fontFamily: "Nunito-Bold", color: colors.text },
  brainWrap: { marginBottom: spacing.lg },
  assessmentCard: { marginBottom: spacing.lg },
  assessmentHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  assessmentIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  assessmentTitle: { fontSize: 16, fontFamily: "Nunito-Bold", color: colors.text },
  assessmentSubtitle: {
    fontSize: 13,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: 2,
  },
  actions: { flexDirection: "row", marginTop: spacing.md },
});
