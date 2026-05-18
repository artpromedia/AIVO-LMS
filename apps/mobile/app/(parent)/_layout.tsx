import React from "react";
import { Tabs, router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/colors";
import { useTranslation } from "@/hooks/useTranslation";
import { useWindowSizeClass } from "@/src/design/useWindowSizeClass";
import { RoleTabletShell } from "@/src/components/layout/RoleTabletShell";

export default function ParentLayout() {
  const { t } = useTranslation();
  const { isTablet } = useWindowSizeClass();
  const railDestinations = [
    { key: "home", label: t("tabs.home"), icon: "home" as const, onPress: () => router.push("/(parent)" as Href) },
    { key: "inbox", label: t("tabs.inbox"), icon: "mail" as const, onPress: () => router.push("/(parent)/recommendations" as Href) },
    { key: "tutors", label: t("tabs.tutors"), icon: "school" as const, onPress: () => router.push("/(parent)/tutors" as Href) },
    { key: "settings", label: t("tabs.settings"), icon: "settings" as const, onPress: () => router.push("/(parent)/settings" as Href) },
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
        tabBarLabelStyle: {
          fontFamily: "Nunito-SemiBold",
          fontSize: 11,
        },
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
        name="brain/[childId]/index"
        options={{
          title: t("tabs.brain"),
          tabBarIcon: ({ color, size }) => <Ionicons name="bulb" size={size} color={color} />,
          href: null,
        }}
      />
      <Tabs.Screen name="brain/[childId]/[domain]" options={{ href: null }} />
      <Tabs.Screen name="brain/[childId]/history" options={{ href: null }} />
      <Tabs.Screen
        name="recommendations"
        options={{
          title: t("tabs.inbox"),
          tabBarIcon: ({ color, size }) => <Ionicons name="mail" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tutors"
        options={{
          title: t("tabs.tutors"),
          tabBarIcon: ({ color, size }) => <Ionicons name="school" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="iep/[childId]" options={{ href: null }} />
      <Tabs.Screen name="progress/[childId]" options={{ href: null }} />
      <Tabs.Screen name="session/[childId]" options={{ href: null }} />
      <Tabs.Screen name="colearn/[childId]" options={{ href: null }} />
      <Tabs.Screen name="onboard" options={{ href: null }} />
      <Tabs.Screen name="team/[childId]" options={{ href: null }} />
      <Tabs.Screen name="billing" options={{ href: null }} />
      <Tabs.Screen name="inbox" options={{ href: null }} />
      <Tabs.Screen name="milestones/[childId]" options={{ href: null }} />
    </Tabs>
    </RoleTabletShell>
  );
}
