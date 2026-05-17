import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, Modal, TextInput, ActivityIndicator, Switch } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/hooks/useTranslation';
import {
  useIEPGoals,
  useIEPTimeline,
  useIEPPreferences,
  useSaveIEPPreferences,
  useRespondToAmendment,
  type IEPPrefs,
  type IEPPrefCategory,
  type IEPTimelineItem,
} from '@/hooks/useFamily';
import { AivoCard, AivoButton, LoadingState, EmptyState } from '@aivo/mobile-ui';
import { colors, spacing, radius } from '@/constants/colors';

type Tab = 'goals' | 'updates';
type FilterType = 'all' | 'note' | 'report' | 'amendment' | 'reminder';

export default function IEPScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const { data: goals, isLoading: goalsLoading } = useIEPGoals(childId);
  const { data: timeline, isLoading: timelineLoading } = useIEPTimeline(childId);
  const { data: prefs } = useIEPPreferences();
  const savePrefs = useSaveIEPPreferences();
  const respond = useRespondToAmendment();

  const [tab, setTab] = useState<Tab>('goals');
  const [filter, setFilter] = useState<FilterType>('all');
  const [prefsModalOpen, setPrefsModalOpen] = useState(false);
  const [draftPrefs, setDraftPrefs] = useState<IEPPrefs | null>(null);

  const [respondModal, setRespondModal] = useState<{ id: string; summary: string; mode: 'acknowledged' | 'objected' } | null>(null);
  const [respondNote, setRespondNote] = useState('');

  useEffect(() => {
    if (prefsModalOpen && prefs && !draftPrefs) setDraftPrefs(prefs);
    if (!prefsModalOpen) setDraftPrefs(null);
  }, [prefsModalOpen, prefs, draftPrefs]);

  const filteredItems: IEPTimelineItem[] = (timeline?.items || []).filter(
    (i) => filter === 'all' || i.type === filter
  );

  const handleRespond = async () => {
    if (!respondModal) return;
    try {
      await respond.mutateAsync({
        amendmentId: respondModal.id,
        response: respondModal.mode,
        note: respondNote.trim() || undefined,
        learnerId: childId,
      });
      setRespondModal(null);
      setRespondNote('');
      Alert.alert(t('common.success'), t('parentIEP.responseRecorded'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || t('common.error'));
    }
  };

  const handleSavePrefs = async () => {
    if (!draftPrefs) return;
    try {
      await savePrefs.mutateAsync(draftPrefs);
      setPrefsModalOpen(false);
      Alert.alert(t('common.success'), t('parentIEP.prefsSaved'));
    } catch {
      Alert.alert(t('common.error'), t('parentIEP.prefsSaveFailed'));
    }
  };

  const togglePref = (cat: IEPPrefCategory, channel: 'email' | 'inApp', value: boolean) => {
    if (!draftPrefs) return;
    setDraftPrefs({
      ...draftPrefs,
      [cat]: { ...draftPrefs[cat], [channel]: value },
    });
  };

  const renderTimelineItem = (item: IEPTimelineItem) => {
    const date = new Date(item.at).toLocaleDateString();
    const p = item.payload || {};
    const iconMap: Record<IEPTimelineItem['type'], keyof typeof Ionicons.glyphMap> = {
      note: 'document-text-outline',
      report: 'bar-chart-outline',
      amendment: 'alert-circle-outline',
      reminder: 'calendar-outline',
    };
    return (
      <AivoCard key={`${item.type}-${item.id}`} style={styles.timelineCard}>
        <View style={styles.timelineHeader}>
          <Ionicons name={iconMap[item.type]} size={20} color={colors.primary} />
          <Text style={styles.timelineType}>{t(`parentIEP.type_${item.type}`)}</Text>
          <Text style={styles.timelineDate}>{date}</Text>
        </View>
        {item.type === 'note' && (
          <>
            <Text style={styles.timelineBody}>{p.body}</Text>
            {p.authorName ? <Text style={styles.timelineMeta}>— {p.authorName}{p.authorRole ? ` · ${p.authorRole}` : ''}</Text> : null}
          </>
        )}
        {item.type === 'report' && (
          <>
            <Text style={styles.timelineTitle}>{p.period || t('parentIEP.progressReport')}</Text>
            {p.narrative ? <Text style={styles.timelineBody} numberOfLines={6}>{p.narrative}</Text> : null}
            {p.sentByName ? <Text style={styles.timelineMeta}>— {p.sentByName}</Text> : null}
          </>
        )}
        {item.type === 'amendment' && (
          <>
            <Text style={styles.timelineTitle}>{p.summary}</Text>
            {p.proposedByName ? (
              <Text style={styles.timelineMeta}>{t('parentIEP.proposedBy', { name: p.proposedByName })}</Text>
            ) : null}
            <View style={[styles.amendmentBadge, {
              backgroundColor:
                (p.status === 'merged' || p.status === 'acknowledged') ? colors.success + '20'
                : p.status === 'objected' ? colors.error + '20'
                : colors.accent + '20',
            }]}>
              <Text style={[styles.amendmentBadgeText, {
                color:
                  (p.status === 'merged' || p.status === 'acknowledged') ? colors.success
                  : p.status === 'objected' ? colors.error
                  : colors.accent,
              }]}>{t(`parentIEP.amendStatus_${p.status}`) || p.status}</Text>
            </View>
            {p.status === 'proposed' && (
              <View style={styles.amendmentActions}>
                <AivoButton
                  title={t('parentIEP.acknowledge')}
                  onPress={() => { setRespondModal({ id: p.id || item.id, summary: p.summary, mode: 'acknowledged' }); setRespondNote(''); }}
                  size="sm"
                  style={{ flex: 1 }}
                />
                <AivoButton
                  title={t('parentIEP.object')}
                  onPress={() => { setRespondModal({ id: p.id || item.id, summary: p.summary, mode: 'objected' }); setRespondNote(''); }}
                  variant="outline"
                  size="sm"
                  style={{ flex: 1 }}
                />
              </View>
            )}
          </>
        )}
        {item.type === 'reminder' && (
          <Text style={styles.timelineBody}>
            {t('parentIEP.reviewReminder', {
              threshold: String(p.threshold ?? ''),
              date: p.reviewDate ? new Date(p.reviewDate).toLocaleDateString() : '',
            })}
          </Text>
        )}
      </AivoCard>
    );
  };

  if (goalsLoading) return <LoadingState />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
    >
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>{t('common.back')}</Text>
      </Pressable>

      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('parentIEP.title')}</Text>
          <Text style={styles.subtitle}>{t('parentIEP.subtitle')}</Text>
        </View>
        <Pressable style={styles.prefsBtn} onPress={() => setPrefsModalOpen(true)}>
          <Ionicons name="notifications-outline" size={20} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {(['goals', 'updates'] as Tab[]).map((k) => (
          <Pressable key={k} style={[styles.tab, tab === k && styles.tabActive]} onPress={() => setTab(k)}>
            <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>
              {t(`parentIEP.tab_${k}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'goals' && (
        <>
          <AivoCard style={styles.uploadCard}>
            <Ionicons name="cloud-upload-outline" size={32} color={colors.primary} />
            <Text style={styles.uploadTitle}>{t('parentOnboard.uploadIEP')}</Text>
            <Text style={styles.uploadDesc}>{t('parentIEP.uploadDesc')}</Text>
            <View style={styles.uploadActions}>
              <AivoButton
                title={t('parentIEP.camera')}
                onPress={() => Alert.alert(t('parentIEP.camera'), t('common.comingSoon'))}
                size="sm"
                icon={<Ionicons name="camera-outline" size={16} color="#FFF" />}
                style={{ flex: 1, marginRight: 8 }}
              />
              <AivoButton
                title="PDF"
                onPress={() => Alert.alert('PDF', t('common.comingSoon'))}
                variant="outline"
                size="sm"
                icon={<Ionicons name="document-outline" size={16} color={colors.primary} />}
                style={{ flex: 1 }}
              />
            </View>
          </AivoCard>

          <Text style={[styles.sectionTitle, { marginBottom: spacing.md }]}>{t('parentIEP.iepGoals')}</Text>

          {!goals || goals.length === 0 ? (
            <EmptyState
              icon={<Ionicons name="flag-outline" size={48} color={colors.textSecondary} />}
              title={t('parentIEP.noGoalsTitle')}
              message={t('parentIEP.noGoalsMessage')}
            />
          ) : (
            goals.map((goal: any) => (
              <AivoCard key={goal.id} style={styles.goalCard}>
                <View style={styles.goalHeader}>
                  <Text style={styles.goalTitle}>{goal.title}</Text>
                  <View style={[styles.statusBadge, {
                    backgroundColor: goal.status === 'met' ? colors.success + '20' : colors.info + '20',
                  }]}>
                    <Text style={[styles.statusText, {
                      color: goal.status === 'met' ? colors.success : colors.info,
                    }]}>{goal.status}</Text>
                  </View>
                </View>
                <Text style={styles.goalDesc}>{goal.description}</Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${goal.progress}%` }]} />
                </View>
                <Text style={styles.progressText}>{goal.progress}% {t('parentIEP.complete')}</Text>
              </AivoCard>
            ))
          )}
        </>
      )}

      {tab === 'updates' && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
            {(['all', 'note', 'report', 'amendment', 'reminder'] as FilterType[]).map((f) => (
              <Pressable key={f} style={[styles.filterChip, filter === f && styles.filterChipActive]} onPress={() => setFilter(f)}>
                <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                  {t(`parentIEP.filter_${f}`)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {timelineLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              icon={<Ionicons name="newspaper-outline" size={48} color={colors.textSecondary} />}
              title={t('parentIEP.noUpdatesTitle')}
              message={t('parentIEP.noUpdatesMessage')}
            />
          ) : (
            filteredItems.map(renderTimelineItem)
          )}
        </>
      )}

      {/* Preferences modal */}
      <Modal visible={prefsModalOpen} transparent animationType="slide" onRequestClose={() => setPrefsModalOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPrefsModalOpen(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>{t('parentIEP.prefsTitle')}</Text>
            <Text style={styles.modalDesc}>{t('parentIEP.prefsDesc')}</Text>
            {!draftPrefs ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
            ) : (
              (['progress_notes', 'reports', 'amendments', 'reminders'] as IEPPrefCategory[]).map((cat) => {
                const locked = cat === 'reports' || cat === 'amendments' || cat === 'reminders';
                const p = draftPrefs[cat];
                return (
                  <View key={cat} style={styles.prefRow}>
                    <Text style={styles.prefCat}>{t(`parentIEP.prefCat_${cat}`)}</Text>
                    <View style={styles.prefChannels}>
                      <View style={styles.prefChannel}>
                        <Text style={styles.prefChannelLabel}>{t('parentIEP.email')}</Text>
                        <Switch
                          value={p.email}
                          onValueChange={(v) => togglePref(cat, 'email', v)}
                          disabled={locked && !p.inApp}
                          trackColor={{ false: colors.border, true: colors.primary }}
                        />
                      </View>
                      <View style={styles.prefChannel}>
                        <Text style={styles.prefChannelLabel}>{t('parentIEP.inApp')}</Text>
                        <Switch
                          value={p.inApp}
                          onValueChange={(v) => togglePref(cat, 'inApp', v)}
                          disabled={locked && !p.email}
                          trackColor={{ false: colors.border, true: colors.primary }}
                        />
                      </View>
                    </View>
                    {locked ? (
                      <Text style={styles.prefNote}>{t('parentIEP.prefLockedNote')}</Text>
                    ) : null}
                  </View>
                );
              })
            )}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md }}>
              <AivoButton title={t('common.cancel')} onPress={() => setPrefsModalOpen(false)} variant="outline" size="sm" style={{ flex: 1 }} />
              <AivoButton title={t('common.save')} onPress={handleSavePrefs} loading={savePrefs.isPending} size="sm" style={{ flex: 1 }} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Amendment respond modal */}
      <Modal visible={!!respondModal} transparent animationType="slide" onRequestClose={() => setRespondModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setRespondModal(null)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              {respondModal?.mode === 'acknowledged' ? t('parentIEP.acknowledgeTitle') : t('parentIEP.objectTitle')}
            </Text>
            <Text style={styles.modalDesc}>{respondModal?.summary}</Text>
            <Text style={styles.modalDesc}>
              {respondModal?.mode === 'acknowledged' ? t('parentIEP.acknowledgeDesc') : t('parentIEP.objectDesc')}
            </Text>
            <TextInput
              style={[styles.modalInput, { height: 90, textAlignVertical: 'top' }]}
              value={respondNote}
              onChangeText={setRespondNote}
              placeholder={t('parentIEP.noteOptional')}
              placeholderTextColor={colors.textSecondary}
              multiline
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md }}>
              <AivoButton title={t('common.cancel')} onPress={() => setRespondModal(null)} variant="outline" size="sm" style={{ flex: 1 }} />
              <AivoButton
                title={respondModal?.mode === 'acknowledged' ? t('parentIEP.confirmAcknowledge') : t('parentIEP.confirmObject')}
                onPress={handleRespond}
                loading={respond.isPending}
                size="sm"
                style={{ flex: 1 }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 16, fontFamily: 'Nunito-SemiBold', color: colors.primary },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 24, fontFamily: 'Nunito-ExtraBold', color: colors.text },
  subtitle: { fontSize: 14, fontFamily: 'Nunito-Regular', color: colors.textSecondary, marginBottom: spacing.lg },
  prefsBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radius.full, backgroundColor: colors.surface, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 14, fontFamily: 'Nunito-SemiBold', color: colors.textSecondary },
  tabTextActive: { color: '#FFF' },
  uploadCard: { alignItems: 'center' as const, marginBottom: spacing.lg, paddingVertical: spacing.lg },
  uploadTitle: { fontSize: 16, fontFamily: 'Nunito-Bold', color: colors.text, marginTop: 8 },
  uploadDesc: { fontSize: 13, fontFamily: 'Nunito-Regular', color: colors.textSecondary, marginTop: 4, marginBottom: spacing.md },
  uploadActions: { flexDirection: 'row', width: '100%' },
  sectionTitle: { fontSize: 18, fontFamily: 'Nunito-Bold', color: colors.text },
  goalCard: { marginBottom: spacing.sm },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  goalTitle: { fontSize: 15, fontFamily: 'Nunito-Bold', color: colors.text, flex: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full },
  statusText: { fontSize: 11, fontFamily: 'Nunito-SemiBold' },
  goalDesc: { fontSize: 13, fontFamily: 'Nunito-Regular', color: colors.textSecondary, marginBottom: 8 },
  progressBar: { height: 8, backgroundColor: colors.border, borderRadius: 4, marginBottom: 4 },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  progressText: { fontSize: 12, fontFamily: 'Nunito-SemiBold', color: colors.textSecondary },

  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.surface, marginRight: 8 },
  filterChipActive: { backgroundColor: colors.primary },
  filterChipText: { fontSize: 12, fontFamily: 'Nunito-SemiBold', color: colors.textSecondary },
  filterChipTextActive: { color: '#FFF' },
  timelineCard: { marginBottom: spacing.sm },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  timelineType: { fontSize: 12, fontFamily: 'Nunito-Bold', color: colors.primary, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  timelineDate: { fontSize: 11, fontFamily: 'Nunito-Regular', color: colors.textSecondary, marginLeft: 'auto' },
  timelineTitle: { fontSize: 15, fontFamily: 'Nunito-Bold', color: colors.text, marginBottom: 4 },
  timelineBody: { fontSize: 13, fontFamily: 'Nunito-Regular', color: colors.text, lineHeight: 18 },
  timelineMeta: { fontSize: 12, fontFamily: 'Nunito-SemiBold', color: colors.textSecondary, marginTop: 6 },
  amendmentBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full, marginTop: 8 },
  amendmentBadgeText: { fontSize: 11, fontFamily: 'Nunito-SemiBold' },
  amendmentActions: { flexDirection: 'row', gap: 8, marginTop: spacing.md },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg },
  modalTitle: { fontSize: 18, fontFamily: 'Nunito-Bold', color: colors.text, marginBottom: 6 },
  modalDesc: { fontSize: 13, fontFamily: 'Nunito-Regular', color: colors.textSecondary, marginBottom: spacing.sm },
  modalInput: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, fontSize: 14, fontFamily: 'Nunito-Regular', color: colors.text, backgroundColor: colors.surface, marginTop: spacing.sm },
  prefRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  prefCat: { fontSize: 14, fontFamily: 'Nunito-Bold', color: colors.text, marginBottom: 6 },
  prefChannels: { flexDirection: 'row', gap: 24 },
  prefChannel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prefChannelLabel: { fontSize: 13, fontFamily: 'Nunito-SemiBold', color: colors.textSecondary },
  prefNote: { fontSize: 11, fontFamily: 'Nunito-Regular', color: colors.textSecondary, marginTop: 6, fontStyle: 'italic' as const },
});
