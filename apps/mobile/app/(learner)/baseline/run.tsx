import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Speech from "expo-speech";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { Card, Button } from "@/components/ui";
import { LoadingState } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import {
  initBaseline,
  pickNextItem,
  recordResponse,
  shouldStop,
  assessFrustration,
  BASELINE_BREAK_EVERY,
  type BaselineItem,
  type BaselineState,
  type ItemResponse,
} from "@aivo/adaptive-baseline";
import {
  fetchBaselineQuestions,
  completeBaseline,
  difficultyToTheta,
  capChoices,
  FL_MAX_CHOICES,
  FL_AUDIO_FIRST,
  type BaselineQuestion,
  type BaselineChoice,
  type FunctioningLevel,
} from "@/src/api/baselineClient";

// Shared brand companion robot (same friendly figure as web + the landing
// page). Replaces any emoji host so the baseline always has a warm guide.
const AIVO_COMPANION_PNG = require("@/assets/images/aivo-companion.png");

/**
 * Learner adaptive baseline runner (MOB-LRN-005) — mirror of web's
 * /learner/baseline/[baselineId]. Item selection is driven by the real
 * `@aivo/adaptive-baseline` engine (1-PL θ), not a static next-index walk:
 * each answer updates θ and the engine picks the next item nearest θ (with a
 * frustration "kindness ceiling" so a struggling learner is never pushed
 * harder), spreads across the learner's subjects, and stops early once the
 * estimate is confident (SE ≤ 0.35 after ≥ 6 items, hard cap 20).
 *
 * Questions come from assessment-svc (`/api/assessments/learner/baseline/
 * :learnerId`), which serves an AI-generated set or a curated fallback bank
 * — so there is no hardcoded client-side item source. The break cadence is
 * the engine's shared `BASELINE_BREAK_EVERY`, not a local literal, so web and
 * mobile pace the baseline identically.
 *
 * Nothing here is shown as a score/grade: correctness is recorded silently to
 * drive selection + the strengths-first parent handoff, and a self-paced skip
 * ("Not sure") never reads as failure.
 */

// Engine hard cap (MAX_ITEMS in @aivo/adaptive-baseline). Used only as an
// upper bound for the calm "Question n of N" label — the run usually stops
// earlier once θ is confident.
const MAX_ITEMS_DISPLAY = 20;

type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "not_ready"; message: string }
  | { kind: "ready"; questions: BaselineQuestion[]; functioningLevel: FunctioningLevel };

/** Silently-recorded outcome for one item (never shown to the learner). */
type ItemRecord = {
  subject: string;
  difficulty: number;
  correct: boolean;
  skipped: boolean;
  latencyMs: number;
};

const EMPTY_QUESTIONS: BaselineQuestion[] = [];

