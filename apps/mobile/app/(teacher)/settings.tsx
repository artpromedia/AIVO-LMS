import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '@/hooks/useTranslation';
import { AccountSettingsCard } from '@/src/components/settings/AccountSettingsCard';
import { colors, spacing } from '@/constants/colors';

export default function TeacherSettings() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
    >
      <Text style={styles.title}>{t('teacherSettings.title')}</Text>
      <AccountSettingsCard />
      <Text style={styles.version}>{t('common.appVersion')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Nunito-ExtraBold',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  version: {
    marginTop: spacing.xl,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    color: colors.textSecondary,
  },
});
