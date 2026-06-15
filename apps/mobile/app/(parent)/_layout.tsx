import React, { useEffect } from "react";
import { Tabs, router, usePathname, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/colors";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useLearners } from "@/hooks/useLearners";
import { useParentInbox } from "@/hooks/useParentInbox";
import { setRememberedFamily } from "@/lib/rememberedFamily";
import { useWindowSizeClass } from "@/src/design/useWindowSizeClass";
import { RoleTabletShell } from "@/src/components/layout/RoleTabletShell";
import { useTabBarStyle, TAB_BAR_LABEL_STYLE } from "@/hooks/useTabBarStyle";

export default function ParentLayout() {
  const { t } = useTranslation();
  const { isTablet } = useWindowSizeClass();
  const tabBarStyle = useTabBarStyle({ hidden: isTablet });
  const { user } = useAuth();
  const { data: learners } = useLearners();
  const { data: inbox } = useParentInbox(user?.id ?? "");
  const unreadCount = inbox?.unreadCount ?? 0;

  // Snapshot the family for the unauthenticated learner-login path. The
  // learner-login screen prefers a live parent session, but when the app
  // cold-starts (no token) this cached roster is what lets a parent hand
  // the device to their child and pick a profile without re-signing-in.
  useEffect(() => {
    if (user?.role !== "PARENT" || !learners || learners.length === 0) return;
    void setRememberedFamily({
      parentId: user.id,
      parentName: user.name,
      parentEmail: user.email,
      learners: learners.map((l) => ({
        id: l.id,
        firstName: l.firstName,
        lastName: l.lastName,
        gradeLevel: l.gradeLevel,
        avatar: l.avatar,
      })),
      savedAt: Date.now(),
    });
  }, [user, learners]);
  const pathname = usePathname();
  const railDestinations = [
    {
      key: "home",
      label: t("tabs.home"),
      icon: "home" as const,
      active: pathname === "/(parent)" || pathname === "/" || pathname === "/(parent)/index",
      onPress: () => router.push("/(parent)" as Href),
    },
    {
      key: "inbox",
      label: t("tabs.inbox"),
      icon: "mail" as const,
      badge: unreadCount,
      active: pathname?.includes("/recommendations") || pathname?.includes("/inbox"),
      onPress: () => router.push("/(parent)/recommendations" as Href),
    },
    {
      key: "tutors",
      label: t("tabs.tutors"),
      icon: "school" as const,
      active: pathname?.includes("/tutors"),
      onPress: () => router.push("/(parent)/tutors" as Href),
    },
    {
      key: "billing",
      label: t("parent.billing"),
      icon: "card" as const,
      active: pathname?.includes("/billing"),
      onPress: () => router.push("/(parent)/billing" as Href),
    },
    {
      key: "settings",
      label: t("tabs.settings"),
      icon: "settings" as const,
      active: pathname?.includes("/settings"),
      onPress: () => router.push("/(parent)/settings" as Href),
    },
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
        <Tabs.Screen name="home-v2" options={{ href: null }} />
        <Tabs.Screen name="learners/index" options={{ href: null }} />
        <Tabs.Screen name="learners/[learnerId]" options={{ href: null }} />
        <Tabs.Screen name="gradebook/[childId]" options={{ href: null }} />
        <Tabs.Screen name="summary/[childId]" options={{ href: null }} />
        <Tabs.Screen name="snapshot/[childId]" options={{ href: null }} />
        <Tabs.Screen name="reports" options={{ href: null }} />
        <Tabs.Screen name="resources" options={{ href: null }} />
        <Tabs.Screen name="sensory/[childId]" options={{ href: null }} />
        <Tabs.Screen name="lessons/[childId]" options={{ href: null }} />
        <Tabs.Screen name="homework/[childId]" options={{ href: null }} />
        <Tabs.Screen name="curriculum/[childId]" options={{ href: null }} />
        <Tabs.Screen name="schedule/[childId]" options={{ href: null }} />
        <Tabs.Screen name="profile-v2/[childId]" options={{ href: null }} />
        <Tabs.Screen name="settings-learner/[childId]" options={{ href: null }} />
        <Tabs.Screen name="settings-account/index" options={{ href: null }} />
        <Tabs.Screen name="accessibility/[childId]" options={{ href: null }} />
        <Tabs.Screen name="accessibility/audio/[childId]" options={{ href: null }} />
        <Tabs.Screen name="consent/index" options={{ href: null }} />
        <Tabs.Screen name="consent/[learnerId]" options={{ href: null }} />
        <Tabs.Screen name="privacy/index" options={{ href: null }} />
        <Tabs.Screen name="privacy/data-export" options={{ href: null }} />
        <Tabs.Screen name="privacy/delete-data" options={{ href: null }} />
        <Tabs.Screen name="baseline/[childId]" options={{ href: null }} />
        <Tabs.Screen name="brain-clone-watch/[childId]" options={{ href: null }} />
        <Tabs.Screen name="iep-review/[childId]" options={{ href: null }} />
        <Tabs.Screen name="learner-new/index" options={{ href: null }} />
        <Tabs.Screen name="assessment/[childId]" options={{ href: null }} />
      </Tabs>
    </RoleTabletShell>
  );
}
