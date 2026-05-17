import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { useTranslation } from '@/hooks/useTranslation';

export default function CaregiverLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 84,
          paddingBottom: 20,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontFamily: 'Nunito-SemiBold', fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t('tabs.alerts'),
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
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
  );
}
