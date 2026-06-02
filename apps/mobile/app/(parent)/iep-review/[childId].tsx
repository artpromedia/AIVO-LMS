import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearner } from "@/hooks/useLearners";
import { useIEPGoals } from "@/hooks/useFamily";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { Card } from "@/components/ui";
import { MasteryBar, LoadingState, EmptyState } from "@aivo/mobile-ui";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Parent IEP review (MOB-PAR-010) — mirror of web's
 * `/parent/learners/[learnerId]/iep/review`. Read-only review of the
 * IEP goals + progress from family-svc.
 */
export default function ParentIEPReviewScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const id = childId ?? "";
  const { data: learner } = useLearner(id);
  const { data, isLoading } = useIEPGoals(id);
  const goals = data as { goals?: any[] } | any[] | undefined;
  const list: any[] = Array.isArray(goals) ? goals : (goals?.goals ?? []);

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("parentIepReview.title", "IEP review")} />
      {isLoading ? (
        <LoadingState />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="clipboard-outline" size={48} color={palette.inkMuted} />}
          title={t("parentIepReview.emptyTitle", "No IEP goals yet")}
          message={t(
            "parentIepReview.emptyBody",
            "When goals are set, you can review them and their progress here.",
          )}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {learner ? (
            <Text style={[styles.subtitle, { color: palette.inkMuted }]}>
              {t("parentIepReview.for", {
                name: learner.firstName,
                defaultValue: `Goals for ${learner.firstName}`,
              })}
            </Text>
          ) : null}
          {list.map((g, i) => (
            <Card key={g.id ?? i} tone="raised" style={{ gap: spacing.sm }}>
              <Text style={[styles.goalTitle, { color: palette.ink }]}>
                {g.title ?? g.description ?? t("parentIepReview.goal", "Goal")}
              </Text>
              {typeof g.progress === "number" ? (
                <MasteryBar
                  value={g.progress}
                  caption={t("parentIepReview.progress", "Progress")}
                />
              ) : null}
              {g.targetDate ? (
                <Text style={[styles.meta, { color: palette.inkMuted }]}>
                  {t("parentIepReview.target", "Target")}: {g.targetDate}
                </Text>
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 14, fontFamily: fontFamilies.bodyRegular },
  goalTitle: { fontSize: 15, fontFamily: fontFamilies.bodyBold },
  meta: { fontSize: 12, fontFamily: fontFamilies.bodyRegular },
});
