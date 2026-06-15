import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useEngagement } from "@/hooks/useEngagement";
import { useShopItems, useInventory } from "@/hooks/useAvatar";
import { AivoCard, StatCard, AivoButton } from "@aivo/mobile-ui";
import { AvatarPreview } from "@/src/components/learner/AvatarPreview";
import { colors, spacing, radius } from "@/constants/colors";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";

export default function GamificationScreen() {
  const { user, logout } = useAuth();
  const learnerId = user?.id || "";
  const { data: engagement } = useEngagement(learnerId);
  const { data: avatarItems } = useShopItems();
  const { data: inventory } = useInventory(learnerId);
  const { t } = useTranslation();

  return (
    <ResponsiveScreen maxWidth="reading" background={colors.background}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("learnerGamification.title")}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <Pressable
            onPress={() => router.push("/(learner)/settings" as any)}
            accessibilityRole="button"
            accessibilityLabel={t("learnerSettings.title")}
            hitSlop={8}
          >
            <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            onPress={logout}
            accessibilityRole="button"
            accessibilityLabel={t("common.logOut")}
            hitSlop={8}
          >
            <Ionicons name="log-out-outline" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <AivoCard style={styles.profileCard}>
        <AvatarPreview
          items={avatarItems}
          inventory={inventory}
          variant="compact"
          size={80}
        />
        <View style={{ height: 8 }} />
        <Text style={styles.userName}>{user?.name}</Text>
        <Text style={styles.userLevel}>
          {t("learner.level", { level: engagement?.level || 1 })}
        </Text>
        <View style={styles.xpBar}>
          <View style={[styles.xpFill, { width: `${((engagement?.xp || 0) % 1000) / 10}%` }]} />
        </View>
        <Text style={styles.xpText}>{engagement?.xp || 0} XP</Text>
      </AivoCard>

      <View style={styles.statsRow}>
        <StatCard
          label={t("learnerGamification.streak")}
          value={`${engagement?.streakDays || 0}🔥`}
          color={colors.accent}
        />
        <View style={{ width: 8 }} />
        <StatCard
          label={t("learner.badges")}
          value={engagement?.badges?.length || 0}
          color={colors.secondary}
        />
        <View style={{ width: 8 }} />
        <StatCard label={t("learner.coins")} value={engagement?.coins || 0} color={colors.accent} />
      </View>

      <Text style={styles.sectionTitle}>{t("learnerGamification.activeChallenges")}</Text>
      {engagement?.activeChallenges?.map((c) => (
        <AivoCard key={c.id} style={styles.challengeCard}>
          <View style={styles.challengeRow}>
            <Ionicons
              name={c.type === "daily" ? "today" : c.type === "weekly" ? "calendar" : "people"}
              size={24}
              color={colors.primary}
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.challengeName}>{c.title}</Text>
              <Text style={styles.challengeDesc}>{c.description}</Text>
              <View style={styles.challengeProgress}>
                <View
                  style={[styles.challengeFill, { width: `${(c.progress / c.target) * 100}%` }]}
                />
              </View>
              <Text style={styles.challengeCount}>
                {c.progress}/{c.target}
              </Text>
            </View>
            <View style={styles.rewardBadge}>
              <Text style={styles.rewardText}>+{c.reward.xp} XP</Text>
            </View>
          </View>
        </AivoCard>
      )) || (
        <AivoCard>
          <Text style={styles.noData}>{t("learnerGamification.noChallenges")}</Text>
        </AivoCard>
      )}

      <View style={styles.quickLinks}>
        <AivoButton
          title={t("learner.badges")}
          onPress={() => router.push("/(learner)/badges")}
          variant="outline"
          icon={<Ionicons name="ribbon-outline" size={18} color={colors.primary} />}
          style={{ flex: 1, marginRight: 8 }}
        />
        <AivoButton
          title={t("learnerGamification.gradebook")}
          onPress={() => router.push("/(learner)/gradebook")}
          variant="outline"
          icon={<Ionicons name="bar-chart-outline" size={18} color={colors.primary} />}
          style={{ flex: 1 }}
        />
      </View>
      <View style={[styles.quickLinks, { marginTop: 8 }]}>
        <AivoButton
          title={t("learnerLeaderboard.title")}
          onPress={() => router.push("/(learner)/leaderboard" as any)}
          variant="outline"
          icon={<Ionicons name="trophy-outline" size={18} color={colors.primary} />}
          style={{ flex: 1 }}
        />
      </View>
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  title: { fontSize: 24, fontFamily: "Nunito-ExtraBold", color: colors.text },
  profileCard: {
    alignItems: "center" as const,
    marginBottom: spacing.lg,
    paddingVertical: spacing.lg,
  },
  userName: { fontSize: 22, fontFamily: "Nunito-ExtraBold", color: colors.text },
  userLevel: {
    fontSize: 14,
    fontFamily: "Nunito-SemiBold",
    color: colors.primary,
    marginBottom: 12,
  },
  xpBar: {
    width: "80%",
    height: 10,
    backgroundColor: colors.border,
    borderRadius: 5,
    overflow: "hidden",
  },
  xpFill: { height: 10, backgroundColor: colors.primary, borderRadius: 5 },
  xpText: {
    fontSize: 12,
    fontFamily: "Nunito-SemiBold",
    color: colors.textSecondary,
    marginTop: 4,
  },
  statsRow: { flexDirection: "row", marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Nunito-Bold",
    color: colors.text,
    marginBottom: spacing.md,
  },
  challengeCard: { marginBottom: spacing.sm },
  challengeRow: { flexDirection: "row", alignItems: "flex-start" },
  challengeName: { fontSize: 15, fontFamily: "Nunito-Bold", color: colors.text },
  challengeDesc: {
    fontSize: 12,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: 2,
  },
  challengeProgress: { height: 6, backgroundColor: colors.border, borderRadius: 3, marginTop: 8 },
  challengeFill: { height: 6, backgroundColor: colors.primary, borderRadius: 3 },
  challengeCount: {
    fontSize: 11,
    fontFamily: "Nunito-SemiBold",
    color: colors.textSecondary,
    marginTop: 2,
  },
  rewardBadge: {
    backgroundColor: colors.primary + "15",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  rewardText: { fontSize: 11, fontFamily: "Nunito-Bold", color: colors.primary },
  noData: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    textAlign: "center",
    padding: spacing.md,
  },
  quickLinks: { flexDirection: "row", marginTop: spacing.md },
});
