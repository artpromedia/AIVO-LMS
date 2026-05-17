import React, { useState } from 'react';
import { Text, TextInput, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/hooks/useTranslation';
import { AivoCard, AivoButton } from '@aivo/mobile-ui';
import { colors, spacing, radius } from '@/constants/colors';

export default function SubmitInsightScreen() {
  const { t } = useTranslation();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- route param reserved for future use
  const { id: _id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [insightText, setInsightText] = useState('');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>{t('common.back')}</Text>
      </Pressable>
      <Text style={styles.title}>{t('teacherInsight.title')}</Text>
      <Text style={styles.subtitle}>{t('teacherInsight.subtitle')}</Text>

      <AivoCard>
        <Text style={styles.label}>{t('teacherInsight.yourInsight')}</Text>
        <TextInput
          style={styles.textArea}
          value={insightText}
          onChangeText={setInsightText}
          placeholder={t('teacherInsight.placeholder')}
          placeholderTextColor={colors.textSecondary}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
        <AivoButton
          title={t('teacherInsight.title')}
          onPress={() => { Alert.alert(t('common.success'), t('teacherInsight.submitted')); router.back(); }}
          disabled={!insightText.trim()}
          style={{ marginTop: spacing.md }}
        />
      </AivoCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 16, fontFamily: 'Nunito-SemiBold', color: colors.primary },
  title: { fontSize: 24, fontFamily: 'Nunito-ExtraBold', color: colors.text },
  subtitle: { fontSize: 14, fontFamily: 'Nunito-Regular', color: colors.textSecondary, marginBottom: spacing.lg },
  label: { fontSize: 14, fontFamily: 'Nunito-SemiBold', color: colors.text, marginBottom: 6 },
  textArea: {
    minHeight: 120,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 15,
    fontFamily: 'Nunito-Regular',
    color: colors.text,
    backgroundColor: colors.surface,
  },
});
