import React from "react";
import { Tabs, router, usePathname, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/colors";
import { useTranslation } from "@/hooks/useTranslation";
import { useWindowSizeClass } from "@/src/design/useWindowSizeClass";
import { RoleTabletShell } from "@/src/components/layout/RoleTabletShell";

export default function TeacherLayout() {
  const { t } = useTranslation();
  const { isTablet } = useWindowSizeClass();
  const pathname = usePathname();
  const railDestinations = [
    { key: "index", label: t("tabs.classroom"), icon: "school" as const, active: pathname === "/(teacher)" || pathname === "/" || pathname === "/(teacher)/index", onPress: () => router.push("/(teacher)" as Href) },
    { key: "lessonPlan", label: t("tabs.lessonPlans"), icon: "document-text" as const, active: pathname?.includes("/lesson-plan"), onPress: () => router.push("/(teacher)/lesson-plan" as Href) },
    { key: "analytics", label: t("tabs.analytics"), icon: "bar-chart" as const, active: pathname?.includes("/analytics"), onPress: () => router.push("/(teacher)/analytics" as Href) },
    { key: "settings", label: t("tabs.settings"), icon: "settings-outline" as const, active: pathname?.includes("/settings"), onPress: () => router.push("/(teacher)/settings" as Href) },
  ];
  return (
    <RoleTabletShell destinations={railDestinations}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: isTablet
          ? { display: "none" }
          : {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              height: 84,
              paddingBottom: 20,
              paddingTop: 8,
            },
        tabBarLabelStyle: { fontFamily: "Nunito-SemiBold", fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.classroom"),
          tabBarIcon: ({ color, size }) => <Ionicons name="school" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="lesson-plan"
        options={{
          title: t("tabs.lessonPlans"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: t("tabs.analytics"),
          tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="student/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="student/[id]/insight" options={{ href: null }} />
      <Tabs.Screen name="student/[id]/iep" options={{ href: null }} />
    </Tabs>
    </RoleTabletShell>
  );
}
