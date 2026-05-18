import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { AivoCard, AivoButton } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";

export default function SessionNotesScreen() {
  const { t } = useTranslation();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- route param reserved for future use
  const { id: _id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [skillTargeted, setSkillTargeted] = useState("");
  const [method, setMethod] = useState("");
  const [outcome, setOutcome] = useState("");
  const [recommendations, setRecommendations] = useState("");

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
      <Text style={styles.title}>{t("therapistClient.notesTitle")}</Text>
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
          title="Save Session Notes"
          onPress={() => {
            Alert.alert("Saved", "Session notes submitted to Brain");
            router.back();
          }}
          disabled={!skillTargeted.trim() || !outcome.trim()}
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
