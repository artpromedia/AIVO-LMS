import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/hooks/useAuth';
import { useLearnerEntitlements } from '@/hooks/useLearnerEntitlements';
import { TUTORS } from '@aivo/brand';
import { TUTOR_KEY_TO_SKU, isTutorKey } from '@aivo/billing-entitlements';
import { AivoButton } from '@aivo/mobile-ui';
import { colors, spacing, radius } from '@/constants/colors';
import { useWindowSizeClass } from '@/src/design/useWindowSizeClass';
import { CONTENT_MAX_WIDTH, pickBySizeClass } from '@/src/design/responsive';
import { sessionClient, TutorNotEntitledError } from '@/src/api/sessionClient';

type TutorKey = keyof typeof TUTORS;

export default function TutorSessionScreen() {
  const { tutorSlug } = useLocalSearchParams<{ tutorSlug: string }>();
  const insets = useSafeAreaInsets();
  const tutor = TUTORS[tutorSlug as TutorKey];
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isTutorEntitled, isLoading: entitlementsLoading } = useLearnerEntitlements(user?.tenantId);
  const entitled = isTutorEntitled(tutorSlug as string);
  const { sizeClass, width: winWidth } = useWindowSizeClass();
  const hPad = pickBySizeClass(sizeClass, { compact: spacing.md, medium: spacing.lg, expanded: spacing.xl });
  const contentWidth = Math.min(winWidth - hPad * 2, CONTENT_MAX_WIDTH.reading);
  const [starting, setStarting] = useState(false);

  if (!tutor) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16, paddingHorizontal: hPad }]}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.title}>{t('learnerTutor.tutorNotFound')}</Text>
      </View>
    );
  }

  const startSession = async () => {
    if (!user || !isTutorKey(tutorSlug as string)) return;
    setStarting(true);
    try {
      const sku = TUTOR_KEY_TO_SKU[tutorSlug as TutorKey];
      const { sessionId } = await sessionClient.startSession({
        learnerId: user.id,
        tutorSku: sku,
      });
      router.push(`/(learner)/stage/${sessionId}` as any);
    } catch (err) {
      if (err instanceof TutorNotEntitledError) {
        Alert.alert(
          'Tutor locked',
          "This tutor isn't included in your current plan. Ask a parent or guardian to add it as an add-on or upgrade your plan.",
        );
      } else {
        Alert.alert(
          t('common.error'),
          err instanceof Error ? err.message : 'Could not start session.',
        );
      }
    } finally {
      setStarting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingHorizontal: hPad, alignItems: 'center' }]}>
      <View style={{ width: contentWidth }}>
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.7)" />
        <Text style={styles.backText}>{t('common.back')}</Text>
      </Pressable>

      <View style={styles.tutorIntro}>
        <View style={[styles.tutorAvatar, { backgroundColor: tutor.color + '30' }]}>
          <Text style={styles.tutorIcon}>{tutor.icon}</Text>
        </View>
        <Text style={styles.tutorName}>{tutor.name}</Text>
        <Text style={styles.tutorDomain}>{tutor.domain}</Text>
      </View>

      <View style={styles.sessionInfo}>
        <View style={styles.infoCard}>
          <Ionicons name="time-outline" size={20} color={colors.primaryLight} />
          <Text style={styles.infoText}>{t('learnerTutor.sessionDuration')}</Text>
        </View>
        <View style={styles.infoCard}>
          <Ionicons name="sparkles-outline" size={20} color={colors.accent} />
          <Text style={styles.infoText}>{t('learnerTutor.adaptiveDifficulty')}</Text>
        </View>
        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.success} />
          <Text style={styles.infoText}>{t('learnerTutor.brainInformed')}</Text>
        </View>
      </View>

      {!entitled && !entitlementsLoading && (
        <View style={styles.lockedCallout} accessibilityLiveRegion="polite">
          <Ionicons name="lock-closed" size={18} color="#FFF" />
          <Text style={styles.lockedText}>
            This tutor isn't in your plan yet. Ask a parent or guardian to unlock it.
          </Text>
        </View>
      )}

      {starting ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <AivoButton
          title={t('learnerTutor.startSession', { name: tutor.name })}
          onPress={startSession}
          disabled={!entitled && !entitlementsLoading}
          size="lg"
          style={{ marginTop: spacing.xl }}
        />
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A2E' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xl },
  backText: { fontSize: 16, fontFamily: 'Nunito-SemiBold', color: 'rgba(255,255,255,0.7)' },
  title: { fontSize: 24, fontFamily: 'Nunito-ExtraBold', color: '#FFF' },
  tutorIntro: { alignItems: 'center', marginBottom: spacing.xl },
  tutorAvatar: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  tutorIcon: { fontSize: 48 },
  tutorName: { fontSize: 28, fontFamily: 'Nunito-ExtraBold', color: '#FFF' },
  tutorDomain: { fontSize: 16, fontFamily: 'Nunito-Regular', color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  sessionInfo: { gap: 12 },
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.xl, padding: spacing.md },
  infoText: { fontSize: 15, fontFamily: 'Nunito-SemiBold', color: '#FFF' },
  lockedCallout: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255, 200, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 0, 0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lockedText: { flex: 1, fontSize: 14, fontFamily: 'Nunito-SemiBold', color: '#FFF' },
});
