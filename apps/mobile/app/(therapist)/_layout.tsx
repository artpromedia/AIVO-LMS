import React from "react";
import { Tabs, router, usePathname, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/colors";
import { useTranslation } from "@/hooks/useTranslation";
import { useWindowSizeClass } from "@/src/design/useWindowSizeClass";
import { RoleTabletShell } from "@/src/components/layout/RoleTabletShell";
import { useTabBarStyle, TAB_BAR_LABEL_STYLE } from "@/hooks/useTabBarStyle";

export default function TherapistLayout() {
  const { t } = useTranslation();
  const { isTablet } = useWindowSizeClass();
  const pathname = usePathname();
  const tabBarStyle = useTabBarStyle({ hidden: isTablet });
  const railDestinations = [
    { key: "index", label: t("tabs.clients"), icon: "people" as const, active: pathname === "/(therapist)" || pathname === "/" || pathname === "/(therapist)/index", onPress: () => router.push("/(therapist)" as Href) },
    { key: "sessions", label: t("tabs.sessions"), icon: "calendar" as const, active: pathname?.includes("/sessions"), onPress: () => router.push("/(therapist)/sessions" as Href) },
    { key: "settings", label: t("tabs.settings"), icon: "settings" as const, active: pathname?.includes("/settings"), onPress: () => router.push("/(therapist)/settings" as Href) },
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
          title: t("tabs.clients"),
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: t("tabs.sessions"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="client/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="client/[id]/goals" options={{ href: null }} />
      <Tabs.Screen name="client/[id]/notes" options={{ href: null }} />
      <Tabs.Screen name="client/[id]/reports" options={{ href: null }} />
    </Tabs>
    </RoleTabletShell>
  );
}
