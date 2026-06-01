import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { router, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useEngagement } from "@/hooks/useEngagement";
import { useLearnerEntitlements } from "@/hooks/useLearnerEntitlements";
import { TUTORS, INCLUSIVE_WARM_PALETTE } from "@aivo/brand";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies, typography } from "@/constants/typography";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { Card, HeaderUserChip, SensoryToggle, DarkCapsuleNav } from "@/components/ui";
import { useWindowSizeClass } from "@/src/design/useWindowSizeClass";
import { CONTENT_MAX_WIDTH, gridColumns, pickBySizeClass } from "@/src/design/responsive";
import { useResponsiveType } from "@/src/design/useResponsiveType";

export default function LearnerWorldMap() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: engagement, refetch } = useEngagement(user?.id || "");
  const { t } = useTranslation();
  const { sizeClass, width: winWidth, isTablet } = useWindowSizeClass();
  const { isTutorEntitled } = useLearnerEntitlements(user?.tenantId);
  const palette = useSensoryPalette();
  const type = useResponsiveType();

  const coreTutors = Object.entries(TUTORS).filter(([, t]) => t.tier === "core");

  const cols = gridColumns(sizeClass);
  const cardWidthPct = `${Math.floor(100 / cols) - 2}%` as const;
  const hPad = pickBySizeClass(sizeClass, {
    compact: spacing.md,
    medium: spacing.lg,
    expanded: spacing.xl,
  });
  const maxContentWidth = isTablet ? CONTENT_MAX_WIDTH.dashboard : winWidth;
  const contentWidth = Math.min(winWidth - hPad * 2, maxContentWidth);

  const xp = engagement?.xp ?? 0;
  const xpPctOfNextLevel = ((xp % 1000) / 1000) * 100;
  const dailyGoal = 200;
  const dailyXp = Math.min(xp % dailyGoal, dailyGoal);
  const dailyPct = (dailyXp / dailyGoal) * 100;

  const capsuleNavItems = !isTablet
    ? [
        {
          key: "map",
          label: t("tabs.worldMap"),
          icon: "map" as const,
          active: true,
          onPress: () => {},
        },
        {
          key: "stats",
          label: t("tabs.profile"),
          icon: "trophy" as const,
          onPress: () => router.push("/(learner)/gamification" as Href),
        },
        {
          key: "settings",
          label: t("tabs.settings"),
          icon: "settings" as const,
          onPress: () => router.push("/(learner)/settings" as Href),
        },
      ]
    : [];

  return (
    <View style={[styles.container, { backgroundColor: palette.bgPage }]}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: hPad,
          paddingTop: isTablet ? spacing.lg : insets.top + 12,
          paddingBottom: isTablet ? 32 : 128,
          alignItems: "center",
        }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refetch}
            colors={[palette.primary]}
            tintColor={palette.primary}
          />
        }
      >
        <View style={{ width: contentWidth }}>
          {/* Header — chip + sensory toggle */}
          <View style={styles.header}>
            <HeaderUserChip
              name={user?.name || "Learner"}
              subtitle={t("learner.level", { level: engagement?.level || 1 })}
              onPress={() => router.push("/(learner)/gamification" as Href)}
            />
            <SensoryToggle variant="icon" />
          </View>

          {/* Hero card — greeting + daily-goal progress */}
          <Card tone="hero" style={styles.hero}>
            <View style={styles.heroInner}>
              <View style={[styles.companionRing, { backgroundColor: palette.accentSoft }]}>
                <Text style={styles.companionEmoji}>🧠</Text>
              </View>
              <Text
                style={[
                  styles.heroGreeting,
                  {
                    color: palette.ink,
                    // Preserve the 24pt phone baseline; useResponsiveType
                    // amplifies h1 on medium/expanded tablets.
                    fontSize: Math.max(styles.heroGreeting.fontSize, type.h1.fontSize),
                    lineHeight: Math.max(styles.heroGreeting.lineHeight, type.h1.lineHeight),
                  },
                ]}
              >
                {t("learner.greeting", { name: user?.name || "Alex" })}
              </Text>
              <Text style={[styles.heroSub, { color: palette.inkMuted }]}>
                {t("learner.dailyChallengeDesc")}
              </Text>

              <View
                style={[
                  styles.goalRow,
                  { backgroundColor: palette.bgRaised, borderColor: palette.border },
                ]}
              >
                <View style={[styles.goalIcon, { backgroundColor: palette.warmSoft }]}>
                  <Ionicons name="star" size={20} color={palette.warm} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.goalLabelRow}>
                    <Text style={[styles.goalLabel, { color: palette.ink }]}>
                      {t("learner.dailyChallenge")}
                    </Text>
                    <Text style={[styles.goalXp, { color: palette.warm }]}>
                      {dailyXp} / {dailyGoal} XP
                    </Text>
                  </View>
                  <View style={[styles.goalTrack, { backgroundColor: palette.warmSoft }]}>
                    <View
                      style={[
                        styles.goalFill,
                        { width: `${dailyPct}%`, backgroundColor: palette.warm },
                      ]}
                    />
                  </View>
                </View>
              </View>
            </View>
          </Card>

          {/* Stats strip — coins / badges / streak */}
          <View style={styles.statsRow}>
            <StatPill
              label={t("learner.coins")}
              value={engagement?.coins || 0}
              tint={palette.warm}
              tintSoft={palette.warmSoft}
              icon="cash"
            />
            <StatPill
              label={t("learner.badges")}
              value={engagement?.badges?.length || 0}
              tint={palette.accent}
              tintSoft={palette.accentSoft}
              icon="ribbon"
            />
            <StatPill
              label="Streak"
              value={engagement?.streakDays || 0}
              tint={palette.primary}
              tintSoft={INCLUSIVE_WARM_PALETTE.primarySoft}
              icon="flame"
            />
          </View>

          {/* XP progress to next level */}
          <View
            style={[
              styles.xpCard,
              { backgroundColor: palette.bgCard, borderColor: palette.border },
            ]}
          >
            <View style={styles.xpHeader}>
              <Text style={[styles.xpHeaderText, { color: palette.ink }]}>{xp} XP</Text>
              <Text style={[styles.xpHeaderHint, { color: palette.inkMuted }]}>
                Level {engagement?.level || 1}
              </Text>
            </View>
            <View style={[styles.xpTrack, { backgroundColor: palette.border }]}>
              <View
                style={[
                  styles.xpFill,
                  { width: `${xpPctOfNextLevel}%`, backgroundColor: palette.primary },
                ]}
              />
            </View>
          </View>

          {/* Tutor world grid */}
          <Text style={[styles.sectionTitle, { color: palette.ink }]}>
            {t("learner.questWorlds")}
          </Text>
          <View style={styles.worldGrid}>
            {coreTutors.map(([key, tutor]) => {
              const entitled = isTutorEntitled(key);
              return (
                <Pressable
                  key={key}
                  style={({ pressed }) => [
                    styles.worldCard,
                    {
                      width: cardWidthPct,
                      backgroundColor: palette.bgRaised,
                      borderColor: palette.border,
                      opacity: pressed ? 0.92 : entitled ? 1 : 0.55,
                    },
                  ]}
                  onPress={() => router.push(`/(learner)/tutor/${key}` as Href)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    entitled
                      ? `${tutor.name}, ${tutor.domain}`
                      : `${tutor.name}, locked. Ask a parent to unlock.`
                  }
                  accessibilityState={{ disabled: !entitled }}
                >
                  {!entitled && (
                    <View
                      style={[styles.lockBadge, { backgroundColor: palette.ink }]}
                      accessibilityElementsHidden
                    >
                      <Ionicons name="lock-closed" size={11} color="#FFF" />
                    </View>
                  )}
                  <Text style={styles.worldIcon}>{tutor.icon}</Text>
                  <Text style={[styles.worldName, { color: palette.ink }]}>{tutor.name}</Text>
                  <Text style={[styles.worldDomain, { color: palette.inkMuted }]} numberOfLines={1}>
                    {tutor.domain}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Quick actions */}
          <View style={styles.quickActions}>
            <QuickAction
              icon="camera"
              label={t("learner.homework")}
              tint={palette.primary}
              tintSoft={INCLUSIVE_WARM_PALETTE.primarySoft}
              onPress={() => router.push("/(learner)/homework" as Href)}
            />
            <QuickAction
              icon="compass"
              label={t("learner.quests")}
              tint={palette.accent}
              tintSoft={palette.accentSoft}
              onPress={() => router.push("/(learner)/quests" as Href)}
            />
            <QuickAction
              icon="ribbon"
              label={t("learner.badgesLabel")}
              tint={palette.warm}
              tintSoft={palette.warmSoft}
              onPress={() => router.push("/(learner)/badges" as Href)}
            />
            <QuickAction
              icon="bar-chart"
              label={t("learner.grades")}
              tint={palette.primary}
              tintSoft={INCLUSIVE_WARM_PALETTE.primarySoft}
              onPress={() => router.push("/(learner)/gradebook" as Href)}
            />
            <QuickAction
              icon="library"
              label={t("learner.subjects", "Subjects")}
              tint={palette.accent}
              tintSoft={palette.accentSoft}
              onPress={() => router.push("/(learner)/subjects" as Href)}
            />
            <QuickAction
              icon="trending-up"
              label={t("learner.progress", "Progress")}
              tint={palette.warm}
              tintSoft={palette.warmSoft}
              onPress={() => router.push("/(learner)/progress" as Href)}
            />
            <QuickAction
              icon="flag"
              label={t("learner.missions", "Missions")}
              tint={palette.accent}
              tintSoft={palette.accentSoft}
              onPress={() => router.push("/(learner)/missions" as Href)}
            />
            <QuickAction
              icon="library"
              label={t("learner.library", "Library")}
              tint={palette.primary}
              tintSoft={INCLUSIVE_WARM_PALETTE.primarySoft}
              onPress={() => router.push("/(learner)/library" as Href)}
            />
          </View>
        </View>
      </ScrollView>

      {!isTablet ? <DarkCapsuleNav items={capsuleNavItems} /> : null}
    </View>
  );
}

// ── Small composite primitives used only on this screen ───────────────────

function StatPill({
  label,
  value,
  tint,
  tintSoft,
  icon,
}: {
  label: string;
  value: number | string;
  tint: string;
  tintSoft: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const palette = useSensoryPalette();
  return (
    <View
      style={[styles.statPill, { backgroundColor: palette.bgRaised, borderColor: palette.border }]}
    >
      <View style={[styles.statIcon, { backgroundColor: tintSoft }]}>
        <Ionicons name={icon} size={16} color={tint} />
      </View>
      <View>
        <Text style={[styles.statValue, { color: palette.ink }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: palette.inkMuted }]}>{label}</Text>
      </View>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  tint,
  tintSoft,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint: string;
  tintSoft: string;
  onPress: () => void;
}) {
  const palette = useSensoryPalette();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.quickBtn,
        {
          backgroundColor: palette.bgRaised,
          borderColor: palette.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.quickIcon, { backgroundColor: tintSoft }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <Text style={[styles.quickLabel, { color: palette.ink }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  hero: { marginBottom: spacing.lg },
  heroInner: { alignItems: "center" },
  companionRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  companionEmoji: { fontSize: 56 },
  heroGreeting: {
    ...typography.heroDisplay,
    fontFamily: fontFamilies.displayBold,
    fontSize: 24,
    lineHeight: 28,
    textAlign: "center",
    marginBottom: 6,
  },
  heroSub: {
    ...typography.bodyMd,
    textAlign: "center",
    maxWidth: 260,
    marginBottom: spacing.md,
  },
  goalRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: 12,
    marginTop: spacing.sm,
  },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  goalLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  goalLabel: { fontFamily: fontFamilies.bodyBold, fontSize: 12 },
  goalXp: { fontFamily: fontFamilies.bodyBold, fontSize: 12 },
  goalTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  goalFill: { height: 8, borderRadius: 4 },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
  statPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { fontFamily: fontFamilies.displayBold, fontSize: 16 },
  statLabel: { fontFamily: fontFamilies.bodySemiBold, fontSize: 11 },
  xpCard: {
    padding: 14,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  xpHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  xpHeaderText: { fontFamily: fontFamilies.bodyBold, fontSize: 13 },
  xpHeaderHint: { fontFamily: fontFamilies.bodySemiBold, fontSize: 12 },
  xpTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  xpFill: { height: 8, borderRadius: 4 },
  sectionTitle: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 20,
    marginBottom: spacing.md,
  },
  worldGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: spacing.lg,
  },
  worldCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
    alignItems: "center",
  },
  worldIcon: { fontSize: 32, marginBottom: 6 },
  worldName: { fontFamily: fontFamilies.bodyBold, fontSize: 13 },
  worldDomain: {
    fontFamily: fontFamilies.bodyRegular,
    fontSize: 11,
    textAlign: "center",
  },
  lockBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  quickActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickBtn: {
    flexGrow: 1,
    flexBasis: "30%",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { fontFamily: fontFamilies.bodySemiBold, fontSize: 11 },
});
