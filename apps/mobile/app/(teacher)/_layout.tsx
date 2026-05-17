import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { useTranslation } from '@/hooks/useTranslation';
import { useWindowSizeClass } from '@/src/design/useWindowSizeClass';

export default function TeacherLayout() {
  const { t } = useTranslation();
  const { isTablet } = useWindowSizeClass();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: isTablet
          ? { display: 'none' }
          : {
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
          title: t('tabs.classroom'),
          tabBarIcon: ({ color, size }) => <Ionicons name="school" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="lesson-plan"
        options={{
          title: t('tabs.lessonPlans'),
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: t('tabs.analytics'),
          tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="student/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="student/[id]/insight" options={{ href: null }} />
      <Tabs.Screen name="student/[id]/iep" options={{ href: null }} />
    </Tabs>
  );
}
