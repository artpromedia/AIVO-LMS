import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useEngagement } from "@/hooks/useEngagement";
import { useLearnerEntitlements } from "@/hooks/useLearnerEntitlements";
import { TUTORS } from "@aivo/brand";
import { StatCard } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";
import { useWindowSizeClass } from "@/src/design/useWindowSizeClass";
import { CONTENT_MAX_WIDTH, gridColumns, pickBySizeClass } from "@/src/design/responsive";
import { TabletScaffold } from "@/src/components/layout/TabletScaffold";

export default function LearnerWorldMap() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: engagement, refetch } = useEngagement(user?.id || "");
  const { t } = useTranslation();
  const { sizeClass, width: winWidth, isTablet } = useWindowSizeClass();
  const { isTutorEntitled } = useLearnerEntitlements(user?.tenantId);

  const coreTutors = Object.entries(TUTORS).filter(([, t]) => t.tier === "core");

  const railDestinations = [
    {
      key: "worldMap",
      label: t("tabs.worldMap"),
      icon: "map" as const,
      active: true,
      onPress: () => router.push("/(learner)" as any),
    },
    {
      key: "brain",
      label: t("tabs.brain"),
      icon: "bulb" as const,
      onPress: () => router.push("/(learner)/brain" as any),
    },
    {
      key: "homework",
      label: t("learner.homework"),
      icon: "camera" as const,
      onPress: () => router.push("/(learner)/homework" as any),
    },
    {
      key: "quests",
      label: t("learner.quests"),
      icon: "compass" as const,
      onPress: () => router.push("/(learner)/quests" as any),
    },
    {
      key: "gradebook",
      label: t("learner.grades"),
      icon: "bar-chart" as const,
      onPress: () => router.push("/(learner)/gradebook" as any),
    },
    {
      key: "shop",
      label: t("tabs.shop"),
      icon: "cart" as const,
      onPress: () => router.push("/(learner)/shop" as any),
    },
    {
      key: "gamification",
      label: t("tabs.profile"),
      icon: "trophy" as const,
      onPress: () => router.push("/(learner)/gamification" as any),
    },
    {
      key: "settings",
      label: t("tabs.settings"),
      icon: "settings-outline" as const,
      onPress: () => router.push("/(learner)/settings" as any),
    },
  ];

  // Scale the world-grid column count with the size class so it stops
  // looking under-designed on tablet hardware.
  const cols = gridColumns(sizeClass);
  const cardWidthPct = `${Math.floor(100 / cols) - 2}%` as const;
  const hPad = pickBySizeClass(sizeClass, {
    compact: spacing.md,
    medium: spacing.lg,
    expanded: spacing.xl,
  });
  const maxContentWidth = isTablet ? CONTENT_MAX_WIDTH.dashboard : winWidth;
  const contentWidth = Math.min(winWidth - hPad * 2, maxContentWidth);

  const body = (
    <ScrollView
      style={[styles.container, { paddingHorizontal: hPad }]}
      contentContainerStyle={{
        paddingTop: isTablet ? spacing.lg : insets.top + 16,
        paddingBottom: 32,
        alignItems: "center",
      }}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={refetch} colors={[colors.primary]} />
      }
    >
      <View style={{ width: contentWidth }}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>🎮</Text>
            </View>
            <View>
              <Text style={styles.greeting}>
                {t("learner.greeting", { name: user?.name || "Learner" })}
              </Text>
              <Text style={styles.level}>
                {t("learner.level", { level: engagement?.level || 1 })}
              </Text>
            </View>
          </View>
          <View style={styles.streakBadge}>
            <Text style={styles.streakIcon}>🔥</Text>
            <Text style={styles.streakNum}>{engagement?.streakDays || 0}</Text>
          </View>
        </View>

        <View style={styles.xpBar}>
          <View style={[styles.xpFill, { width: `${((engagement?.xp || 0) % 1000) / 10}%` }]} />
        </View>
        <Text style={styles.xpText}>{engagement?.xp || 0} XP</Text>

        <View style={styles.statsRow}>
          <StatCard
            label={t("learner.coins")}
            value={engagement?.coins || 0}
            icon={<Text style={{ fontSize: 18 }}>🪙</Text>}
            color={colors.accent}
          />
          <View style={{ width: 8 }} />
          <StatCard
            label={t("learner.badges")}
            value={engagement?.badges?.length || 0}
            icon={<Text style={{ fontSize: 18 }}>🏆</Text>}
            color={colors.secondary}
          />
          <View style={{ width: 8 }} />
          <StatCard
            label={t("learner.gems")}
            value={engagement?.gems || 0}
            icon={<Text style={{ fontSize: 18 }}>💎</Text>}
            color={colors.info}
          />
        </View>

        <Pressable
          style={styles.dailyChallenge}
          onPress={() => router.push("/(learner)/challenges")}
        >
          <Ionicons name="flash" size={24} color={colors.accent} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.challengeTitle}>{t("learner.dailyChallenge")}</Text>
            <Text style={styles.challengeDesc}>{t("learner.dailyChallengeDesc")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>

        <Text style={styles.sectionTitle}>{t("learner.questWorlds")}</Text>
        <View style={styles.worldGrid}>
          {coreTutors.map(([key, tutor]) => {
            const entitled = isTutorEntitled(key);
            return (
              <Pressable
                key={key}
                style={[
                  styles.worldCard,
                  { width: cardWidthPct, borderColor: tutor.color },
                  !entitled && styles.worldCardLocked,
                ]}
                onPress={() => router.push(`/(learner)/tutor/${key}` as any)}
                accessibilityRole="button"
                accessibilityLabel={
                  entitled
                    ? `${tutor.name}, ${tutor.domain}`
                    : `${tutor.name}, locked. Ask a parent to unlock.`
                }
                accessibilityState={{ disabled: !entitled }}
              >
                {!entitled && (
                  <View style={styles.lockBadge} accessibilityElementsHidden>
                    <Ionicons name="lock-closed" size={12} color="#FFF" />
                  </View>
                )}
                <Text style={[styles.worldIcon, !entitled && styles.worldIconLocked]}>
                  {tutor.icon}
                </Text>
                <Text style={styles.worldName}>{tutor.name}</Text>
                <Text style={styles.worldDomain} numberOfLines={1}>
                  {tutor.domain}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.quickActions}>
          <Pressable style={styles.quickBtn} onPress={() => router.push("/(learner)/homework")}>
            <Ionicons name="camera" size={24} color={colors.primary} />
            <Text style={styles.quickLabel}>{t("learner.homework")}</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => router.push("/(learner)/quests")}>
            <Ionicons name="compass" size={24} color={colors.secondary} />
            <Text style={styles.quickLabel}>{t("learner.quests")}</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => router.push("/(learner)/badges")}>
            <Ionicons name="ribbon" size={24} color={colors.accent} />
            <Text style={styles.quickLabel}>{t("learner.badgesLabel")}</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => router.push("/(learner)/gradebook")}>
            <Ionicons name="bar-chart" size={24} color={colors.success} />
            <Text style={styles.quickLabel}>{t("learner.grades")}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );

  return <TabletScaffold destinations={railDestinations}>{body}</TabletScaffold>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  avatarContainer: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 24 },
  greeting: { fontSize: 20, fontFamily: "Nunito-ExtraBold", color: colors.text },
  level: { fontSize: 13, fontFamily: "Nunito-SemiBold", color: colors.primary },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accent + "20",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    gap: 4,
  },
  streakIcon: { fontSize: 16 },
  streakNum: { fontSize: 16, fontFamily: "Nunito-ExtraBold", color: colors.accent },
  xpBar: {
    height: 10,
    backgroundColor: colors.border,
    borderRadius: 5,
    overflow: "hidden",
    marginBottom: 4,
  },
  xpFill: { height: 10, backgroundColor: colors.primary, borderRadius: 5 },
  xpText: {
    fontSize: 12,
    fontFamily: "Nunito-SemiBold",
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  statsRow: { flexDirection: "row", marginBottom: spacing.lg },
  dailyChallenge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accent + "10",
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent + "30",
  },
  challengeTitle: { fontSize: 15, fontFamily: "Nunito-Bold", color: colors.text },
  challengeDesc: { fontSize: 13, fontFamily: "Nunito-Regular", color: colors.textSecondary },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Nunito-Bold",
    color: colors.text,
    marginBottom: spacing.md,
  },
  worldGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: spacing.lg },
  worldCard: {
    // width is supplied at runtime by the size-class-aware grid logic
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.sm,
    alignItems: "center",
    borderWidth: 2,
    ...{
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
  },
  worldIcon: { fontSize: 28, marginBottom: 4 },
  worldIconLocked: { opacity: 0.4 },
  worldCardLocked: { opacity: 0.55 },
  lockBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  worldName: { fontSize: 13, fontFamily: "Nunito-Bold", color: colors.text },
  worldDomain: {
    fontSize: 10,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    textAlign: "center",
  },
  quickActions: { flexDirection: "row", gap: 8 },
  quickBtn: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    alignItems: "center",
    gap: 6,
    ...{
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
  },
  quickLabel: { fontSize: 12, fontFamily: "Nunito-SemiBold", color: colors.textSecondary },
});
