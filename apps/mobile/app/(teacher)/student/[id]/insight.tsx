import React, { useState } from "react";
import { Text, TextInput, ScrollView, Pressable, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useResponsiveType } from "@/src/design/useResponsiveType";
import { useCreateTeacherInsight } from "@/hooks/useFamily";
import { AivoCard, AivoButton } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";

export default function SubmitInsightScreen() {
  const { t } = useTranslation();
  const type = useResponsiveType();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [insightText, setInsightText] = useState("");
  const createInsight = useCreateTeacherInsight();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>{t("common.back")}</Text>
      </Pressable>
      <Text style={[styles.title, { fontSize: type.h1.fontSize, lineHeight: type.h1.lineHeight }]}>
        {t("teacherInsight.title")}
      </Text>
      <Text style={styles.subtitle}>{t("teacherInsight.subtitle")}</Text>

      <AivoCard>
        <Text style={styles.label}>{t("teacherInsight.yourInsight")}</Text>
        <TextInput
          style={styles.textArea}
          value={insightText}
          onChangeText={setInsightText}
          placeholder={t("teacherInsight.placeholder")}
          placeholderTextColor={colors.textSecondary}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
        <AivoButton
          title={
            createInsight.isPending ? t("common.saving", "Saving...") : t("teacherInsight.title")
          }
          onPress={() => {
            if (!id) {
              Alert.alert(
                t("common.error", "Error"),
                t("teacherInsight.noStudent", "No student selected."),
              );
              return;
            }
            createInsight.mutate(
              { learnerId: id, insightText: insightText.trim() },
              {
                onSuccess: () => {
                  Alert.alert(t("common.success"), t("teacherInsight.submitted"));
                  router.back();
                },
                onError: (e) => {
                  Alert.alert(
                    t("common.error", "Error"),
                    e instanceof Error
                      ? e.message
                      : t("teacherInsight.error", "Couldn't submit insight"),
                  );
                },
              },
            );
          }}
          disabled={!insightText.trim() || createInsight.isPending}
          style={{ marginTop: spacing.md }}
        />
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
  label: { fontSize: 14, fontFamily: "Nunito-SemiBold", color: colors.text, marginBottom: 6 },
  textArea: {
    minHeight: 120,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 15,
    fontFamily: "Nunito-Regular",
    color: colors.text,
    backgroundColor: colors.surface,
  },
});
