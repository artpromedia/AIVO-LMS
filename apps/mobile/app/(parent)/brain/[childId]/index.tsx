import React from 'react';
import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/hooks/useTranslation';
import { useLearner } from '@/hooks/useLearners';
import BrainCloneCard from '@/src/components/brain/BrainCloneCard';
import { colors, spacing } from '@/constants/colors';

export default function BrainProfileScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { data: learner } = useLearner(childId);

  const learnerName = learner
    ? `${learner.firstName} ${learner.lastName}`.trim()
    : 'Learner';
  const enrolledGrade = learner?.gradeLevel ?? null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: 32,
      }}
    >
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>{t('common.back')}</Text>
      </Pressable>

      <Text style={styles.title}>
        {t('parentBrain.title', { name: learner?.firstName || 'Learner' })}
      </Text>
      <Text style={styles.subtitle}>{t('parentBrain.subtitle')}</Text>

      <View style={styles.cardWrap}>
        <BrainCloneCard
          learnerId={childId}
          learnerName={learnerName}
          enrolledGrade={enrolledGrade}
          variant="full"
          onBuildBrain={() =>
            router.push(`/(parent)/brain/${childId}/history` as never)
          }
        />
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          onPress={() =>
            router.push(`/(parent)/brain/${childId}/history` as never)
          }
          style={styles.actionBtn}
        >
          <Ionicons name="time-outline" size={16} color={colors.primary} />
          <Text style={styles.actionText}>
            {t('parentBrain.viewHistory')}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  backText: {
    fontSize: 16,
    fontFamily: 'Nunito-SemiBold',
    color: colors.primary,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Nunito-ExtraBold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  cardWrap: { marginBottom: spacing.lg },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary + '60',
    backgroundColor: colors.primary + '14',
  },
  actionText: {
    fontSize: 13,
    fontFamily: 'Nunito-Bold',
    color: colors.primary,
  },
});
