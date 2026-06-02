import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useResponsiveType } from "@/src/design/useResponsiveType";
import { useWindowSizeClass } from "@/src/design/useWindowSizeClass";
import { CONTENT_MAX_WIDTH, pickBySizeClass } from "@/src/design/responsive";
import { useCreateTherapySession } from "@/hooks/useFamily";
import { AivoCard, AivoButton } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";

export default function SessionNotesScreen() {
  const { t } = useTranslation();
  const type = useResponsiveType();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [skillTargeted, setSkillTargeted] = useState("");
  const [method, setMethod] = useState("");
  const [outcome, setOutcome] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const createSession = useCreateTherapySession();
  const { sizeClass, width: winWidth, isTablet } = useWindowSizeClass();
  const hPad = pickBySizeClass(sizeClass, {
    compact: spacing.md,
    medium: spacing.lg,
    expanded: spacing.xl,
  });
  const contentWidth = Math.min(
    winWidth - hPad * 2,
    isTablet ? CONTENT_MAX_WIDTH.reading : winWidth,
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: 32,
        paddingHorizontal: hPad,
        alignItems: "center",
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ width: contentWidth }}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>{t("common.back")}</Text>
        </Pressable>
        <Text
          style={[styles.title, { fontSize: type.h1.fontSize, lineHeight: type.h1.lineHeight }]}
        >
          {t("therapistClient.notesTitle")}
        </Text>
        <Text style={styles.subtitle}>{t("therapistClient.notesSubtitle")}</Text>

        <AivoCard>
          <View style={styles.field}>
            <Text style={styles.label}>Skill Targeted</Text>
            <TextInput
              style={styles.input}
              value={skillTargeted}
              onChangeText={setSkillTargeted}
              placeholder="e.g., Receptive language"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Method</Text>
            <TextInput
              style={styles.input}
              value={method}
              onChangeText={setMethod}
              placeholder="e.g., Play-based therapy"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Outcome</Text>
            <TextInput
              style={styles.textArea}
              value={outcome}
              onChangeText={setOutcome}
              placeholder="Describe the session outcome..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Recommendations</Text>
            <TextInput
              style={styles.textArea}
              value={recommendations}
              onChangeText={setRecommendations}
              placeholder="Any follow-up recommendations..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
          <AivoButton
            title={
              createSession.isPending
                ? t("common.saving", "Saving...")
                : t("therapistClient.saveNotes", "Save Session Notes")
            }
            onPress={() => {
              if (!id) {
                Alert.alert(
                  t("common.error", "Error"),
                  t("therapistClient.noClient", "No client selected."),
                );
                return;
              }
              createSession.mutate(
                {
                  learnerId: id,
                  outcome: outcome.trim(),
                  skillTargeted: skillTargeted.trim() || undefined,
                  method: method.trim() || undefined,
                  recommendations: recommendations.trim() || undefined,
                },
                {
                  onSuccess: () => {
                    Alert.alert(
                      t("common.success", "Success"),
                      t("therapistClient.notesSaved", "Session notes saved"),
                    );
                    router.back();
                  },
                  onError: (e) => {
                    Alert.alert(
                      t("common.error", "Error"),
                      e instanceof Error
                        ? e.message
                        : t("therapistClient.notesError", "Couldn't save session notes"),
                    );
                  },
                },
              );
            }}
            disabled={!skillTargeted.trim() || !outcome.trim() || createSession.isPending}
            style={{ marginTop: spacing.md }}
          />
        </AivoCard>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 16, fontFamily: "Nunito-SemiBold", color: colors.primary },
  title: { fontSize: 24, fontFamily: "Nunito-ExtraBold", color: colors.text },
  subtitle: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  field: { marginBottom: spacing.md },
  label: { fontSize: 14, fontFamily: "Nunito-SemiBold", color: colors.text, marginBottom: 6 },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    fontFamily: "Nunito-Regular",
    color: colors.text,
    backgroundColor: colors.surface,
  },
  textArea: {
    minHeight: 80,
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
