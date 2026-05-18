import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  AppState,
} from "react-native";
import { useLocalSearchParams, router, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useLearners } from "@/hooks/useLearners";
import { useEngagement } from "@/hooks/useEngagement";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { useTierTheme } from "@aivo/mobile-ui";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { useWindowSizeClass } from "@/src/design/useWindowSizeClass";
import { ScratchPad } from "@/src/components/learning/ScratchPad";
import { MobileSessionHeader } from "@/src/components/learning/MobileSessionHeader";
import { MobileStageRuntime } from "@/src/components/learning/MobileStageRuntime";
import { MobileStageCompletion } from "@/src/components/learning/MobileStageCompletion";
import { Button, type DarkCapsuleNavItem } from "@/components/ui";
import { sessionClient, SessionUnavailableError } from "@/src/api/sessionClient";
import { stageClient } from "@/src/api/stageClient";
import { problemSessionClient } from "@/src/api/problemSessionClient";
import type { Beat, Session } from "@/src/types/stage";

// ── Offline outbox ──────────────────────────────────────────────────────────
// Session-end payloads are queued in AsyncStorage when offline and flushed
// when the app regains connectivity.

interface SessionEndPayload {
  sessionId: string;
  masteryUpdates: Record<string, number>;
  xpEarned: number;
  queuedAt: number;
}

const OUTBOX_KEY = "@aivo/session_outbox";

