import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useBrainDomains } from "@/hooks/useBrain";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { MobileSubjectCard, EmptyState, LoadingState, useColumns } from "@aivo/mobile-ui";
import { masteryLabel } from "@/lib/subject-display";
import { getDiscoverableSubjects, TUTORS } from "@aivo/brand";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Learner subjects grid — mirror of web's `/learner/subjects`
 * (MOB-LRN-002). Sprint 1 (subject/tutor UX): driven by the canonical
 * `@aivo/brand` subject registry (the same source web uses), so both
 * clients show the identical set and every subject is reachable +
 * playable end-to-end. Per-subject mastery is merged in from brain-svc
 * when present. Responsive grid: 1 col on phone, 2–3 on tablet.
 */
export default function LearnerSubjectsScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const palette = useSensoryPalette();
  const { domains, isLoading } = useBrainDomains(user?.id ?? "");
  const columns = useColumns({ compact: 1, medium: 2, expanded: 3 });

  const subjects = getDiscoverableSubjects();
  const masteryByName = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const d of domains) m.set(d.domain.toLowerCase(), d.masteryPercent);
    return m;
  }, [domains]);

  return (
    <ResponsiveScreen maxWidth="dashboard" background={palette.bgPage}>
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
          {t("subjects.title", "Subjects")}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {isLoading ? (
        <LoadingState />
      ) : subjects.length === 0 ? (
        <EmptyState
          title={t("subjects.emptyTitle", "No subjects yet")}
          message={t("subjects.emptyBody", "Your subjects will show up here.")}
        />
      ) : (
        <View style={styles.grid}>
          {subjects.map((s) => {
            const tutor = TUTORS[s.tutorKey];
            const mastery = masteryByName.get(s.name.toLowerCase()) ?? 0;
            return (
              <View key={s.slug} style={[styles.cell, { flexBasis: `${100 / columns}%` }]}>
                <MobileSubjectCard
                  name={s.name}
                  masteryPct={mastery}
                  masteryLabel={masteryLabel(mastery)}
                  accent={tutor.color}
                  onPress={() => router.push(`/(learner)/subjects/${s.slug}` as Href)}
                />
              </View>
            );
          })}
        </View>
      )}
    </ResponsiveScreen>
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
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -spacing.xs },
  cell: { padding: spacing.xs },
});
