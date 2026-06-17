import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ProgressRing,
  classifySteadySignalStage,
  createSteadySignalTheme,
  steadySignalDashboardLayout,
  type SteadySignalStageLayout,
} from "@aivo/mobile-ui";

const theme = createSteadySignalTheme({
  appearance: "light",
  sensory: "standard",
  age: "middle",
  communication: "supported-text",
  role: "care",
});

const C = theme.colors;
const surfaceRadius = Number.parseInt(theme.foundation.shape.region, 10);
const controlRadius = Number.parseInt(theme.foundation.shape.control, 10);
const shadow: ViewStyle = {
  shadowColor: C.ink,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 18,
  elevation: 3,
};

const snapshot = [
  {
    icon: "book-outline",
    value: "3",
    label: "Today's lessons",
    detail: "remaining today",
  },
  {
    icon: "time-outline",
    value: "24m",
    label: "Time on task",
    detail: "this session",
  },
  {
    icon: "sparkles-outline",
    value: "2",
    label: "Skills mastered",
    detail: "new this week",
  },
  {
    icon: "calendar-outline",
    value: "3:00 PM",
    label: "Next session",
    detail: "today",
  },
] satisfies {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  detail: string;
}[];

const tabs = [
  { icon: "home-outline", activeIcon: "home", label: "Home" },
  { icon: "bar-chart-outline", activeIcon: "bar-chart", label: "Progress", hasNotice: true },
  { icon: "play-circle-outline", activeIcon: "play-circle", label: "Sessions" },
  { icon: "chatbox-outline", activeIcon: "chatbox", label: "Messages" },
  { icon: "settings-outline", activeIcon: "settings", label: "Settings" },
] satisfies {
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  label: string;
  hasNotice?: boolean;
}[];

export default function SteadySignalDemoScreen() {
  const { width, height } = useWindowDimensions();
  const layout = classifySteadySignalStage(width, height);
  const dashboard = steadySignalDashboardLayout(layout);
  const contentWidth = Math.min(width - dashboard.pagePadding * 2, dashboard.contentMaxWidth);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: dashboard.pagePadding,
            alignItems: "center",
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, { width: contentWidth }]}>
          <DashboardHeader layout={layout} />
          <Greeting />
          <LearnerSummary layout={layout} heroDirection={dashboard.heroDirection} />

          <Text style={styles.sectionLabel}>Today&apos;s snapshot</Text>
          <View style={styles.snapshotGrid}>
            {snapshot.map((item) => (
              <SnapshotCard
                key={item.label}
                item={item}
                columns={dashboard.statsColumns}
                layout={layout}
              />
            ))}
          </View>

          <InsightBanner />
        </View>
      </ScrollView>
      <BottomNavigation />
    </SafeAreaView>
  );
}