export default function LearnerBaselineRunScreen() {
  const { t, i18n } = useTranslation();
  const palette = useSensoryPalette();
  const { user } = useAuth();
  const learnerId = user?.id ?? "";

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  // Adaptive engine state + the id of the item currently on screen.
  const [engine, setEngine] = useState<BaselineState | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  // Items the learner skipped — excluded from the bank we offer the engine so
  // a skip is "seen" without an unfair θ penalty (mirrors the web bridge).
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  // Per-item record (correctness captured SILENTLY) for the parent handoff.
  const [responses, setResponses] = useState<ItemRecord[]>([]);
  // "Listen instead" modality switch offered on a break — never shame, just a
  // calmer way in. Sticky for the rest of the run once chosen.
  const [listenMode, setListenMode] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [done, setDone] = useState(false);
  // When the current item first became visible — used to measure response
  // latency (process signal), reset on advance and after a break.
  const [qStartedAt, setQStartedAt] = useState(() => Date.now());

  const questions = state.kind === "ready" ? state.questions : EMPTY_QUESTIONS;
  const functioningLevel: FunctioningLevel =
    state.kind === "ready" ? state.functioningLevel : "STANDARD";
  const audioFirst = FL_AUDIO_FIRST[functioningLevel] || listenMode;
  const maxChoices = FL_MAX_CHOICES[functioningLevel];

  // Display question lookup + the engine bank (BaselineItem[]) derived from it.
  // `subject` doubles as the engine skill so selection spreads across the
  // learner's subjects; numeric difficulty is calibrated onto the θ logit scale.
  const byId = useMemo(() => {
    const m = new Map<string, BaselineQuestion>();
    for (const q of questions) m.set(q.id, q);
    return m;
  }, [questions]);

  const bank = useMemo<BaselineItem[]>(
    () =>
      questions.map((q) => ({
        id: q.id,
        skillId: q.subject,
        subjectId: q.subject,
        difficulty: difficultyToTheta(q.difficulty),
        modalities: ["visual", "auditory"] as const,
        lightReading: false,
      })),
    [questions],
  );

  const engItemById = useMemo(() => {
    const m = new Map<string, BaselineItem>();
    for (const it of bank) m.set(it.id, it);
    return m;
  }, [bank]);

  const load = useCallback(async () => {
    if (!learnerId) {
      setState({ kind: "error" });
      return;
    }
    setState({ kind: "loading" });
    setEngine(null);
    setCurrentId(null);
    setSkipped(new Set());
    setResponses([]);
    setListenMode(false);
    setOnBreak(false);
    setDone(false);
    try {
      const res = await fetchBaselineQuestions(learnerId);
      if (res.status === "not_ready") {
        setState({ kind: "not_ready", message: res.message });
      } else {
        setState({
          kind: "ready",
          questions: res.questions,
          functioningLevel: res.functioningLevel,
        });
      }
    } catch {
      setState({ kind: "error" });
    }
  }, [learnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Initialise the engine once the bank is ready and pick the first item.
  useEffect(() => {
    if (state.kind !== "ready" || engine !== null || bank.length === 0) return;
    const initial = initBaseline({
      readingDifficulty: FL_AUDIO_FIRST[state.functioningLevel],
    });
    const first = pickNextItem(initial, bank, { applyFrustrationCeiling: true });
    setEngine(initial);
    setCurrentId(first?.id ?? null);
    setQStartedAt(Date.now());
    if (!first) setDone(true);
  }, [state, engine, bank]);

  // Best-effort read-aloud. Read-aloud is offered to every learner (the support
  // banner promises it) and never blocks the flow if TTS is unavailable.
  const speakText = useCallback(
    (text: string) => {
      try {
        Speech.stop();
        Speech.speak(text, { language: i18n.language });
      } catch {
        // Read-aloud is an enhancement, not a gate — swallow any TTS error.
      }
    },
    [i18n.language],
  );

  // Auto-present each new item aurally for audio-first functioning levels (or
  // once a learner opts into "Listen instead"), so the auditory path is real,
  // not just metadata. Stop speech when the item changes or the screen leaves.
  useEffect(() => {
    if (!currentId || done || onBreak || !audioFirst) return;
    const itm = byId.get(currentId);
    if (!itm) return;
    const choices = capChoices(itm.options, itm.correctAnswer, maxChoices);
    speakText([itm.q, ...choices.map((c) => c.label)].join(". "));
    return () => {
      try {
        Speech.stop();
      } catch {
        // noop
      }
    };
  }, [currentId, done, onBreak, audioFirst, byId, maxChoices, speakText]);

  // Persist the finished baseline as a discovery_adventure attempt, grouped by
  // subject (now that every item carries its domain). Fire-and-forget-safe:
  // failures never block the warm completion screen.
  const finish = useCallback(
    async (all: ItemRecord[]) => {
      if (!learnerId || all.length === 0) return;
      const byDomain = new Map<
        string,
        { correct: number; total: number; latencies: number[]; difficulties: number[] }
      >();
      for (const r of all) {
        const bucket =
          byDomain.get(r.subject) ??
          { correct: 0, total: 0, latencies: [] as number[], difficulties: [] as number[] };
        bucket.total += 1;
        if (r.correct) bucket.correct += 1;
        bucket.latencies.push(r.latencyMs);
        if (r.difficulty > 0) bucket.difficulties.push(r.difficulty);
        byDomain.set(r.subject, bucket);
      }
      const avg = (xs: number[]) =>
        xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0;
      const chapterResults = Array.from(byDomain.entries()).map(([domain, b]) => ({
        domain,
        correct: b.correct,
        total: b.total,
        difficulty: b.difficulties.length ? avg(b.difficulties) : 1,
        avgLatencyMs: avg(b.latencies),
      }));
      await completeBaseline(learnerId, {
        chapterResults,
        totalCorrect: all.filter((r) => r.correct).length,
        totalAttempts: all.length,
        responseLatencies: all.map((r) => r.latencyMs),
        xpEarned: 0,
      });
    },
    [learnerId],
  );

  // Record the response and let the engine choose what comes next. `chosen ===
  // null` means the learner tapped "Not sure" — a self-paced skip, recorded
  // without any failure framing and excluded from the θ estimate.
  const respond = (chosen: BaselineChoice | null) => {
    if (!engine || !currentId) return;
    // Cancel any in-flight read-aloud (manual Play or auto-speak) so the prior
    // item's audio never bleeds into the next prompt or the break/finish screen.
    try {
      Speech.stop();
    } catch {
      // noop
    }
    const item = byId.get(currentId);
    const engItem = engItemById.get(currentId);
    if (!item || !engItem) return;

    const isSkip = chosen === null;
    const correct =
      !isSkip && item.correctAnswer != null && chosen.value === item.correctAnswer;
    const latencyMs = Math.max(0, Date.now() - qStartedAt);

    const all: ItemRecord[] = [
      ...responses,
      { subject: item.subject, difficulty: item.difficulty, correct, skipped: isSkip, latencyMs },
    ];

    // Skips are "seen" but not scored: keep them out of the engine bank rather
    // than recording a wrong answer that would unfairly drag θ down.
    let nextEngine = engine;
    let nextSkipped = skipped;
    if (isSkip) {
      nextSkipped = new Set(skipped);
      nextSkipped.add(currentId);
    } else {
      const response: ItemResponse = {
        itemId: currentId,
        correct,
        responseTimeMs: latencyMs,
        consumedModality: audioFirst ? "auditory" : "visual",
      };
      nextEngine = recordResponse({ state: engine, item: engItem, response });
    }

    const availableBank = bank.filter((it) => !nextSkipped.has(it.id));
    const stop = shouldStop(nextEngine);
    const next = stop.stop
      ? null
      : pickNextItem(nextEngine, availableBank, { applyFrustrationCeiling: true });

    setEngine(nextEngine);
    setSkipped(nextSkipped);
    setResponses(all);

    if (!next) {
      void finish(all);
      setDone(true);
      return;
    }

    setCurrentId(next.id);
    // Pause for a breath on the shared cadence, or sooner if the engine reads
    // sustained struggle — a break, never a "you're failing" signal.
    const frustrated = assessFrustration(nextEngine).level === "high";
    if (frustrated || all.length % BASELINE_BREAK_EVERY === 0) {
      setOnBreak(true);
    } else {
      setQStartedAt(Date.now());
    }
  };

  if (state.kind === "loading" || (state.kind === "ready" && !done && !currentId)) {
    return (
      <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
        <LoadingState />
      </ResponsiveScreen>
    );
  }

  if (state.kind === "error") {
    return (
      <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
        <Card tone="hero" style={[styles.card, { alignItems: "center", marginTop: spacing.xl }]}>
          <View style={[styles.iconWrap, { backgroundColor: palette.accentSoft }]}>
            <Ionicons name="cloud-offline" size={30} color={palette.accent} />
          </View>
          <Text style={[styles.h1, { color: palette.ink, textAlign: "center" }]}>
            {t("baselineRun.errorTitle", "We couldn't load your baseline")}
          </Text>
          <Text style={[styles.body, { color: palette.inkMuted, textAlign: "center" }]}>
            {t("baselineRun.errorBody", "Check your connection and try again.")}
          </Text>
          <Button
            title={t("common.retry", "Try again")}
            onPress={() => void load()}
            fullWidth
            size="lg"
            style={{ marginTop: spacing.md }}
          />
        </Card>
      </ResponsiveScreen>
    );
  }

  if (state.kind === "not_ready") {
    return (
      <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
        <Card tone="hero" style={[styles.card, { alignItems: "center", marginTop: spacing.xl }]}>
          <View style={[styles.iconWrap, { backgroundColor: palette.accentSoft }]}>
            <Ionicons name="time" size={30} color={palette.accent} />
          </View>
          <Text style={[styles.h1, { color: palette.ink, textAlign: "center" }]}>
            {t("baselineRun.notReadyTitle", "Almost there")}
          </Text>
          <Text style={[styles.body, { color: palette.inkMuted, textAlign: "center" }]}>
            {state.message}
          </Text>
          <Button
            title={t("baselineRun.finish", "Finish")}
            onPress={() => router.replace("/(learner)" as never)}
            fullWidth
            size="lg"
            style={{ marginTop: spacing.md }}
          />
        </Card>
      </ResponsiveScreen>
    );
  }

  if (done) {
    return (
      <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
        <Card tone="hero" style={[styles.card, { alignItems: "center", marginTop: spacing.xl }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.success + "1A" }]}>
            <Ionicons name="checkmark-circle" size={34} color={colors.success} />
          </View>
          <Text style={[styles.h1, { color: palette.ink, textAlign: "center" }]}>
            {t("baselineRun.doneTitle", "Great work!")}
          </Text>
          <Text style={[styles.body, { color: palette.inkMuted, textAlign: "center" }]}>
            {t(
              "baselineRun.doneBody",
              "You finished your baseline. AIVO will use this to build your learning plan.",
            )}
          </Text>
          <Button
            title={t("baselineRun.finish", "Finish")}
            onPress={() => router.replace("/(learner)" as never)}
            fullWidth
            size="lg"
            style={{ marginTop: spacing.md }}
          />
        </Card>
      </ResponsiveScreen>
    );
  }

  if (onBreak) {
    const canSwitchToListen = !FL_AUDIO_FIRST[functioningLevel] && !listenMode;
    return (
      <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
        <Card tone="hero" style={[styles.card, { alignItems: "center", marginTop: spacing.xl }]}>
          <View style={[styles.iconWrap, { backgroundColor: palette.accentSoft }]}>
            <Ionicons name="cafe" size={30} color={palette.accent} />
          </View>
          <Text style={[styles.h1, { color: palette.ink }]}>
            {t("baselineRun.breakTitle", "Take a breath")}
          </Text>
          <Text style={[styles.body, { color: palette.inkMuted, textAlign: "center" }]}>
            {t("baselineRun.breakBody", "Stretch, sip some water, and continue when you're ready.")}
          </Text>
          <Button
            title={t("baselineRun.continue", "Keep going")}
            onPress={() => {
              setOnBreak(false);
              setQStartedAt(Date.now());
            }}
            fullWidth
            size="lg"
            style={{ marginTop: spacing.md }}
          />
          {canSwitchToListen ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("baselineRun.listenInstead", "Listen instead")}
              onPress={() => {
                setListenMode(true);
                setOnBreak(false);
                setQStartedAt(Date.now());
              }}
              style={styles.listen}
            >
              <Ionicons name="headset" size={18} color={palette.accent} />
              <Text style={[styles.listenText, { color: palette.accent }]}>
                {t("baselineRun.listenInstead", "Listen instead")}
              </Text>
            </Pressable>
          ) : null}
        </Card>
      </ResponsiveScreen>
    );
  }

  const item = currentId ? byId.get(currentId) : undefined;
  if (!item) {
    return (
      <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
        <LoadingState />
      </ResponsiveScreen>
    );
  }

  const visibleChoices = capChoices(item.options, item.correctAnswer, maxChoices);
  const shownTotal = Math.min(questions.length, MAX_ITEMS_DISPLAY);
  const shownNumber = Math.min(responses.length + 1, shownTotal);

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <View style={[styles.companion, { backgroundColor: palette.accentSoft }]}>
        <View style={[styles.companionCircle, { backgroundColor: palette.bgPage }]}>
          <Image
            source={AIVO_COMPANION_PNG}
            style={styles.companionImg}
            resizeMode="contain"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </View>
        <Text style={[styles.companionMsg, { color: palette.ink }]} accessibilityRole="text">
          {t(
            "baselineRun.companion",
            "Pick whatever feels right — every answer here helps AIVO get to know you.",
          )}
        </Text>
      </View>
      <View style={[styles.supports, { backgroundColor: palette.accentSoft }]}>
        <Ionicons name={audioFirst ? "headset" : "volume-high"} size={16} color={palette.accent} />
        <Text style={[styles.supportsText, { color: palette.ink }]}>
          {audioFirst
            ? t("baselineRun.supportsListening", "Listening mode + extra time are on")
            : t("baselineRun.supports", "Read-aloud + extra time are on")}
        </Text>
      </View>
      <Card tone="raised" style={[styles.card, { marginTop: spacing.md }]}>
        <Text style={[styles.count, { color: palette.inkMuted }]}>
          {t("baselineRun.progress", {
            n: shownNumber,
            total: shownTotal,
            defaultValue: `Question ${shownNumber} of ${shownTotal}`,
          })}
        </Text>
        <Text style={[styles.question, { color: palette.ink }]}>{item.q}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("baselineRun.playQuestion", "Read this to me out loud")}
          onPress={() =>
            speakText([item.q, ...visibleChoices.map((c) => c.label)].join(". "))
          }
          style={[styles.play, { backgroundColor: palette.accentSoft }]}
        >
          <Ionicons name="volume-high" size={18} color={palette.accent} />
          <Text style={[styles.playText, { color: palette.accent }]}>
            {t("baselineRun.playQuestion", "Read this to me")}
          </Text>
        </Pressable>
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          {visibleChoices.map((opt, idx) => (
            <Pressable
              key={`${item.id}-${opt.value}-${idx}`}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              onPress={() => respond(opt)}
              style={[
                styles.option,
                { borderColor: palette.border, backgroundColor: palette.bgPage },
              ]}
            >
              <Text style={[styles.optionText, { color: palette.ink }]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("baselineRun.notSure", "Not sure — skip for now")}
          onPress={() => respond(null)}
          style={styles.skip}
        >
          <Ionicons name="arrow-forward-circle-outline" size={18} color={palette.inkMuted} />
          <Text style={[styles.skipText, { color: palette.inkMuted }]}>
            {t("baselineRun.notSure", "Not sure — skip for now")}
          </Text>
        </Pressable>
      </Card>
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  supports: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },
  supportsText: { fontSize: 12, fontFamily: fontFamilies.bodySemiBold },
  companion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  companionCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  companionImg: { width: 40, height: 40 },
  companionMsg: { flex: 1, fontSize: 13, fontFamily: fontFamilies.bodySemiBold, lineHeight: 19 },
  skip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    marginTop: spacing.xs,
  },
  skipText: { fontSize: 14, fontFamily: fontFamilies.bodySemiBold },
  listen: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    marginTop: spacing.xs,
  },
  listenText: { fontSize: 14, fontFamily: fontFamilies.bodySemiBold },
  play: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    marginTop: spacing.xs,
  },
  playText: { fontSize: 13, fontFamily: fontFamilies.bodySemiBold },
  card: { gap: spacing.sm },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  h1: { fontSize: 22, fontFamily: fontFamilies.displayBold },
  body: { fontSize: 14, fontFamily: fontFamilies.bodyRegular, lineHeight: 21 },
  count: {
    fontSize: 12,
    fontFamily: fontFamilies.bodyBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  question: { fontSize: 19, fontFamily: fontFamilies.displayBold, lineHeight: 26 },
  option: {
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  optionText: { fontSize: 16, fontFamily: fontFamilies.bodyBold },
});
