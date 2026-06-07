import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearner } from "@/hooks/useLearners";
import { useAuth } from "@/hooks/useAuth";
import { useParentHomeworkSummary } from "@/hooks/useHomework";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { Card } from "@/components/ui";
import { EmptyState } from "@aivo/mobile-ui";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Parent homework summary (MOB-PAR-009) — mirror of web's
 * `/parent/learners/[learnerId]/homework`. Parents see a high-level
 * summary, never the raw chat (which belongs to the learner).
 */
export default function ParentHomeworkScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const { user } = useAuth();
  const { data: learner } = useLearner(childId ?? "");
  const { data: homework, isLoading, isError } = useParentHomeworkSummary(
    user?.id ?? "",
    childId ?? "",
  );
  const name = learner?.firstName ?? t("parentHub.learner", "your learner");
  const assignments = homework?.assignments ?? [];

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("parentHomework.title", "Homework")} />
      <Card tone="raised" style={{ gap: spacing.sm }}>
        <View style={styles.row}>
          <Ionicons name="shield-checkmark" size={20} color={palette.primary} />
          <Text style={[styles.privacy, { color: palette.ink }]}>
            {t("parentHomework.privacy", "Homework chats are private to your child")}
          </Text>
        </View>
        <Text style={[styles.body, { color: palette.inkMuted }]}>
          {t("parentHomework.body", {
            name,
            defaultValue: `You'll see a summary of ${name}'s homework activity here — topics covered and whether help is on track — without reading the raw conversation.`,
          })}
        </Text>
      </Card>
      {isLoading ? (
        <Card tone="raised" style={styles.stateCard}>
          <ActivityIndicator color={palette.primary} />
          <Text style={[styles.body, { color: palette.inkMuted }]}>
            {t("parentHomework.loading", "Loading homework activity…")}
          </Text>
        </Card>
      ) : isError ? (
        <Card tone="raised" style={styles.stateCard}>
          <Ionicons name="cloud-offline-outline" size={32} color={palette.inkMuted} />
          <Text style={[styles.body, { color: palette.inkMuted }]}>
            {t("parentHomework.loadError", "Homework activity could not be loaded. Try again soon.")}
          </Text>
        </Card>
      ) : assignments.length === 0 ? (
        <View style={{ marginTop: spacing.md }}>
          <EmptyState
            icon={<Ionicons name="color-wand-outline" size={48} color={palette.inkMuted} />}
            title={t("parentHomework.emptyTitle", "No homework sessions yet")}
            message={t(
              "parentHomework.emptyBody",
              "When your child uses the Homework Helper, a summary appears here.",
            )}
          />
        </View>
      ) : (
        <View style={styles.list}>
          {assignments.map((assignment) => (
            <Card key={assignment.id} tone="raised" accentStripe style={styles.assignmentCard}>
              <View style={styles.assignmentHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.subject, { color: palette.ink }]}>
                    {assignment.detectedSubject || assignment.subject}
                  </Text>
                  <Text style={[styles.meta, { color: palette.inkMuted }]}>
                    {t("parentHomework.problemCount", {
                      count: assignment.problemCount,
                      defaultValue: `${assignment.problemCount} problems`,
                    })}
                    {" · "}
                    {new Date(assignment.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: palette.primary + "18" }]}>
                  <Text style={[styles.status, { color: palette.primary }]}>
                    {t(`learnerHomework.status.${assignment.status}`, {
                      defaultValue: assignment.status,
                    })}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  privacy: { flex: 1, fontSize: 15, fontFamily: fontFamilies.bodyBold },
  body: { fontSize: 14, fontFamily: fontFamilies.bodyRegular, lineHeight: 20 },
  stateCard: { marginTop: spacing.md, alignItems: "center", gap: spacing.sm },
  list: { marginTop: spacing.md, gap: spacing.sm },
  assignmentCard: { paddingLeft: 26 },
  assignmentHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  subject: { fontSize: 16, fontFamily: fontFamilies.bodyBold, textTransform: "capitalize" },
  meta: { marginTop: 4, fontSize: 13, fontFamily: fontFamilies.bodyRegular },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  status: { fontSize: 12, fontFamily: fontFamilies.bodyBold },
});
