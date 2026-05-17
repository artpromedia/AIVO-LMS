import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  AppState,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/hooks/useAuth';
import { useLearners } from '@/hooks/useLearners';
import { apiFetch } from '@/lib/api';
import { API } from '@/constants/api';
import { spacing } from '@/constants/colors';
import { useTierTheme } from '@aivo/mobile-ui';
import { useWindowSizeClass } from '@/src/design/useWindowSizeClass';
import { ScratchPad } from '@/src/components/learning/ScratchPad';
import { MobileSessionHeader } from '@/src/components/learning/MobileSessionHeader';
import { MobileStageRuntime } from '@/src/components/learning/MobileStageRuntime';
import { MobileStageCompletion } from '@/src/components/learning/MobileStageCompletion';
import {
  sessionClient,
  SessionUnavailableError,
} from '@/src/api/sessionClient';
import { stageClient } from '@/src/api/stageClient';
import { problemSessionClient } from '@/src/api/problemSessionClient';
import type { Beat, Session } from '@/src/types/stage';

// ── Offline outbox ──────────────────────────────────────────────────────────
// Session-end payloads are queued in AsyncStorage when offline and flushed
// when the app regains connectivity.

interface SessionEndPayload {
  sessionId: string;
  masteryUpdates: Record<string, number>;
  xpEarned: number;
  queuedAt: number;
}

const OUTBOX_KEY = '@aivo/session_outbox';

async function getAsyncStorage(): Promise<any> {
  try {
    return (await import('@react-native-async-storage/async-storage')).default;
  } catch {
    return null;
  }
}

async function queueSessionEnd(payload: SessionEndPayload): Promise<void> {
  const AsyncStorage = await getAsyncStorage();
  if (!AsyncStorage) return;
  try {
    const raw = await AsyncStorage.getItem(OUTBOX_KEY);
    const outbox: SessionEndPayload[] = raw ? JSON.parse(raw) : [];
    outbox.push(payload);
    await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
  } catch {
    /* best effort */
  }
}

async function flushOutbox(learningApiBase: string, authHeader: string): Promise<void> {
  const AsyncStorage = await getAsyncStorage();
  if (!AsyncStorage) return;
  try {
    const raw = await AsyncStorage.getItem(OUTBOX_KEY);
    if (!raw) return;
    const outbox: SessionEndPayload[] = JSON.parse(raw);
    if (outbox.length === 0) return;
    const remaining: SessionEndPayload[] = [];
    for (const payload of outbox) {
      try {
        const res = await fetch(
          `${learningApiBase}/api/learning/sessions/${payload.sessionId}/complete`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: authHeader },
            body: JSON.stringify({
              masteryUpdates: payload.masteryUpdates,
              xpEarned: payload.xpEarned,
            }),
          },
        );
        if (!res.ok) remaining.push(payload);
      } catch {
        remaining.push(payload);
      }
    }
    await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(remaining));
  } catch {
    /* best effort */
  }
}

// ── Tier voice ──────────────────────────────────────────────────────────────

const TIER_VOICE = {
  EARLY: {
    encourage: '🎉 Yay! You got it!',
    miss: (answer: string) => `Almost! Sora says it's ${answer}!`,
    completionEmoji: (score: number) => (score >= 80 ? '🎉' : score >= 60 ? '👏' : '💪'),
    completionTitle: 'Adventure complete!',
    nextLabel: 'Next →',
    finishLabel: 'Yay! All done',
    homeLabel: 'Back to the meadow',
    intro: 'Let’s solve this together!',
  },
  MIDDLE: {
    encourage: 'Solid. Kai nods approvingly.',
    miss: (answer: string) => `Close. The answer was ${answer}.`,
    completionEmoji: (score: number) => (score >= 80 ? '🦊' : score >= 60 ? '🌙' : '🌿'),
    completionTitle: 'Session wrapped',
    nextLabel: 'Next question',
    finishLabel: 'Wrap session',
    homeLabel: 'Back to the treehouse',
    intro: 'Take your time.',
  },
  HIGH: {
    encourage: 'Correct.',
    miss: (answer: string) => `Not quite — answer: ${answer}`,
    completionEmoji: () => '',
    completionTitle: 'Session complete',
    nextLabel: 'Next',
    finishLabel: 'Finish',
    homeLabel: 'Return to dashboard',
    intro: 'Begin when ready.',
  },
} as const;

// ── Screen ──────────────────────────────────────────────────────────────────