async function getAsyncStorage(): Promise<any> {
  try {
    return (await import("@react-native-async-storage/async-storage")).default;
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
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: authHeader },
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

type TFn = (key: string, options?: Record<string, any>) => string;

const TIER_EMOJI: Record<"EARLY" | "MIDDLE" | "HIGH", (score: number) => string> = {
  EARLY: (score) => (score >= 80 ? "🎉" : score >= 60 ? "👏" : "💪"),
  MIDDLE: (score) => (score >= 80 ? "🦊" : score >= 60 ? "🌙" : "🌿"),
  HIGH: () => "",
};

const TIER_VOICE_KEY: Record<"EARLY" | "MIDDLE" | "HIGH", "early" | "middle" | "high"> = {
  EARLY: "early",
  MIDDLE: "middle",
  HIGH: "high",
};

function buildVoice(tier: "EARLY" | "MIDDLE" | "HIGH", t: TFn) {
  const k = TIER_VOICE_KEY[tier];
  const base = `learnerStage.voice.${k}`;
  return {
    encourage: t(`${base}.encourage`),
    miss: (answer: string) => t(`${base}.miss`, { answer }),
    completionEmoji: TIER_EMOJI[tier],
    completionTitle: t(`${base}.completionTitle`),
    nextLabel: t(`${base}.nextLabel`),
    finishLabel: t(`${base}.finishLabel`),
    homeLabel: t(`${base}.homeLabel`),
    intro: t(`${base}.intro`),
  };
}

// ── Screen ──────────────────────────────────────────────────────────────────

export default function StageScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: learners } = useLearners();
  const learnerId = user?.role === "LEARNER" ? user.id : learners?.[0]?.id || "";
  const { data: engagement } = useEngagement(learnerId);

  const { tier, theme: tierTheme } = useTierTheme();
  const palette = useSensoryPalette();
  // Overlay the active sensory-mode palette on top of the tier theme so
  // calm / high-contrast modes actually re-skin the Stage chrome, not just
  // the role dashboards. Tier still drives the tone (EARLY/MIDDLE/HIGH),
  // sensory mode drives the surface colors and contrast.
  const theme = useMemo(
    () => ({
      ...tierTheme,
      colors: {
        ...tierTheme.colors,
        bg: palette.bgPage,
        surface: palette.bgRaised,
        text: palette.ink,
        textMuted: palette.inkMuted,
        primary: palette.primary,
        border: palette.border,
      },
    }),
    [tierTheme, palette],
  );
  const voice = useMemo(() => buildVoice(tier, t), [tier, t]);
  const { isTablet, isLandscape, sizeClass } = useWindowSizeClass();
  const isExpanded = sizeClass === "expanded";
  // Landscape tablet session-map rail is only shown when there are
  // enough beats to be worth orienting around.
  const showSessionMap = isTablet && isLandscape;

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
      setLoadError(t("learnerStage.error.missingId"));
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
            : t("learnerStage.error.couldNotLoad");
        setLoadError(msg);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, t]);

  // Flush the offline outbox whenever the app comes to the foreground.
  useEffect(() => {
    const authHeader = user ? `Bearer ${(user as any).accessToken ?? ""}` : "";
    const learningBase = (API as any).LEARNING ?? "";
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") flushOutbox(learningBase, authHeader).catch(() => {});
    });
    flushOutbox(learningBase, authHeader).catch(() => {});
    return () => sub.remove();
  }, [user]);

  const total = session?.stagePlan.beats.length ?? 0;

  // ── Beat handlers ─────────────────────────────────────────────────────────

  const recordLedger = useCallback(
    (beat: Beat, outcome: "correct" | "incorrect" | "partial" | "skipped", start: number) => {
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
    async (beat: Extract<Beat, { kind: "choice" }>, answer: string) => {
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
        recordLedger(beat, result.correct ? "correct" : "incorrect", start);
      } catch {
        Alert.alert(
          t("learnerStage.saveError.title"),
          t("learnerStage.saveError.message"),
        );
        setLastCorrect(answer === beat.correctAnswer);
      } finally {
        setSubmitting(false);
      }
    },
    [sessionId, learnerId, answered, submitting, recordLedger],
  );

  const handleMathExpression = useCallback(
    async (beat: Extract<Beat, { kind: "math-expression" }>, expression: string) => {
      if (!sessionId || answered || submitting) return;
      const start = Date.now();
      setSelected(expression);
      setAnswered(true);
      setSubmitting(true);
      try {
        const correct = beat.canonicalAnswer
          ? expression.replace(/\s+/g, "") === beat.canonicalAnswer.replace(/\s+/g, "")
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
          correct === true ? "correct" : correct === false ? "incorrect" : "partial",
          start,
        );
      } finally {
        setSubmitting(false);
      }
    },
    [sessionId, answered, submitting, recordLedger],
  );

  const handleSurfaceSubmit = useCallback(
    async (beat: Extract<Beat, { kind: "surface" }>, _commands: unknown) => {
      if (answered || submitting) return;
      const start = Date.now();
      setAnswered(true);
      setSubmitting(true);
      recordLedger(beat, "partial", start);
      setSubmitting(false);
    },
    [answered, submitting, recordLedger],
  );

  const handleTutorTurnContinue = useCallback(
    async (beat: Extract<Beat, { kind: "tutor-turn" }>) => {
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
      [session.meta.subject || "lesson"]: score,
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
      Alert.alert(t("learnerStage.offline.title"), t("learnerStage.offline.message"));
    }
  }, [session, sessionId, currentIndex, total, correctCount, xpEarned, t]);

  const handlePause = useCallback(() => {
    Alert.alert(
      tier === "HIGH"
        ? t("learnerStage.pause.titleStandard")
        : t("learnerStage.pause.titleSoft"),
      t("learnerStage.pause.message"),
      [
        {
          text:
            tier === "EARLY"
              ? t("learnerStage.pause.keepGoingSoft")
              : t("learnerStage.pause.keepGoing"),
          style: "cancel",
        },
        { text: t("learnerStage.pause.exit"), onPress: () => router.back() },
      ],
    );
  }, [tier, t]);

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
              : t("learnerStage.error.couldNotLoad");
          setLoadError(msg);
        });
    };
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.errorState} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={48} color={theme.colors.text} />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>{loadError}</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Button title={t("learnerStage.error.tryAgain")} onPress={retry} variant="primary" />
            <Button
              title={t("learnerStage.error.backToHome")}
              onPress={() => router.replace("/(learner)" as Href)}
              variant="outline"
            />
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
            {t("learnerStage.loading")}
          </Text>
        </View>
      </View>
    );
  }

  const learnerName = user?.name || t("learnerStage.learner");
  const learnerSubtitle =
    engagement?.level != null ? t("learnerStage.level", { level: engagement.level }) : undefined;

  const completionNavItems: DarkCapsuleNavItem[] = !isTablet
    ? [
        {
          key: "map",
          label: t("learnerStage.nav.map"),
          icon: "map",
          active: true,
          onPress: () => router.replace("/(learner)" as Href),
        },
        {
          key: "brain",
          label: t("learnerStage.nav.brain"),
          icon: "bulb",
          onPress: () => router.replace("/(learner)/brain" as Href),
        },
        {
          key: "stats",
          label: t("learnerStage.nav.stats"),
          icon: "trophy",
          onPress: () => router.replace("/(learner)/gamification" as Href),
        },
        {
          key: "settings",
          label: t("learnerStage.nav.settings"),
          icon: "settings",
          onPress: () => router.replace("/(learner)/settings" as Href),
        },
      ]
    : [];

  if (sessionComplete) {
    const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    return (
      <MobileStageCompletion
        tier={tier}
        correctCount={correctCount}
        total={total}
        xpEarned={xpEarned + 5}
        emoji={voice.completionEmoji(score)}
        title={voice.completionTitle}
        homeLabel={voice.homeLabel}
        onHome={() => router.back()}
        paddingTop={insets.top}
        navItems={completionNavItems}
      />
    );
  }

  const scratchToggle = isTablet ? (
    <Pressable
      onPress={() => setScratchOpen((s) => !s)}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityState={{ selected: scratchOpen }}
      accessibilityLabel={
        scratchOpen
          ? t("learnerStage.header.closeScratchpad")
          : t("learnerStage.header.openScratchpad")
      }
      style={({ pressed }) => [
        styles.scratchToggle,
        {
          backgroundColor: scratchOpen ? palette.primary : palette.bgRaised,
          borderColor: scratchOpen ? palette.primary : palette.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Ionicons
        name={scratchOpen ? "close" : "pencil"}
        size={20}
        color={scratchOpen ? palette.primaryFg : palette.ink}
      />
    </Pressable>
  ) : null;

  return (
    <View style={styles.container}>
      <MobileSessionHeader
        beatCount={total}
        currentIndex={currentIndex}
        userName={learnerName}
        userSubtitle={learnerSubtitle}
        onClose={() => router.back()}
        onPause={handlePause}
        scratchpadButton={scratchToggle}
        paddingTop={insets.top}
      />

      <View style={[styles.stageRow, { flexDirection: isTablet ? "row" : "column" }]}>
        <View
          style={[
            styles.stageColumn,
            // On expanded (≥840dp) tablets, cap the runtime column so
            // answer-target cards stretch to a comfortable column width
            // (not the full screen width) — paired with the scratchpad
            // and session-map rails when those are open.
            isExpanded && { maxWidth: 720, alignSelf: "center", width: "100%" },
          ]}
        >
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

        {showSessionMap && session ? (
          <View
            style={[
              styles.sessionMapRail,
              { backgroundColor: palette.bgRaised, borderColor: palette.border },
            ]}
            accessibilityLabel={t("learnerStage.sessionMap")}
          >
            <Text
              style={[
                styles.sessionMapTitle,
                { color: palette.inkMuted },
              ]}
            >
              {t("learnerStage.sessionMap")}
            </Text>
            {session.stagePlan.beats.map((beat, i) => {
              const isCurrent = i === currentIndex;
              const isDone = i < currentIndex;
              return (
                <View
                  key={beat.id ?? `beat-${i}`}
                  style={[
                    styles.sessionMapItem,
                    {
                      backgroundColor: isCurrent ? palette.primary : "transparent",
                      borderColor: isCurrent ? palette.primary : palette.border,
                    },
                  ]}
                  accessibilityState={{ selected: isCurrent }}
                >
                  <View
                    style={[
                      styles.sessionMapDot,
                      {
                        backgroundColor: isDone
                          ? palette.primary
                          : isCurrent
                            ? palette.primaryFg
                            : palette.border,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.sessionMapLabel,
                      {
                        color: isCurrent ? palette.primaryFg : palette.ink,
                        fontFamily: isCurrent ? fontFamilies.bodyBold : fontFamilies.bodyRegular,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {t("learnerStage.beatLabel", { index: i + 1 })}
                  </Text>
                </View>
              );
            })}
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
      overflow: "hidden",
    },
    errorState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      padding: 32,
    },
    errorText: { fontSize: 18, textAlign: "center" },
    scratchToggle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    sessionMapRail: {
      width: 200,
      margin: spacing.md,
      marginLeft: 0,
      padding: spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      gap: 6,
    },
    sessionMapTitle: {
      fontSize: 11,
      fontFamily: "Nunito-Bold",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    sessionMapItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      borderWidth: 1,
    },
    sessionMapDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    sessionMapLabel: {
      fontSize: 13,
      flex: 1,
    },
  });
}
