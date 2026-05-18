import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearnerMilestones, type Milestone } from "@/hooks/useLearnerMilestones";
import { AivoCard } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";

const BADGE_KEYS = [
  "first_session",
  "on_fire",
  "brain_activated",
  "bookworm",
  "mastery_champion",
  "goal_getter",
  "team_player",
  "multi_subject",
  "speed_learner",
  "explorer",
] as const;

type BadgeKey = (typeof BADGE_KEYS)[number];

const BADGE_ICON: Record<BadgeKey, keyof typeof Ionicons.glyphMap> = {
  first_session: "star",
  on_fire: "flame",
  brain_activated: "bulb",
  bookworm: "book",
  mastery_champion: "trophy",
  goal_getter: "flag",
  team_player: "people",
  multi_subject: "color-palette",
  speed_learner: "flash",
  explorer: "compass",
};

const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  skill_mastered: "flag",
  streak: "flame",
  xp_milestone: "star",
  badge_earned: "trophy",
  mastery_up: "trending-up",
  brain_created: "bulb",
  joined: "clipboard",
};

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (Number.isNaN(days)) return "";
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return `${w}w ago`;
  }
  return date.toLocaleDateString();
}

export default function MilestonesScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const learnerId = childId ?? "";
  const { data, isLoading } = useLearnerMilestones(learnerId);

  const milestones: Milestone[] = data?.milestones ?? [];
  const earnedKeys = new Set((data?.badges ?? []).map((b: { badgeKey: string }) => b.badgeKey));
  const streak = data?.streak;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 16 }]}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <Pressable
        onPress={() => router.back()}
        style={styles.backRow}
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
      >
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>{t("common.back")}</Text>
      </Pressable>

      <Text style={styles.title}>{t("parentMilestones.title")}</Text>

      {streak ? (
        <View style={styles.streakRow}>
          <View style={styles.streakCard}>
            <Ionicons name="flame" size={26} color={colors.visualSel} />
            <Text style={styles.streakValue}>{streak.currentStreak ?? 0}</Text>
            <Text style={styles.streakLabel}>{t("parentMilestones.currentStreak")}</Text>
          </View>
          <View style={[styles.streakCard, { marginLeft: spacing.sm }]}>
            <Ionicons name="star" size={26} color={colors.visualSel} />
            <Text style={styles.streakValue}>{streak.longestStreak ?? 0}</Text>
            <Text style={styles.streakLabel}>{t("parentMilestones.longestStreak")}</Text>
          </View>
        </View>
      ) : null}

      <AivoCard style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: colors.visualSel + "1F" }]}>
            <Ionicons name="ribbon" size={18} color={colors.visualSel} />
          </View>
          <Text style={styles.sectionTitle}>{t("parentMilestones.badgeCollection")}</Text>
        </View>
        <View style={styles.badgeGrid}>
          {BADGE_KEYS.map((key) => {
            const earned = earnedKeys.has(key);
            return (
              <View key={key} style={[styles.badge, !earned && styles.badgeLocked]}>
                <Ionicons
                  name={earned ? BADGE_ICON[key] : "help-circle"}
                  size={26}
                  color={earned ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.badgeName,
                    earned ? styles.badgeNameEarned : styles.badgeNameLocked,
                  ]}
                  numberOfLines={2}
                >
                  {t(`parentMilestones.badges.${key}.name`)}
                </Text>
                <Text style={styles.badgeDesc} numberOfLines={2}>
                  {t(`parentMilestones.badges.${key}.description`)}
                </Text>
              </View>
            );
          })}
        </View>
      </AivoCard>

      <AivoCard style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: colors.primary + "1F" }]}>
            <Ionicons name="sparkles" size={18} color={colors.primary} />
          </View>
          <Text style={styles.sectionTitle}>{t("parentMilestones.timeline")}</Text>
        </View>
        {isLoading ? (
          <View style={styles.timelineLoading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : milestones.length === 0 ? (
          <View style={styles.timelineEmpty}>
            <Ionicons name="leaf-outline" size={28} color={colors.visualScience} />
            <Text style={styles.timelineEmptyText}>{t("parentMilestones.empty")}</Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {milestones.map((m) => (
              <View key={m.id} style={styles.timelineItem}>
                <View style={styles.timelineDot}>
                  <Ionicons name={TYPE_ICON[m.type] ?? "trophy"} size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.timelineHeader}>
                    <Text style={styles.timelineTitle} numberOfLines={2}>
                      {m.title}
                    </Text>
                    <Text style={styles.timelineDate}>{formatRelative(m.createdAt)}</Text>
                  </View>
                  {m.description ? <Text style={styles.timelineDesc}>{m.description}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        )}
      </AivoCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 16, fontFamily: "Nunito-SemiBold", color: colors.primary },
  title: {
    fontSize: 24,
    fontFamily: "Nunito-ExtraBold",
    color: colors.text,
    marginBottom: spacing.md,
  },
  streakRow: { flexDirection: "row", marginBottom: spacing.md },
  streakCard: {
    flex: 1,
    backgroundColor: colors.visualSel + "1F",
    padding: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  streakValue: {
    fontSize: 24,
    fontFamily: "Nunito-ExtraBold",
    color: colors.visualSel,
    marginTop: 4,
  },
  streakLabel: {
    fontSize: 11,
    fontFamily: "Nunito-SemiBold",
    color: colors.visualSel,
    marginTop: 2,
  },
  section: { marginBottom: spacing.md, padding: spacing.md },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.md },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { fontSize: 16, fontFamily: "Nunito-Bold", color: colors.text },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  badge: { width: "50%", paddingHorizontal: 4, marginBottom: spacing.sm, alignItems: "center" },
  badgeLocked: { opacity: 0.6 },
  badgeName: { fontSize: 12, fontFamily: "Nunito-Bold", textAlign: "center", marginTop: 6 },
  badgeNameEarned: { color: colors.primary },
  badgeNameLocked: { color: colors.textSecondary },
  badgeDesc: {
    fontSize: 10,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 2,
  },
  timelineLoading: { paddingVertical: spacing.md, alignItems: "center" },
  timelineEmpty: { paddingVertical: spacing.md, alignItems: "center", gap: 8 },
  timelineEmptyText: {
    fontSize: 13,
    fontFamily: "Nunito-SemiBold",
    color: colors.textSecondary,
    textAlign: "center",
  },
  timeline: { gap: spacing.md },
  timelineItem: { flexDirection: "row", gap: 12 },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary + "1F",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineHeader: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  timelineTitle: { flex: 1, fontSize: 14, fontFamily: "Nunito-Bold", color: colors.text },
  timelineDate: { fontSize: 11, fontFamily: "Nunito-Regular", color: colors.textSecondary },
  timelineDesc: {
    fontSize: 12,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: 2,
  },
});