export default function StageScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const insets = useSafeAreaInsets();
  const { t: _t } = useTranslation();
  const { user } = useAuth();
  const { data: learners } = useLearners();
  const learnerId =
    user?.role === 'LEARNER' ? user.id : learners?.[0]?.id || '';

  const { tier, theme } = useTierTheme();
  const voice = TIER_VOICE[tier];
  const { isTablet } = useWindowSizeClass();

  const [session, setSession] = useState<Session | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scratchOpen, setScratchOpen] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);

  // Load the session from the server. No demo fallback.
  useEffect(() => {
    let cancelled = false;
    if (!sessionId) {
      setLoadError('Missing session id');
      return;
    }
    setLoadError(null);
    setSession(null);
    sessionClient
      .getSession(sessionId)
      .then((s) => {
        if (cancelled) return;
        setSession(s);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg =
          err instanceof SessionUnavailableError
            ? err.message
            : 'Could not load this session.';
        setLoadError(msg);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Flush the offline outbox whenever the app comes to the foreground.
  useEffect(() => {
    const authHeader = user ? `Bearer ${(user as any).accessToken ?? ''}` : '';
    const learningBase = (API as any).LEARNING ?? '';
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') flushOutbox(learningBase, authHeader).catch(() => {});
    });
    flushOutbox(learningBase, authHeader).catch(() => {});
    return () => sub.remove();
  }, [user]);

  const total = session?.stagePlan.beats.length ?? 0;

  // ── Beat handlers ─────────────────────────────────────────────────────────

  const recordLedger = useCallback(
    (beat: Beat, outcome: 'correct' | 'incorrect' | 'partial' | 'skipped', start: number) => {
      if (!sessionId || !learnerId) return;
      const skill = (beat as { skill?: string }).skill;
      void problemSessionClient
        .record({
          sessionId,
          learnerId,
          beatId: beat.id,
          skill,
          outcome,
          responseTimeMs: Date.now() - start,
          timestamp: new Date().toISOString(),
        })
        .catch(() => {});
    },
    [sessionId, learnerId],
  );

  const handleChoiceAnswer = useCallback(
    async (beat: Extract<Beat, { kind: 'choice' }>, answer: string) => {
      if (!sessionId || answered || submitting) return;
      const start = Date.now();
      setSelected(answer);
      setAnswered(true);
      setSubmitting(true);
      try {
        const result = await stageClient.submitChoice({
          sessionId,
          learnerId,
          beat,
          answer,
        });
        setLastCorrect(result.correct);
        if (result.correct) {
          setCorrectCount((c) => c + 1);
          setXpEarned((xp) => xp + 10);
        } else {
          setXpEarned((xp) => xp + 2);
        }
        recordLedger(beat, result.correct ? 'correct' : 'incorrect', start);
      } catch {
        Alert.alert('Warning', 'Could not save your answer. It may not be recorded.');
        setLastCorrect(answer === beat.correctAnswer);
      } finally {
        setSubmitting(false);
      }
    },
    [sessionId, learnerId, answered, submitting, recordLedger],
  );

  const handleMathExpression = useCallback(
    async (beat: Extract<Beat, { kind: 'math-expression' }>, expression: string) => {
      if (!sessionId || answered || submitting) return;
      const start = Date.now();
      setSelected(expression);
      setAnswered(true);
      setSubmitting(true);
      try {
        const correct = beat.canonicalAnswer
          ? expression.replace(/\s+/g, '') === beat.canonicalAnswer.replace(/\s+/g, '')
          : null;
        setLastCorrect(correct);
        if (correct) {
          setCorrectCount((c) => c + 1);
          setXpEarned((xp) => xp + 10);
        } else if (correct === false) {
          setXpEarned((xp) => xp + 2);
        }
        recordLedger(
          beat,
          correct === true ? 'correct' : correct === false ? 'incorrect' : 'partial',
          start,
        );
      } finally {
        setSubmitting(false);
      }
    },
    [sessionId, answered, submitting, recordLedger],
  );

  const handleSurfaceSubmit = useCallback(
    async (beat: Extract<Beat, { kind: 'surface' }>, _commands: unknown) => {
      if (answered || submitting) return;
      const start = Date.now();
      setAnswered(true);
      setSubmitting(true);
      recordLedger(beat, 'partial', start);
      setSubmitting(false);
    },
    [answered, submitting, recordLedger],
  );

  const handleTutorTurnContinue = useCallback(
    async (beat: Extract<Beat, { kind: 'tutor-turn' }>) => {
      await stageClient.ackBeat(beat);
      // tutor-turn auto-advances; we just step the index.
      setSelected(null);
      setAnswered(false);
      setLastCorrect(null);
      setCurrentIndex((i) => i + 1);
    },
    [],
  );

  const handleAdvance = useCallback(async () => {
    if (!session) return;
    if (currentIndex < total - 1) {
      setSelected(null);
      setAnswered(false);
      setLastCorrect(null);
      setCurrentIndex((i) => i + 1);
      return;
    }
    setSessionComplete(true);
    if (!sessionId) return;
    const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const masteryUpdates: Record<string, number> = {
      [session.meta.subject || 'lesson']: score,
    };
    try {
      await sessionClient.completeSession({
        sessionId,
        masteryUpdates,
        xpEarned: xpEarned + 5,
        beatsCompleted: total,
      });
    } catch {
      await queueSessionEnd({
        sessionId,
        masteryUpdates,
        xpEarned: xpEarned + 5,
        queuedAt: Date.now(),
      });
      Alert.alert('Saved offline', 'Your session results will sync when you’re back online.');
    }
  }, [session, sessionId, currentIndex, total, correctCount, xpEarned]);

  const handlePause = useCallback(() => {
    Alert.alert(
      tier === 'HIGH' ? 'Pause session' : 'Pause Session',
      'Your progress will be saved. Continue later?',
      [
        { text: tier === 'EARLY' ? 'Keep going!' : 'Keep going', style: 'cancel' },
        { text: 'Pause & exit', onPress: () => router.back() },
      ],
    );
  }, [tier]);

  // ── Render ────────────────────────────────────────────────────────────────

  const styles = useMemo(() => createStyles(theme.colors.bg), [theme.colors.bg]);

  if (loadError) {
    const retry = () => {
      if (!sessionId) return;
      setLoadError(null);
      setSession(null);
      sessionClient
        .getSession(sessionId)
        .then((s) => setSession(s))
        .catch((err: unknown) => {
          const msg =
            err instanceof SessionUnavailableError
              ? err.message
              : 'Could not load this session.';
          setLoadError(msg);
        });
    };
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.errorState} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={48} color={theme.colors.text} />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>{loadError}</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              style={[styles.errorBtn, { backgroundColor: theme.colors.primary }]}
              onPress={retry}
              accessibilityRole="button"
              accessibilityLabel="Try again"
            >
              <Text style={{ color: theme.colors.surface, fontWeight: '700' }}>Try again</Text>
            </Pressable>
            <Pressable
              style={[styles.errorBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.primary }]}
              onPress={() => router.replace('/(learner)' as any)}
              accessibilityRole="button"
              accessibilityLabel="Back to home"
            >
              <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Back to home</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.errorState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>
            Preparing your session…
          </Text>
        </View>
      </View>
    );
  }

  if (sessionComplete) {
    const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    return (
      <MobileStageCompletion
        theme={theme}
        tier={tier}
        correctCount={correctCount}
        total={total}
        xpEarned={xpEarned + 5}
        emoji={voice.completionEmoji(score)}
        title={voice.completionTitle}
        homeLabel={voice.homeLabel}
        onHome={() => router.back()}
        paddingTop={insets.top}
      />
    );
  }

  const scratchToggle = isTablet ? (
    <Pressable
      onPress={() => setScratchOpen((s) => !s)}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={scratchOpen ? 'Close scratchpad' : 'Open scratchpad'}
    >
      <Ionicons
        name={scratchOpen ? 'close-circle-outline' : 'pencil'}
        size={26}
        color={scratchOpen ? theme.colors.primary : theme.colors.text}
      />
    </Pressable>
  ) : null;

  return (
    <View style={styles.container}>
      <MobileSessionHeader
        theme={theme}
        beatCount={total}
        currentIndex={currentIndex}
        onClose={() => router.back()}
        onPause={handlePause}
        scratchpadButton={scratchToggle}
        paddingTop={insets.top}
      />

      <View style={[styles.stageRow, { flexDirection: isTablet ? 'row' : 'column' }]}>
        <View style={styles.stageColumn}>
          <MobileStageRuntime
            theme={theme}
            tier={tier}
            session={session}
            currentIndex={currentIndex}
            labels={{
              next: voice.nextLabel,
              finish: voice.finishLabel,
              encourage: voice.encourage,
              miss: voice.miss,
              intro: voice.intro,
            }}
            submitting={submitting}
            selected={selected}
            answered={answered}
            lastCorrect={lastCorrect}
            onChoiceAnswer={handleChoiceAnswer}
            onMathExpression={handleMathExpression}
            onSurfaceSubmit={handleSurfaceSubmit}
            onTutorTurnContinue={handleTutorTurnContinue}
            onAdvance={handleAdvance}
          />
        </View>

        {isTablet && scratchOpen ? (
          <View style={styles.scratchSide}>
            <ScratchPad gridPaper compactToolbar />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(bg: string) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: bg },
    stageRow: { flex: 1 },
    stageColumn: { flex: 1 },
    scratchSide: {
      flex: 1,
      margin: spacing.md,
      marginLeft: 0,
      borderRadius: 16,
      overflow: 'hidden',
    },
    errorState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: 32,
    },
    errorText: { fontSize: 18, textAlign: 'center' },
    errorBtn: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 24,
    },
  });
}
