import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/hooks/useTranslation';
import { useConnectedLearners } from '@/hooks/useFamily';
import { AivoCard, EmptyState } from '@aivo/mobile-ui';
import { colors, spacing, radius } from '@/constants/colors';

interface ConnectedLearner {
  id: string;
  name: string;
  functioningLevel: string | null;
  gradeLevel: string | null;
}

interface ReportCardSpec {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  titleKey: string;
  cadenceKey: string;
  descKey: string;
}

const REPORT_CARDS: ReportCardSpec[] = [
  {
    key: 'weeklyMastery',
    icon: 'bar-chart',
    tint: colors.primary,
    titleKey: 'teacherReports.weeklyMasteryTitle',
    cadenceKey: 'teacherReports.cadenceWeekly',
    descKey: 'teacherReports.weeklyMasteryDesc',
  },
  {
    key: 'atRisk',
    icon: 'warning',
    tint: colors.accent,
    titleKey: 'teacherReports.atRiskTitle',
    cadenceKey: 'teacherReports.cadenceDaily',
    descKey: 'teacherReports.atRiskDesc',
  },
  {
    key: 'engagement',
    icon: 'trending-up',
    tint: colors.info,
    titleKey: 'teacherReports.engagementTitle',
    cadenceKey: 'teacherReports.cadenceWeekly',
    descKey: 'teacherReports.engagementDesc',
  },
  {
    key: 'iepProgress',
    icon: 'flag',
    tint: colors.success,
    titleKey: 'teacherReports.iepProgressTitle',
    cadenceKey: 'teacherReports.cadenceMonthly',
    descKey: 'teacherReports.iepProgressDesc',
  },
];

export default function TeacherAnalyticsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: learnersRaw } = useConnectedLearners();
  const learners: ConnectedLearner[] = Array.isArray(learnersRaw) ? learnersRaw : [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
    >
      <Text style={styles.title}>{t('teacherReports.title')}</Text>
      <Text style={styles.subtitle}>{t('teacherReports.subtitle')}</Text>

      <View style={styles.cardsGrid}>
        {REPORT_CARDS.map((card) => (
          <AivoCard key={card.key} style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <View style={[styles.iconBubble, { backgroundColor: card.tint + '22' }]}>
                <Ionicons name={card.icon} size={20} color={card.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.reportTitle}>{t(card.titleKey)}</Text>
                <Text style={styles.reportCadence}>{t(card.cadenceKey)}</Text>
              </View>
            </View>
            <Text style={styles.reportDesc}>{t(card.descKey)}</Text>
          </AivoCard>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
        {t('teacherReports.studentOverview')}
      </Text>
      {learners.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="people-outline" size={48} color={colors.textSecondary} />}
          title={t('teacherReports.noLearnersTitle')}
          message={t('teacherReports.noLearnersMessage')}
        />
      ) : (
        learners.map((l) => (
          <AivoCard key={l.id} style={{ marginBottom: spacing.sm }}>
            <View style={styles.rosterHeader}>
              <Text style={styles.rosterName}>{l.name}</Text>
              <View style={styles.functioningBadge}>
                <Text style={styles.functioningBadgeText}>
                  {l.functioningLevel || t('teacherReports.pending')}
                </Text>
              </View>
            </View>
            <Text style={styles.rosterMeta}>
              {t('teacherReports.gradeLabel')}: {l.gradeLevel || '—'}
            </Text>
          </AivoCard>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  title: { fontSize: 24, fontFamily: 'Nunito-ExtraBold', color: colors.text },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  cardsGrid: { gap: spacing.sm },
  reportCard: { marginBottom: spacing.sm },
  reportHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 6 },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportTitle: { fontSize: 15, fontFamily: 'Nunito-Bold', color: colors.text },
  reportCadence: { fontSize: 11, fontFamily: 'Nunito-Regular', color: colors.textSecondary },
  reportDesc: { fontSize: 13, fontFamily: 'Nunito-Regular', color: colors.textSecondary },
  sectionTitle: { fontSize: 18, fontFamily: 'Nunito-Bold', color: colors.text },
  rosterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rosterName: { fontSize: 15, fontFamily: 'Nunito-Bold', color: colors.text, flex: 1 },
  rosterMeta: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    color: colors.textSecondary,
    marginTop: 4,
  },
  functioningBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.primary + '1A',
  },
  functioningBadgeText: { fontSize: 11, fontFamily: 'Nunito-Bold', color: colors.primary },
});
