import React from "react";
import { Tabs, router, usePathname, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearners } from "@/hooks/useLearners";
import { useAuth } from "@/hooks/useAuth";
import { TierThemeProvider, useTierTheme } from "@aivo/mobile-ui";
import { SwitchScanOverlay } from "@/src/components/SwitchScanOverlay";
import { BreakReminder } from "@/src/components/learning/BreakReminder";
import { useWindowSizeClass } from "@/src/design/useWindowSizeClass";
import { RoleTabletShell } from "@/src/components/layout/RoleTabletShell";
import { useTabBarStyle, TAB_BAR_LABEL_STYLE } from "@/hooks/useTabBarStyle";

// Tab-bar icons defined at module scope (not inline in the navigator) so
// they keep a stable component identity across renders.
type TabIconProps = Readonly<{ color: string; size: number }>;
const MapTabIcon = ({ color, size }: TabIconProps) => (
  <Ionicons name="map" size={size} color={color} />
);
const CartTabIcon = ({ color, size }: TabIconProps) => (
  <Ionicons name="cart" size={size} color={color} />
);
const TrophyTabIcon = ({ color, size }: TabIconProps) => (
  <Ionicons name="trophy" size={size} color={color} />
);

/**
 * Resolve the active learner's gradeLevel.
 *  - If the logged-in user is a LEARNER, use their own record.
 *  - Otherwise (PARENT viewing a child), fall back to the first learner.
 *  - During load / when no learners exist, returns null and the
 *    TierThemeProvider falls back to EARLY (the safest default).
 */
function useActiveLearnerGrade(): string | null {
  const { user } = useAuth();
  const { data: learners } = useLearners();
  if (!learners || learners.length === 0) return null;
  if (user?.role === "LEARNER") {
    const own = learners.find((l) => l.id === user.id);
    return own?.gradeLevel ?? learners[0].gradeLevel ?? null;
  }
  return learners[0].gradeLevel ?? null;
}

/** Returns true when the learner's active_accommodations includes "switch_scanning". */
function useSwitchScanningEnabled(): boolean {
  const { user } = useAuth();
  const { data: learners } = useLearners();
  const accommodations: string[] = (() => {
    if (user?.role === "LEARNER") {
      return (user as any).activeAccommodations ?? [];
    }
    return (learners?.[0] as any)?.activeAccommodations ?? [];
  })();
  return accommodations.includes("switch_scanning");
}

export default function LearnerLayout() {
  const gradeLevel = useActiveLearnerGrade();
  const switchScanEnabled = useSwitchScanningEnabled();
  return (
    <TierThemeProvider gradeLevel={gradeLevel}>
      <ThemedLearnerTabs />
      {/* Global switch scanning overlay — only mounted for eligible learners */}
      <SwitchScanOverlay active={switchScanEnabled} items={[]} />
      {/* Periodic break prompt — active only when the learner enables it. */}
      <BreakReminder />
    </TierThemeProvider>
  );
}

/**
 * Inner component so it can call `useTierTheme()` from inside the
 * provider. Tab-bar colours, background, label font, and icon tint all
 * derive from the active tier theme.
 */
function ThemedLearnerTabs() {
  const { t } = useTranslation();
  const { theme } = useTierTheme();
  // On tablets we hide the bottom tab bar and render a persistent
  // navigation rail at the layout level via RoleTabletShell. The
  // <Tabs> navigator stays mounted so deep links keep working — only
  // the bottom bar UI is suppressed.
  const { isTablet } = useWindowSizeClass();
  const pathname = usePathname();
  const tabBarStyle = useTabBarStyle({
    hidden: isTablet,
    backgroundColor: theme.colors.tabBar,
    borderTopColor: theme.colors.border,
  });
  const railDestinations = [
    {
      key: "worldMap",
      label: t("tabs.worldMap"),
      icon: "map" as const,
      active: pathname === "/(learner)" || pathname === "/" || pathname === "/(learner)/index",
      onPress: () => router.push("/(learner)" as Href),
    },
    {
      key: "homework",
      label: t("learner.homework"),
      icon: "camera" as const,
      active: pathname?.includes("/homework"),
      onPress: () => router.push("/(learner)/homework" as Href),
    },
    {
      key: "quests",
      label: t("learner.quests"),
      icon: "compass" as const,
      active: pathname?.includes("/quests"),
      onPress: () => router.push("/(learner)/quests" as Href),
    },
    {
      key: "gradebook",
      label: t("learner.grades"),
      icon: "bar-chart" as const,
      active: pathname?.includes("/gradebook"),
      onPress: () => router.push("/(learner)/gradebook" as Href),
    },
    {
      key: "shop",
      label: t("tabs.shop"),
      icon: "cart" as const,
      active: pathname?.includes("/shop"),
      onPress: () => router.push("/(learner)/shop" as Href),
    },
    {
      key: "gamification",
      label: t("tabs.profile"),
      icon: "trophy" as const,
      active: pathname?.includes("/gamification"),
      onPress: () => router.push("/(learner)/gamification" as Href),
    },
    {
      key: "settings",
      label: t("tabs.settings"),
      icon: "settings" as const,
      active: pathname?.includes("/settings"),
      onPress: () => router.push("/(learner)/settings" as Href),
    },
  ];
  return (
    <RoleTabletShell destinations={railDestinations}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.colors.tabBarActive,
          tabBarInactiveTintColor: theme.colors.tabBarInactive,
          tabBarStyle,
          tabBarLabelStyle: TAB_BAR_LABEL_STYLE,
          sceneStyle: {
            backgroundColor: theme.colors.bg,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t("tabs.worldMap"),
            tabBarIcon: MapTabIcon,
          }}
        />
        <Tabs.Screen
          name="shop"
          options={{
            title: t("tabs.shop"),
            tabBarIcon: CartTabIcon,
          }}
        />
        <Tabs.Screen
          name="gamification"
          options={{
            title: t("tabs.profile"),
            tabBarIcon: TrophyTabIcon,
          }}
        />
        <Tabs.Screen name="stage/[sessionId]" options={{ href: null }} />
        <Tabs.Screen name="adventure" options={{ href: null }} />
        <Tabs.Screen name="tutor/[tutorSlug]" options={{ href: null }} />
        <Tabs.Screen name="homework/index" options={{ href: null }} />
        <Tabs.Screen name="homework/[sessionId]" options={{ href: null }} />
        <Tabs.Screen name="quests/index" options={{ href: null }} />
        <Tabs.Screen name="quests/[worldSlug]/index" options={{ href: null }} />
        <Tabs.Screen name="quests/[worldSlug]/play/[questId]" options={{ href: null }} />
        <Tabs.Screen name="challenges" options={{ href: null }} />
        <Tabs.Screen name="badges" options={{ href: null }} />
        <Tabs.Screen name="gradebook" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="accessibility" options={{ href: null }} />
        <Tabs.Screen name="audio" options={{ href: null }} />
        <Tabs.Screen name="subjects/index" options={{ href: null }} />
        <Tabs.Screen name="subjects/[subjectId]" options={{ href: null }} />
        <Tabs.Screen name="progress" options={{ href: null }} />
        <Tabs.Screen name="lesson-runs" options={{ href: null }} />
        <Tabs.Screen name="calm" options={{ href: null }} />
        <Tabs.Screen name="library" options={{ href: null }} />
        <Tabs.Screen name="missions" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="baseline/index" options={{ href: null }} />
        <Tabs.Screen name="baseline/run" options={{ href: null }} />
        <Tabs.Screen name="leaderboard" options={{ href: null }} />
      </Tabs>
    </RoleTabletShell>
  );
}
