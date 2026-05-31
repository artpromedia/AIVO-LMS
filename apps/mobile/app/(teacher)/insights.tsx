import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useConnectedLearners } from "@/hooks/useFamily";
import { useBrainDomains } from "@/hooks/useBrain";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { Card } from "@/components/ui";
import { MasteryBar, EmptyState, LoadingState } from "@aivo/mobile-ui";
import { summarizeDomains } from "@/lib/learner-progress";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

interface StudentLite {
  id: string;
  firstName?: string;
  lastName?: string;
  gradeLevel?: string;
}

/**
 * Teacher class-wide insights (MOB-TCH-008) — mirror of web's
 * `/teacher/insights`. A mastery card per student across the class, each
 * routing into that student's detailed insight. Built from brain-svc
 * mastery (per-student); lesson-completion counts arrive with the
 * lesson-runs endpoint.
 */
export default function TeacherInsightsScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { data, isLoading } = useConnectedLearners();
  const students = (data as StudentLite[] | undefined) ?? [];

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t("common.back", "Back")}
          hitSlop={8}
          style={[
            styles.backBtn,
            { backgroundColor: palette.bgRaised, borderColor: palette.border },
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={palette.ink} />
        </Pressable>
        <Text style={[styles.title, { color: palette.ink }]}>
          {t("teacherInsights.title", "Class insights")}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {isLoading ? (
        <LoadingState />
      ) : students.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="stats-chart-outline" size={48} color={palette.inkMuted} />}
          title={t("teacherInsights.emptyTitle", "No insights yet")}
          message={t(
            "teacherInsights.emptyBody",
            "Insights appear once your students start learning.",
          )}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {students.map((s) => (
            <InsightCard key={s.id} student={s} />
          ))}
        </View>
      )}
    </ResponsiveScreen>
  );
}

function InsightCard({ student }: { student: StudentLite }) {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { domains, isLoading } = useBrainDomains(student.id, {
    enrolledGrade: student.gradeLevel ?? null,
  });
  const summary = useMemo(
    () =>
      summarizeDomains(
        domains.map((d) => ({ domain: d.domain, masteryPercent: d.masteryPercent })),
      ),
    [domains],
  );
  const top = summary.subjects[0];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${student.firstName ?? ""} ${student.lastName ?? ""}`}
      onPress={() => router.push(`/(teacher)/student/${student.id}/insight` as Href)}
    >
      <Card tone="raised" style={styles.card}>
        <View style={styles.cardHead}>
          <View style={[styles.avatar, { backgroundColor: palette.accentSoft }]}>
            <Text style={[styles.initial, { color: palette.accent }]}>
              {student.firstName?.[0] ?? "S"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: palette.ink }]}>
              {student.firstName} {student.lastName}
            </Text>
            <Text style={[styles.meta, { color: palette.inkMuted }]}>
              {isLoading
                ? t("common.loading", "Loading…")
                : top
                  ? t("teacherInsights.top", {
                      subject: top.name,
                      defaultValue: `Strongest: ${top.name}`,
                    })
                  : t("teacherInsights.noData", "No mastery data yet")}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.inkMuted} />
        </View>
        {!isLoading && summary.total > 0 ? (
          <View style={{ marginTop: spacing.sm }}>
            <MasteryBar
              value={summary.overallMastery}
              caption={t("teacherInsights.mastered", {
                count: summary.masteredCount,
                total: summary.total,
                defaultValue: `${summary.masteredCount}/${summary.total} subjects mastered`,
              })}
            />
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 22, fontFamily: fontFamilies.displayBold },
  card: { gap: spacing.sm },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: 18, fontFamily: fontFamilies.displayBold },
  name: { fontSize: 16, fontFamily: fontFamilies.bodyBold },
  meta: { fontSize: 13, fontFamily: fontFamilies.bodyRegular, marginTop: 2 },
});
