import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useResponsiveType } from "@/src/design/useResponsiveType";
import { useWindowSizeClass } from "@/src/design/useWindowSizeClass";
import { CONTENT_MAX_WIDTH, pickBySizeClass } from "@/src/design/responsive";
import { useTherapyGoals, useCreateTherapyGoal } from "@/hooks/useFamily";
import { AivoCard, LoadingState, EmptyState } from "@aivo/mobile-ui";
import { colors, spacing } from "@/constants/colors";

export default function TherapyGoals() {
  const { t } = useTranslation();
  const type = useResponsiveType();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useTherapyGoals(id);
  const goals = data?.goals;
  const createGoal = useCreateTherapyGoal();
  const [adding, setAdding] = useState(false);
  const [goalText, setGoalText] = useState("");
  const [error, setError] = useState<string | null>(null);
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

  function openAdd() {
    setGoalText("");
    setError(null);
    setAdding(true);
  }

  function saveGoal() {
    const text = goalText.trim();
    if (!text) return;
    setError(null);
    createGoal.mutate(
      { learnerId: id, goalText: text },
      {
        onSuccess: () => {
          setAdding(false);
          setGoalText("");
        },
        onError: () => setError(t("therapistClient.addGoalError", "Couldn't save the goal.")),
      },
    );
  }

  if (isLoading) return <LoadingState />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: 32,
        paddingHorizontal: hPad,
        alignItems: "center",
      }}
    >
      <View style={{ width: contentWidth }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backRow}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>{t("common.back")}</Text>
        </Pressable>
        <Text
          style={[styles.title, { fontSize: type.h1.fontSize, lineHeight: type.h1.lineHeight }]}
        >
          {t("therapistClient.goalsTitle")}
        </Text>
        <Text style={styles.subtitle}>{t("therapistClient.goalsSubtitle")}</Text>

        {!goals?.length ? (
          <EmptyState
            icon={<Ionicons name="flag-outline" size={48} color={colors.textSecondary} />}
            title={t("therapistClient.noGoalsTitle")}
            message={t("therapistClient.noGoalsMessage")}
            actionLabel={t("therapistClient.addGoal")}
            onAction={openAdd}
          />
        ) : (
          <>
            <Pressable accessibilityRole="button" onPress={openAdd} style={styles.addBtn}>
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={styles.addBtnText}>{t("therapistClient.addGoal")}</Text>
            </Pressable>
            {goals.map((g: any) => (
              <AivoCard key={g.id} style={styles.goalCard}>
                <Text style={styles.goalTitle}>{g.title}</Text>
                <View style={styles.bar}>
                  <View style={[styles.fill, { width: `${g.progressPct ?? 0}%` }]} />
                </View>
                <Text style={styles.pct}>{g.progressPct ?? 0}%</Text>
              </AivoCard>
            ))}
          </>
        )}
      </View>

      <Modal
        visible={adding}
        transparent
        animationType="slide"
        onRequestClose={() => setAdding(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("therapistClient.addGoal")}</Text>
            <TextInput accessibilityLabel={t("therapistClient.addGoalPlaceholder", "Describe the goal…")}
              value={goalText}
              onChangeText={setGoalText}
              placeholder={t("therapistClient.addGoalPlaceholder", "Describe the goal…")}
              placeholderTextColor={colors.textSecondary}
              multiline
              style={styles.modalInput}
            />
            {error ? <Text style={styles.modalError}>{error}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAdding(false)}
                style={[styles.modalBtn, styles.modalBtnGhost]}
              >
                <Text style={styles.modalBtnGhostText}>{t("common.cancel", "Cancel")}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={createGoal.isPending || goalText.trim().length === 0}
                onPress={saveGoal}
                style={[
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  { opacity: createGoal.isPending || !goalText.trim() ? 0.5 : 1 },
                ]}
              >
                {createGoal.isPending ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>{t("common.save", "Save")}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginBottom: spacing.md,
  },
  addBtnText: { fontSize: 14, fontFamily: "Nunito-Bold", color: colors.primary },
  goalCard: { marginBottom: spacing.sm },
  goalTitle: { fontSize: 15, fontFamily: "Nunito-Bold", color: colors.text, marginBottom: 8 },
  bar: { height: 8, backgroundColor: colors.border, borderRadius: 4, marginBottom: 4 },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  pct: { fontSize: 12, fontFamily: "Nunito-SemiBold", color: colors.textSecondary },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: { fontSize: 18, fontFamily: "Nunito-ExtraBold", color: colors.text },
  modalInput: {
    minHeight: 96,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    fontFamily: "Nunito-Regular",
    color: colors.text,
    textAlignVertical: "top",
  },
  modalError: { fontSize: 13, color: "#ef4444", fontFamily: "Nunito-Regular" },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: spacing.xs,
  },
  modalBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnGhost: { backgroundColor: "transparent" },
  modalBtnGhostText: { fontSize: 15, fontFamily: "Nunito-Bold", color: colors.textSecondary },
  modalBtnPrimary: { backgroundColor: colors.primary, minWidth: 88 },
  modalBtnPrimaryText: { fontSize: 15, fontFamily: "Nunito-Bold", color: "#ffffff" },
});