function DashboardHeader({ layout }: { layout: SteadySignalStageLayout }) {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <Text style={styles.wordmark}>AIVO</Text>
        <Text style={styles.roleLabel}>FAMILY</Text>
      </View>
      <View style={styles.headerActions}>
        <Text style={styles.layoutLabel}>{layoutLabel(layout)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Ionicons name="notifications-outline" size={20} color={C.inkMuted} />
          <View style={styles.notificationDot} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Sarah's profile"
          style={({ pressed }) => [styles.profileButton, pressed && styles.pressed]}
        >
          <Text style={styles.profileButtonText}>SH</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Greeting() {
  return (
    <View style={styles.greeting}>
      <Text style={styles.greetingTitle}>Good morning, Sarah</Text>
      <Text style={styles.greetingBody}>
        Liam had a <Text style={styles.greetingAccent}>great session</Text> yesterday.
      </Text>
    </View>
  );
}

function LearnerSummary({
  layout,
  heroDirection,
}: {
  layout: SteadySignalStageLayout;
  heroDirection: "column" | "row";
}) {
  const phone = layout === "phone";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open Liam's learner profile"
      style={({ pressed }) => [
        styles.learnerCard,
        heroDirection === "row" && styles.learnerCardRow,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.learnerIdentity, !phone && styles.learnerIdentityTablet]}>
        <View style={styles.avatar}>
          <View style={styles.avatarInner}>
            <Text style={styles.avatarInitial}>L</Text>
          </View>
          <View style={styles.avatarStatus}>
            <Ionicons name="sparkles" size={14} color={C.beacon} />
          </View>
        </View>
        <View style={styles.learnerCopy}>
          <Text style={styles.learnerName}>Liam, age 7</Text>
          <View style={styles.streak}>
            <Ionicons name="star" size={16} color={C.beacon} />
            <Text style={styles.streakText}>7 day streak</Text>
          </View>
        </View>
      </View>

      <View style={[styles.goalRegion, !phone && styles.goalRegionTablet]}>
        <View style={styles.goalRing}>
          <ProgressRing
            value={0.75}
            size={phone ? 66 : 82}
            strokeFraction={0.1}
            tone={C.signal}
            trackColor={C.line}
            label="75%"
            ariaLabel="Weekly goal is 75 percent complete"
          />
        </View>
        <View style={styles.goalCopy}>
          <Text style={styles.goalTitle}>Weekly goal on track</Text>
          <Text style={styles.goalBody}>3 of 4 sessions completed</Text>
          <View style={styles.weekdays} accessibilityLabel="Sessions Monday through Sunday">
            {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
              <View
                key={`${day}-${index}`}
                style={[
                  styles.day,
                  index < 3 && styles.dayComplete,
                  index === 3 && styles.dayCurrent,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    index < 3 && styles.dayTextComplete,
                    index === 3 && styles.dayTextCurrent,
                  ]}
                >
                  {day}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function SnapshotCard({
  item,
  columns,
  layout,
}: {
  item: (typeof snapshot)[number];
  columns: 2 | 4;
  layout: SteadySignalStageLayout;
}) {
  const basis = columns === 4 ? "23%" : "47%";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.value}, ${item.label}, ${item.detail}`}
      style={({ pressed }) => [
        styles.snapshotCard,
        { flexBasis: basis },
        layout !== "phone" && styles.snapshotCardTablet,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.snapshotIcon}>
        <Ionicons name={item.icon} size={20} color={C.signal} />
      </View>
      <Text
        style={[styles.snapshotValue, item.value.length > 5 && styles.snapshotValueCompact]}
        numberOfLines={1}
      >
        {item.value}
      </Text>
      <Text style={styles.snapshotLabel}>{item.label}</Text>
      <Text style={styles.snapshotDetail}>{item.detail}</Text>
    </Pressable>
  );
}

function InsightBanner() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open insight: Liam's reading fluency improved 18 percent"
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <LinearGradient
        colors={[C.signal, C.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.insight}
      >
        <View style={styles.insightIcon}>
          <Ionicons name="trending-up" size={24} color={C.signalOn} />
        </View>
        <View style={styles.insightCopy}>
          <Text style={styles.insightTitle}>Liam&apos;s reading fluency improved 18%</Text>
          <Text style={styles.insightBody}>A clear signal from this week&apos;s sessions.</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color={C.signalOn} />
      </LinearGradient>
    </Pressable>
  );
}

function BottomNavigation() {
  return (
    <View style={styles.bottomNav} accessibilityLabel="Family navigation">
      {tabs.map((tab, index) => {
        const active = index === 0;
        return (
          <Pressable
            key={tab.label}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            <View style={styles.tabIcon}>
              <Ionicons
                name={active ? tab.activeIcon : tab.icon}
                size={22}
                color={active ? C.signal : C.inkMuted}
              />
              {tab.hasNotice ? <View style={styles.tabNotice} /> : null}
            </View>
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function layoutLabel(layout: SteadySignalStageLayout) {
  if (layout === "tablet-landscape") return "Tablet landscape";
  if (layout === "tablet-portrait") return "Tablet portrait";
  return "Phone";
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 12, paddingBottom: 28 },
  content: { maxWidth: "100%" },
  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  brand: { flexDirection: "row", alignItems: "baseline", gap: 7 },
  wordmark: { color: C.signal, fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  roleLabel: { color: C.inkMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1.4 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  layoutLabel: {
    color: C.inkMuted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 22,
    backgroundColor: C.surface,
  },
  notificationDot: {
    width: 7,
    height: 7,
    position: "absolute",
    top: 8,
    right: 8,
    borderRadius: 4,
    backgroundColor: C.beacon,
  },
  profileButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: C.signal,
  },
  profileButtonText: { color: C.signalOn, fontSize: 13, fontWeight: "800" },
  greeting: { gap: 4, marginTop: 24, marginBottom: 24 },
  greetingTitle: { color: C.ink, fontSize: 27, lineHeight: 33, fontWeight: "800", letterSpacing: -0.8 },
  greetingBody: { color: C.inkMuted, fontSize: 15, lineHeight: 22 },
  greetingAccent: { color: C.signal, fontWeight: "800" },
  learnerCard: {
    overflow: "hidden",
    gap: 16,
    padding: 18,
    borderWidth: 1,
    borderTopWidth: 4,
    borderColor: C.line,
    borderTopColor: C.signal,
    borderRadius: surfaceRadius,
    backgroundColor: C.surface,
    ...shadow,
  },
  learnerCardRow: { flexDirection: "row", alignItems: "stretch", padding: 24 },
  learnerIdentity: { flexDirection: "row", alignItems: "center", gap: 14 },
  learnerIdentityTablet: { flex: 0.9 },
  avatar: {
    width: 74,
    height: 74,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    borderWidth: 3,
    borderColor: C.signalSoft,
    borderRadius: 37,
    backgroundColor: C.surface,
  },
  avatarInner: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 29,
    backgroundColor: C.signalSoft,
  },
  avatarInitial: { color: C.signal, fontSize: 27, fontWeight: "900" },
  avatarStatus: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    right: -5,
    bottom: -2,
    borderWidth: 2,
    borderColor: C.surface,
    borderRadius: 14,
    backgroundColor: C.beaconSoft,
  },
  learnerCopy: { flex: 1, gap: 9 },
  learnerName: { color: C.ink, fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
  streak: {
    minHeight: 34,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: C.beacon,
    borderRadius: 17,
    backgroundColor: C.beaconSoft,
  },
  streakText: { color: C.beacon, fontSize: 12, fontWeight: "800" },
  goalRegion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: controlRadius,
    backgroundColor: C.surfaceRaised,
  },
  goalRegionTablet: { flex: 1.15, paddingHorizontal: 22, paddingVertical: 18 },
  goalRing: { alignItems: "center", justifyContent: "center" },
  goalCopy: { flex: 1, gap: 7 },
  goalTitle: { color: C.ink, fontSize: 15, fontWeight: "800" },
  goalBody: { color: C.inkMuted, fontSize: 12, lineHeight: 17 },
  weekdays: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 },
  day: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: C.canvas,
  },
  dayComplete: { backgroundColor: C.signal },
  dayCurrent: { borderWidth: 2, borderColor: C.signal, backgroundColor: C.surface },
  dayText: { color: C.inkMuted, fontSize: 9, fontWeight: "800" },
  dayTextComplete: { color: C.signalOn },
  dayTextCurrent: { color: C.signal },
  sectionLabel: {
    marginTop: 28,
    marginBottom: 12,
    color: C.inkMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  snapshotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  snapshotCard: {
    minWidth: 0,
    flexGrow: 1,
    gap: 7,
    padding: 16,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: surfaceRadius,
    backgroundColor: C.surface,
    ...shadow,
  },
  snapshotCardTablet: { minHeight: 160, padding: 20, justifyContent: "center" },
  snapshotIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: controlRadius,
    backgroundColor: C.signalSoft,
  },
  snapshotValue: { color: C.signal, fontSize: 25, lineHeight: 30, fontWeight: "900", letterSpacing: -0.7 },
  snapshotValueCompact: { fontSize: 21 },
  snapshotLabel: { color: C.ink, fontSize: 12, lineHeight: 17, fontWeight: "700" },
  snapshotDetail: { color: C.inkMuted, fontSize: 10, lineHeight: 15 },
  insight: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 18,
    padding: 16,
    borderRadius: surfaceRadius,
  },
  insightIcon: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: controlRadius,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  insightCopy: { flex: 1, gap: 3 },
  insightTitle: { color: C.signalOn, fontSize: 14, lineHeight: 19, fontWeight: "800" },
  insightBody: { color: C.signalOn, fontSize: 11, lineHeight: 16, opacity: 0.88 },
  bottomNav: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "stretch",
    borderTopWidth: 1,
    borderTopColor: C.line,
    backgroundColor: C.surface,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 7 },
  tabIcon: { position: "relative" },
  tabNotice: {
    width: 6,
    height: 6,
    position: "absolute",
    top: -2,
    right: -5,
    borderRadius: 3,
    backgroundColor: C.beacon,
  },
  tabLabel: { color: C.inkMuted, fontSize: 9, fontWeight: "700" },
  tabLabelActive: { color: C.signal },
  pressed: { opacity: 0.72 },
});
