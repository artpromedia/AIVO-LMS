import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearners } from "@/hooks/useLearners";
import { useAuth } from "@/hooks/useAuth";
import { TierThemeProvider, useTierTheme } from "@aivo/mobile-ui";
import { SwitchScanOverlay } from "@/src/components/SwitchScanOverlay";
import { useWindowSizeClass } from "@/src/design/useWindowSizeClass";

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
  // On tablets we hide the bottom tab bar and rely on the per-screen
  // tablet scaffold to render a navigation rail/sidebar instead. The
  // <Tabs> navigator stays mounted so deep links keep working — only the
  // bottom bar UI is suppressed.
  const { isTablet } = useWindowSizeClass();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.tabBarActive,
        tabBarInactiveTintColor: theme.colors.tabBarInactive,
        tabBarStyle: isTablet
          ? { display: "none" }
          : {
              backgroundColor: theme.colors.tabBar,
              borderTopColor: theme.colors.border,
              height: 84,
              paddingBottom: 20,
              paddingTop: 8,
            },
        tabBarLabelStyle: {
          fontFamily: "Nunito-SemiBold",
          fontSize: 11,
        },
        sceneStyle: {
          backgroundColor: theme.colors.bg,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.worldMap"),
          tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="brain"
        options={{
          title: t("tabs.brain"),
          tabBarIcon: ({ color, size }) => <Ionicons name="bulb" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: t("tabs.shop"),
          tabBarIcon: ({ color, size }) => <Ionicons name="cart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="gamification"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: ({ color, size }) => <Ionicons name="trophy" size={size} color={color} />,
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
      <Tabs.Screen name="leaderboard" options={{ href: null }} />
    </Tabs>
  );
}
