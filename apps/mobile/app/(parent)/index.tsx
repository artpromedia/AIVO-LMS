import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { router, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useLearners } from "@/hooks/useLearners";
import { useParentInbox } from "@/hooks/useParentInbox";
import { useParentSummary } from "@/hooks/useParentSummary";
import { useLearnerMastery } from "@/hooks/useLearnerMastery";
import { EmptyState, Sparkline, BarMini } from "@aivo/mobile-ui";
import { spacing, radius } from "@/constants/colors";
import { INCLUSIVE_WARM_PALETTE } from "@aivo/brand";
import { fontFamilies } from "@/constants/typography";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { Card, Button, SensoryToggle } from "@/components/ui";
import { useWindowSizeClass } from "@/src/design/useWindowSizeClass";
import { CONTENT_MAX_WIDTH, pickBySizeClass } from "@/src/design/responsive";
import { useResponsiveType } from "@/src/design/useResponsiveType";

export default function ParentDashboard() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { data: learners, refetch } = useLearners();
  const { data: inbox } = useParentInbox(user?.id ?? "");
  const { data: summary, refetch: refetchSummary } = useParentSummary(user?.id ?? "");
  const unreadCount = inbox?.unreadCount ?? 0;
  const [refreshing, setRefreshing] = React.useState(false);
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { sizeClass, isTablet, width: winWidth } = useWindowSizeClass();
  const type = useResponsiveType();
  const hPad = pickBySizeClass(sizeClass, {
    compact: spacing.md,
    medium: spacing.lg,
    expanded: spacing.xl,
  });
  const contentWidth = Math.min(
    winWidth - hPad * 2,
    isTablet ? CONTENT_MAX_WIDTH.dashboard : winWidth,
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchSummary()]);
    setRefreshing(false);
  };

  // Derive stat values from real summary data, falling back to 0 while loading
  const activeTutors = summary?.activeTutors ?? 0;
  const sessionsThisWeek = summary?.sessionsThisWeek ?? 0;
  const activeTutorsTrend = summary?.activeTutorsTrend ?? [];
  const sessionsThisWeekTrend = summary?.sessionsThisWeekTrend ?? [];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.bgPage }]}
      contentContainerStyle={{
        paddingHorizontal: hPad,
        paddingTop: isTablet ? spacing.lg : insets.top + 12,
        paddingBottom: 32,
        alignItems: "center",
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[palette.primary]}
          tintColor={palette.primary}
        />
      }
    >
      <View style={{ width: contentWidth }}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.greeting,
                { color: palette.ink, fontSize: type.h1.fontSize, lineHeight: type.h1.lineHeight },
              ]}
            >
              {t("parent.greeting", { name: user?.name || "Parent" })}
            </Text>
            <Text style={[styles.subGreeting, { color: palette.inkMuted }]}>
              {t("parent.learningOverview")}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <SensoryToggle variant="icon" />
            <Pressable
              onPress={() => router.push("/(parent)/inbox" as Href)}
              style={[
                styles.iconBtn,
                { backgroundColor: palette.bgRaised, borderColor: palette.border },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("parentInbox.title")}
            >
              <Ionicons name="mail-outline" size={20} color={palette.inkMuted} />
              {unreadCount > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadCount > 9 ? "9+" : String(unreadCount)}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              onPress={logout}
              style={[
                styles.iconBtn,
                { backgroundColor: palette.bgRaised, borderColor: palette.border },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("common.logout") || "Log out"}
            >
              <Ionicons name="log-out-outline" size={20} color={palette.inkMuted} />
            </Pressable>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatTile
            label={t("parent.children")}
            value={learners?.length || 0}
            icon="people"
            tint={palette.primary}
            tintSoft={INCLUSIVE_WARM_PALETTE.primarySoft}
          />
          <StatTile
            label={t("parent.activeTutors")}
            value={activeTutors}
            icon="school"
            tint={palette.accent}
            tintSoft={palette.accentSoft}
            trend={activeTutorsTrend}
            trendLabel={t("parent.activeTutorsTrend")}
          />
          <StatTile
            label={t("parent.sessions")}
            value={sessionsThisWeek}
            icon="book"
            tint={palette.warm}
            tintSoft={palette.warmSoft}
            trend={sessionsThisWeekTrend}
            trendLabel={t("parent.sessionsTrend")}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Pressable
            onPress={() => router.push("/(parent)/learners" as Href)}
            accessibilityRole="button"
            accessibilityLabel={t("parent.yourChildren")}
          >
            <Text style={[styles.sectionTitle, { color: palette.ink }]}>
              {t("parent.yourChildren")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(parent)/onboard")}
            accessibilityRole="button"
            accessibilityLabel={t("parent.addChild")}
          >
            <View style={[styles.addChildBtn, { backgroundColor: palette.primary }]}>
              <Ionicons name="add" size={22} color={palette.primaryFg} />
            </View>
          </Pressable>
        </View>

        {!learners || learners.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="people-outline" size={48} color={palette.inkMuted} />}
            title={t("parent.noChildrenTitle")}
            message={t("parent.noChildrenMessage")}
            actionLabel={t("parent.addChild")}
            onAction={() => router.push("/(parent)/onboard")}
          />
        ) : (
          learners.map((learner) => (
            <Pressable
              key={learner.id}
              onPress={() => router.push(`/(parent)/learners/${learner.id}` as Href)}
              accessibilityRole="button"
              accessibilityLabel={`${learner.firstName} ${learner.lastName}`}
            >
              <Card tone="raised" style={styles.childCard}>
                <View style={styles.childRow}>
                  <View style={[styles.childAvatar, { backgroundColor: palette.accentSoft }]}>
                    <Text style={[styles.childInitial, { color: palette.accent }]}>
                      {learner.firstName[0]}
                    </Text>
                  </View>
                  <View style={styles.childInfo}>
                    <Text style={[styles.childName, { color: palette.ink }]}>
                      {learner.firstName} {learner.lastName}
                    </Text>
                    <Text style={[styles.childGrade, { color: palette.inkMuted }]}>
                      {t("common.grade", { grade: learner.gradeLevel })}
                    </Text>
                    <View style={[styles.levelBadge, { backgroundColor: palette.accentSoft }]}>
                      <Text style={[styles.levelText, { color: palette.accent }]}>
                        {learner.functioningLevel}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={palette.inkMuted} />
                </View>
                <ChildMasteryBar learnerId={learner.id} tint={palette.accent} />
                <View style={[styles.childActions, { borderTopColor: palette.border }]}>
                  <ChildAction
                    icon="bulb-outline"
                    label={t("parent.brain")}
                    tint={palette.primary}
                    onPress={() => router.push(`/(parent)/brain/${learner.id}` as Href)}
                  />
                  <ChildAction
                    icon="trending-up-outline"
                    label={t("parent.progress")}
                    tint={"#16a34a"}
                    onPress={() => router.push(`/(parent)/progress/${learner.id}` as Href)}
                  />
                  <ChildAction
                    icon="document-outline"
                    label={t("parent.iep")}
                    tint={palette.primary}
                    onPress={() => router.push(`/(parent)/iep/${learner.id}` as Href)}
                  />
                  <ChildAction
                    icon="people-outline"
                    label={t("parent.team")}
                    tint={palette.accent}
                    onPress={() => router.push(`/(parent)/team/${learner.id}` as Href)}
                  />
                  <ChildAction
                    icon="trophy-outline"
                    label={t("parentMilestones.open")}
                    tint={palette.warm}
                    onPress={() => router.push(`/(parent)/milestones/${learner.id}` as Href)}
                  />
                </View>
              </Card>
            </Pressable>
          ))
        )}

        {learners && learners.length > 0 ? (
          <Button
            title={t("parent.loginAsLearner", "Login as learner")}
            onPress={() => router.push("/(auth)/learner-login" as Href)}
            fullWidth
            iconLeft={<Ionicons name="swap-horizontal" size={18} color={palette.primaryFg} />}
            style={{ marginBottom: spacing.md }}
          />
        ) : null}

        <View style={styles.quickActions}>
          <View style={{ flex: 1 }}>
            <Button
              title={t("parent.tutorStore")}
              onPress={() => router.push("/(parent)/tutors")}
              variant="outline"
              fullWidth
              iconLeft={<Ionicons name="storefront-outline" size={18} color={palette.primary} />}
            />
          </View>
          <View style={{ width: 8 }} />
          <View style={{ flex: 1 }}>
            <Button
              title={t("parent.reports", "Reports")}
              onPress={() => router.push("/(parent)/reports" as Href)}
              variant="outline"
              fullWidth
              iconLeft={<Ionicons name="bar-chart-outline" size={18} color={palette.primary} />}
            />
          </View>
          <View style={{ width: 8 }} />
          <View style={{ flex: 1 }}>
            <Button
              title={t("parent.billing")}
              onPress={() => router.push("/(parent)/billing")}
              variant="outline"
              fullWidth
              iconLeft={<Ionicons name="card-outline" size={18} color={palette.primary} />}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function StatTile({
  label,
  value,
  icon,
  tint,
  tintSoft,
  trend,
  trendLabel,
}: {
  label: string;
  value: number | string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  tintSoft: string;
  /** Optional 7-day history for sparkline. Hidden when empty. */
  trend?: number[];
  /** Accessible label for the sparkline. */
  trendLabel?: string;
}) {
  const palette = useSensoryPalette();
  return (
    <View
      style={[
        styles.statTile,
        {
          backgroundColor: palette.bgRaised,
          borderColor: palette.border,
        },
      ]}
    >
      <View style={[styles.statTileIcon, { backgroundColor: tintSoft }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text style={[styles.statTileValue, { color: palette.ink }]}>{value}</Text>
      <Text style={[styles.statTileLabel, { color: palette.inkMuted }]} numberOfLines={1}>
        {label}
      </Text>
      {trend && trend.length > 0 ? (
        <Sparkline
          series={trend}
          tone={tint}
          height={24}
          label={trendLabel ?? label}
          style={{ marginTop: 4 }}
        />
      ) : null}
    </View>
  );
}

function ChildAction({
  icon,
  label,
  tint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint: string;
  onPress: () => void;
}) {
  const palette = useSensoryPalette();
  return (
    <Pressable onPress={onPress} style={styles.actionBtn} accessibilityRole="button">
      <Ionicons name={icon} size={18} color={tint} />
      <Text style={[styles.actionText, { color: palette.inkMuted }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Renders a compact BarMini of per-subject mastery inside a child card.
 * Hidden while loading or when no brain data is available.
 */
function ChildMasteryBar({ learnerId, tint }: { learnerId: string; tint: string }) {
  const { t } = useTranslation();
  const { subjects, isLoading } = useLearnerMastery(learnerId, 4);
  if (isLoading || subjects.length === 0) return null;
  return (
    <View style={styles.childMastery}>
      <BarMini
        subjects={subjects.map((s) => ({ name: s.name, value: s.value, tone: tint }))}
        label={t("parent.masteryBySubject")}
        barHeight={5}
        style={{ marginTop: 2 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
    gap: 8,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  greeting: { fontSize: 24, fontFamily: fontFamilies.displayBold },
  subGreeting: {
    fontSize: 14,
    fontFamily: fontFamilies.bodyRegular,
    marginTop: 2,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "#dc2626",
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: fontFamilies.bodyBold,
    lineHeight: 12,
  },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: spacing.lg },
  statTile: {
    flex: 1,
    padding: 14,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: 6,
  },
  statTileIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  statTileValue: { fontFamily: fontFamilies.displayBold, fontSize: 20 },
  statTileLabel: { fontFamily: fontFamilies.bodySemiBold, fontSize: 11 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 18, fontFamily: fontFamilies.displayBold },
  addChildBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  childCard: { marginBottom: spacing.md },
  childRow: { flexDirection: "row", alignItems: "center" },
  childMastery: { paddingTop: spacing.sm, paddingBottom: 2 },
  childAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  childInitial: { fontSize: 20, fontFamily: fontFamilies.displayBold },
  childInfo: { flex: 1, marginLeft: 12 },
  childName: { fontSize: 16, fontFamily: fontFamilies.bodyBold },
  childGrade: { fontSize: 13, fontFamily: fontFamilies.bodyRegular },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  levelText: { fontSize: 11, fontFamily: fontFamilies.bodyBold },
  childActions: {
    flexDirection: "row",
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    justifyContent: "space-around",
  },
  actionBtn: { alignItems: "center", gap: 4 },
  actionText: { fontSize: 11, fontFamily: fontFamilies.bodySemiBold },
  quickActions: { flexDirection: "row", marginTop: spacing.md },
});
