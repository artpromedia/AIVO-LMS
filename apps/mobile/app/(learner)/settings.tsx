import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/hooks/useAuth';
import { AivoCard, AivoButton } from '@aivo/mobile-ui';
import { colors, spacing, radius } from '@/constants/colors';

const STORAGE_KEY = 'aivo_learner_prefs_v1';

interface LearnerPrefs {
  soundEffects: boolean;
  music: boolean;
  animations: boolean;
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
}

const DEFAULT_PREFS: LearnerPrefs = {
  soundEffects: true,
  music: true,
  animations: true,
  highContrast: false,
  largeText: false,
  reducedMotion: false,
};

export default function LearnerSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<LearnerPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Partial<LearnerPrefs>;
            setPrefs({ ...DEFAULT_PREFS, ...parsed });
          } catch {
            // ignore parse errors and use defaults
          }
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  const update = useCallback(<K extends keyof LearnerPrefs>(key: K, value: LearnerPrefs[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }, [prefs]);

  if (!loaded) return null;

  const renderToggleRow = (
    key: keyof LearnerPrefs,
    titleKey: string,
    descKey: string,
  ) => (
    <View style={styles.toggleRow} key={key}>
      <View style={{ flex: 1, paddingRight: spacing.sm }}>
        <Text style={styles.toggleTitle}>{t(titleKey)}</Text>
        <Text style={styles.toggleDesc}>{t(descKey)}</Text>
      </View>
      <Switch
        value={prefs[key]}
        onValueChange={(v) => update(key, v)}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.card}
        accessibilityLabel={t(titleKey)}
      />
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{t('learnerSettings.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <AivoCard style={styles.card}>
        <Text style={styles.sectionTitle}>{t('learnerSettings.profile')}</Text>
        <View style={styles.profileRow}>
          <Text style={styles.profileLabel}>{t('learnerSettings.name')}</Text>
          <Text style={styles.profileValue}>{user?.name ?? '—'}</Text>
        </View>
        <View style={styles.profileRow}>
          <Text style={styles.profileLabel}>{t('learnerSettings.role')}</Text>
          <Text style={[styles.profileValue, { color: colors.primary }]}>
            {t('learnerSettings.learner')}
          </Text>
        </View>
      </AivoCard>

      <AivoCard style={styles.card}>
        <Text style={styles.sectionTitle}>{t('learnerSettings.soundAndMotion')}</Text>
        {renderToggleRow('soundEffects', 'learnerSettings.soundEffects', 'learnerSettings.soundEffectsDesc')}
        {renderToggleRow('music', 'learnerSettings.music', 'learnerSettings.musicDesc')}
        {renderToggleRow('animations', 'learnerSettings.animations', 'learnerSettings.animationsDesc')}
      </AivoCard>

      <AivoCard style={styles.card}>
        <Text style={styles.sectionTitle}>{t('learnerSettings.accessibility')}</Text>
        {renderToggleRow('highContrast', 'learnerSettings.highContrast', 'learnerSettings.highContrastDesc')}
        {renderToggleRow('largeText', 'learnerSettings.largeText', 'learnerSettings.largeTextDesc')}
        {renderToggleRow('reducedMotion', 'learnerSettings.reducedMotion', 'learnerSettings.reducedMotionDesc')}
      </AivoCard>

      {saved && (
        <View style={styles.savedBanner}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.savedText}>{t('learnerSettings.saved')}</Text>
        </View>
      )}

      <AivoButton
        title={t('learnerSettings.saveChanges')}
        onPress={handleSave}
        style={{ marginTop: spacing.md }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: { fontSize: 22, fontFamily: 'Nunito-ExtraBold', color: colors.text },
  card: { marginBottom: spacing.md },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Nunito-Bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  profileLabel: {
    fontSize: 12,
    fontFamily: 'Nunito-SemiBold',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  profileValue: { fontSize: 14, fontFamily: 'Nunito-Bold', color: colors.text },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toggleTitle: { fontSize: 14, fontFamily: 'Nunito-Bold', color: colors.text },
  toggleDesc: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    color: colors.textSecondary,
    marginTop: 2,
  },
  savedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: colors.success + '1A',
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  savedText: { fontSize: 13, fontFamily: 'Nunito-SemiBold', color: colors.success },
});
