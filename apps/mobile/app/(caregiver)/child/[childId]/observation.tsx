import React, { useState } from "react";
import { Text, ScrollView, Pressable, TextInput, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useResponsiveType } from "@/src/design/useResponsiveType";
import { useCreateObservation } from "@/hooks/useFamily";
import { AivoCard, AivoButton } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";

export default function ObservationScreen() {
  const { t } = useTranslation();
  const type = useResponsiveType();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState("");
  const createObservation = useCreateObservation();

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
        {t("caregiverObservation.title")}
      </Text>
      <Text style={styles.subtitle}>{t("caregiverObservation.subtitle")}</Text>

      <AivoCard>
        <Text style={styles.prompt}>{t("caregiverObservation.prompt")}</Text>
        <TextInput
          style={styles.textArea}
          value={note}
          onChangeText={setNote}
          placeholder={t("caregiverObservation.placeholder")}
          placeholderTextColor={colors.textSecondary}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
        <AivoButton
          title={
            createObservation.isPending
              ? t("common.saving", "Saving...")
              : t("caregiverObservation.submitBtn")
          }
          onPress={() => {
            if (!childId) {
              Alert.alert(
                t("common.error", "Error"),
                t("caregiverObservation.noChild", "No child selected."),
              );
              return;
            }
            createObservation.mutate(
              { learnerId: childId, notes: note.trim() },
              {
                onSuccess: () => {
                  Alert.alert(t("common.success"), t("caregiverObservation.submitted"));
                  router.back();
                },
                onError: (e) => {
                  Alert.alert(
                    t("common.error", "Error"),
                    e instanceof Error
                      ? e.message
                      : t("caregiverObservation.error", "Couldn't submit observation"),
                  );
                },
              },
            );
          }}
          disabled={!note.trim() || createObservation.isPending}
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
  prompt: { fontSize: 16, fontFamily: "Nunito-Bold", color: colors.text, marginBottom: 8 },
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
