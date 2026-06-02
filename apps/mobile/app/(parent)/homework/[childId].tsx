import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearner } from "@/hooks/useLearners";
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
  const { data: learner } = useLearner(childId ?? "");
  const name = learner?.firstName ?? t("parentHub.learner", "your learner");

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
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  privacy: { flex: 1, fontSize: 15, fontFamily: fontFamilies.bodyBold },
  body: { fontSize: 14, fontFamily: fontFamilies.bodyRegular, lineHeight: 20 },
});
