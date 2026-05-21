import React from "react";
import { Tabs, router, usePathname, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/colors";
import { useTranslation } from "@/hooks/useTranslation";
import { useWindowSizeClass } from "@/src/design/useWindowSizeClass";
import { RoleTabletShell } from "@/src/components/layout/RoleTabletShell";
import { useTabBarStyle, TAB_BAR_LABEL_STYLE } from "@/hooks/useTabBarStyle";

export default function CaregiverLayout() {
  const { t } = useTranslation();
  const { isTablet } = useWindowSizeClass();
  const pathname = usePathname();
  const tabBarStyle = useTabBarStyle({ hidden: isTablet });
  const railDestinations = [
    { key: "index", label: t("tabs.home"), icon: "home" as const, active: pathname === "/(caregiver)" || pathname === "/" || pathname === "/(caregiver)/index", onPress: () => router.push("/(caregiver)" as Href) },
    { key: "notifications", label: t("tabs.alerts"), icon: "notifications" as const, active: pathname?.includes("/notifications"), onPress: () => router.push("/(caregiver)/notifications" as Href) },
    { key: "settings", label: t("tabs.settings"), icon: "settings" as const, active: pathname?.includes("/settings"), onPress: () => router.push("/(caregiver)/settings" as Href) },
  ];
  return (
    <RoleTabletShell destinations={railDestinations}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle,
        tabBarLabelStyle: TAB_BAR_LABEL_STYLE,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t("tabs.alerts"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="child/[childId]/index" options={{ href: null }} />
      <Tabs.Screen name="child/[childId]/brain" options={{ href: null }} />
      <Tabs.Screen name="child/[childId]/accommodations" options={{ href: null }} />
      <Tabs.Screen name="child/[childId]/iep-goals" options={{ href: null }} />
      <Tabs.Screen name="child/[childId]/gradebook" options={{ href: null }} />
      <Tabs.Screen name="child/[childId]/sessions" options={{ href: null }} />
      <Tabs.Screen name="child/[childId]/observation" options={{ href: null }} />
      <Tabs.Screen name="child/[childId]/progress" options={{ href: null }} />
    </Tabs>
    </RoleTabletShell>
  );
}
