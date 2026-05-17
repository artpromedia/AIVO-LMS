import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/hooks/useAuth';
import { useLearners } from '@/hooks/useLearners';
import { useParentInbox } from '@/hooks/useParentInbox';
import { AivoCard, StatCard, AivoButton, EmptyState } from '@aivo/mobile-ui';
import { colors, spacing, radius } from '@/constants/colors';
import { useWindowSizeClass } from '@/src/design/useWindowSizeClass';
import { CONTENT_MAX_WIDTH, pickBySizeClass } from '@/src/design/responsive';
import { TabletScaffold } from '@/src/components/layout/TabletScaffold';

export default function ParentDashboard() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { data: learners, refetch } = useLearners();
  const { data: inbox } = useParentInbox(user?.id ?? '');
  const unreadCount = inbox?.unreadCount ?? 0;
  const [refreshing, setRefreshing] = React.useState(false);
  const { t } = useTranslation();
  const { sizeClass, isTablet, width: winWidth } = useWindowSizeClass();
  const hPad = pickBySizeClass(sizeClass, { compact: spacing.md, medium: spacing.lg, expanded: spacing.xl });
  const contentWidth = Math.min(winWidth - hPad * 2, isTablet ? CONTENT_MAX_WIDTH.dashboard : winWidth);

  const railDestinations = [
    {
      key: 'home',
      label: t('tabs.home'),
      icon: 'home' as const,
      active: true,
      onPress: () => router.push('/(parent)' as any),
    },
    {
      key: 'inbox',
      label: t('tabs.inbox'),
      icon: 'mail' as const,
      badge: unreadCount,
      onPress: () => router.push('/(parent)/recommendations' as any),
    },
    {
      key: 'tutors',
      label: t('tabs.tutors'),
      icon: 'school' as const,
      onPress: () => router.push('/(parent)/tutors' as any),
    },
    {
      key: 'billing',
      label: t('parent.billing'),
      icon: 'card-outline' as const,
      onPress: () => router.push('/(parent)/billing' as any),
    },
    {
      key: 'settings',
      label: t('tabs.settings'),
      icon: 'settings' as const,
      onPress: () => router.push('/(parent)/settings' as any),
    },
  ];


  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const body = (
    <ScrollView
      style={[styles.container, { paddingHorizontal: hPad }]}
      contentContainerStyle={{
        paddingTop: isTablet ? spacing.lg : insets.top + 16,
        paddingBottom: 32,
        alignItems: 'center',
      }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
    >
      <View style={{ width: contentWidth }}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{t('parent.greeting', { name: user?.name || 'Parent' })}</Text>
          <Text style={styles.subGreeting}>{t('parent.learningOverview')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={() => router.push('/(parent)/inbox' as any)}
            style={styles.logoutBtn}
            accessibilityRole="button"
            accessibilityLabel={t('parentInbox.title')}
          >
            <View>
              <Ionicons name="mail-outline" size={22} color={colors.textSecondary} />
              {unreadCount > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadCount > 9 ? '9+' : String(unreadCount)}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
          <Pressable onPress={logout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatCard
          label={t('parent.children')}
          value={learners?.length || 0}
          icon={<Ionicons name="people" size={20} color={colors.primary} />}
        />
        <View style={{ width: 8 }} />
        <StatCard
          label={t('parent.activeTutors')}
          value={7}
          icon={<Ionicons name="school" size={20} color={colors.secondary} />}
          color={colors.secondary}
        />
        <View style={{ width: 8 }} />
        <StatCard
          label={t('parent.sessions')}
          value={24}
          icon={<Ionicons name="book" size={20} color={colors.success} />}
          color={colors.success}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('parent.yourChildren')}</Text>
        <Pressable onPress={() => router.push('/(parent)/onboard')}>
          <Ionicons name="add-circle" size={28} color={colors.primary} />
        </Pressable>
      </View>

      {!learners || learners.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="people-outline" size={48} color={colors.textSecondary} />}
          title={t('parent.noChildrenTitle')}
          message={t('parent.noChildrenMessage')}
          actionLabel={t('parent.addChild')}
          onAction={() => router.push('/(parent)/onboard')}
        />
      ) : (
        learners.map((learner) => (
          <Pressable
            key={learner.id}
            onPress={() => router.push(`/(parent)/brain/${learner.id}` as any)}
          >
            <AivoCard style={styles.childCard}>
              <View style={styles.childRow}>
                <View style={styles.childAvatar}>
                  <Text style={styles.childInitial}>
                    {learner.firstName[0]}
                  </Text>
                </View>
                <View style={styles.childInfo}>
                  <Text style={styles.childName}>{learner.firstName} {learner.lastName}</Text>
                  <Text style={styles.childGrade}>{t('common.grade', { grade: learner.gradeLevel })}</Text>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelText}>{learner.functioningLevel}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.childActions}>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => router.push(`/(parent)/brain/${learner.id}` as any)}
                >
                  <Ionicons name="bulb-outline" size={18} color={colors.primary} />
                  <Text style={styles.actionText}>{t('parent.brain')}</Text>
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => router.push(`/(parent)/progress/${learner.id}` as any)}
                >
                  <Ionicons name="trending-up-outline" size={18} color={colors.success} />
                  <Text style={styles.actionText}>{t('parent.progress')}</Text>
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => router.push(`/(parent)/iep/${learner.id}` as any)}
                >
                  <Ionicons name="document-outline" size={18} color={colors.info} />
                  <Text style={styles.actionText}>{t('parent.iep')}</Text>
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => router.push(`/(parent)/team/${learner.id}` as any)}
                >
                  <Ionicons name="people-outline" size={18} color={colors.accent} />
                  <Text style={styles.actionText}>{t('parent.team')}</Text>
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => router.push(`/(parent)/milestones/${learner.id}` as any)}
                >
                  <Ionicons name="trophy-outline" size={18} color={colors.visualSel} />
                  <Text style={styles.actionText}>{t('parentMilestones.open')}</Text>
                </Pressable>
              </View>
            </AivoCard>
          </Pressable>
        ))
      )}

      <View style={styles.quickActions}>
        <AivoButton
          title={t('parent.tutorStore')}
          onPress={() => router.push('/(parent)/tutors')}
          variant="outline"
          icon={<Ionicons name="storefront-outline" size={18} color={colors.primary} />}
          style={{ flex: 1, marginRight: 8 }}
        />
        <AivoButton
          title={t('parent.billing')}
          onPress={() => router.push('/(parent)/billing')}
          variant="outline"
          icon={<Ionicons name="card-outline" size={18} color={colors.primary} />}
          style={{ flex: 1 }}
        />
      </View>
      </View>
    </ScrollView>
  );

  return <TabletScaffold destinations={railDestinations}>{body}</TabletScaffold>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  greeting: { fontSize: 24, fontFamily: 'Nunito-ExtraBold', color: colors.text },
  subGreeting: { fontSize: 14, fontFamily: 'Nunito-Regular', color: colors.textSecondary, marginTop: 2 },
  logoutBtn: { padding: 8 },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: colors.error,
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontFamily: 'Nunito-Bold',
    lineHeight: 12,
  },
  statsRow: { flexDirection: 'row', marginBottom: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 18, fontFamily: 'Nunito-Bold', color: colors.text },
  childCard: { marginBottom: spacing.md },
  childRow: { flexDirection: 'row', alignItems: 'center' },
  childAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  childInitial: { fontSize: 20, fontFamily: 'Nunito-ExtraBold', color: colors.primary },
  childInfo: { flex: 1, marginLeft: 12 },
  childName: { fontSize: 16, fontFamily: 'Nunito-Bold', color: colors.text },
  childGrade: { fontSize: 13, fontFamily: 'Nunito-Regular', color: colors.textSecondary },
  levelBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  levelText: { fontSize: 11, fontFamily: 'Nunito-SemiBold', color: colors.primary },
  childActions: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    justifyContent: 'space-around',
  },
  actionBtn: { alignItems: 'center', gap: 4 },
  actionText: { fontSize: 12, fontFamily: 'Nunito-SemiBold', color: colors.textSecondary },
  quickActions: { flexDirection: 'row', marginTop: spacing.md },
});
