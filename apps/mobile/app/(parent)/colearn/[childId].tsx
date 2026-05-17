import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/hooks/useTranslation';
import { EmptyState } from '@aivo/mobile-ui';
import { colors, spacing } from '@/constants/colors';

export default function CoLearnScreen() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- route param reserved for future use
  const { childId: _childId } = useLocalSearchParams<{ childId: string }>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>{t('common.back')}</Text>
      </Pressable>
      <Text style={styles.title}>{t('parentColearn.title')}</Text>
      <EmptyState
        icon={<Ionicons name="people-circle-outline" size={48} color={colors.textSecondary} />}
        title={t('parentColearn.title')}
        message={t('parentColearn.subtitle', { name: '' })}
        actionLabel="Start Co-Learning"
        onAction={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 16, fontFamily: 'Nunito-SemiBold', color: colors.primary },
  title: { fontSize: 24, fontFamily: 'Nunito-ExtraBold', color: colors.text },
});
