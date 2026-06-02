import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useLessonSessions } from "@/hooks/useGradebook";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { Card } from "@/components/ui";
import { EmptyState, LoadingState } from "@aivo/mobile-ui";
import { splitLessons } from "@/lib/gradebook-logic";
import { subjectAccent } from "@/lib/subject-display";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Learner library (MOB-LRN-006) — mirror of web's `/learner/library`.
 * Completed lessons you can revisit, from real learning-svc session
 * history. Tapping a lesson reopens its stage.
 */
export default function LearnerLibraryScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const palette = useSensoryPalette();
  const { data: sessions, isLoading } = useLessonSessions(user?.id ?? "");
  const completed = useMemo(() => splitLessons(sessions ?? []).completed, [sessions]);

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
        <Text style={[styles.title, { color: palette.ink }]}>{t("library.title", "Library")}</Text>
        <View style={{ width: 44 }} />
      </View>

      {isLoading ? (
        <LoadingState />
      ) : completed.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="library-outline" size={48} color={palette.inkMuted} />}
          title={t("library.emptyTitle", "No finished lessons yet")}
          message={t("library.emptyBody", "Lessons you complete show up here to replay.")}
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {completed.map((s) => {
            const accent = subjectAccent(s.subject);
            return (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                accessibilityLabel={s.subject}
                onPress={() => router.push(`/(learner)/stage/${s.id}` as Href)}
              >
                <Card tone="raised" style={styles.row}>
                  <View style={[styles.icon, { backgroundColor: `${accent}1A` }]}>
                    <Ionicons name="book" size={20} color={accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.subject, { color: palette.ink }]}>{s.subject}</Text>
                    <Text style={[styles.meta, { color: palette.inkMuted }]}>
                      {formatDate(s.completedAt ?? s.startedAt)}
                      {s.xpEarned ? ` · ${s.xpEarned} XP` : ""}
                    </Text>
                  </View>
                  <Ionicons name="play-circle" size={24} color={accent} />
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}
    </ResponsiveScreen>
  );
}

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  subject: { fontSize: 16, fontFamily: fontFamilies.bodyBold },
  meta: { fontSize: 13, fontFamily: fontFamilies.bodyRegular, marginTop: 2 },
});
