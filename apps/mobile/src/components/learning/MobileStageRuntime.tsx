/**
 * MobileStageRuntime — the real session runtime that replaces the
 * hardcoded MCQ flow. Consumes a typed Session, dispatches each beat to
 * MobileBeatRenderer, tracks correctness, and emits a completion event
 * with mastery + XP totals.
 *
 * Pure UI orchestrator: it never fabricates content. Sprint 02 gate.
 */

import React, { useCallback, useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useA11yStyle } from "@/lib/a11y-style";
import { useScanTarget } from "@/src/components/switch-scan/ScanTargetRegistry";
import type { TierThemeMobile } from "@aivo/mobile-ui";
import type { Beat, Session } from "@/src/types/stage";
import { MobileBeatRenderer } from "./MobileBeatRenderer";
import { MobileTutorPanel } from "./MobileTutorPanel";
import { useStageLayout } from "@/src/design/useStageLayout";

export interface CompletionPayload {
  correctCount: number;
  total: number;
  xpEarned: number;
  masteryUpdates: Record<string, number>;
}

interface Props {
  theme: TierThemeMobile;
  tier: "EARLY" | "MIDDLE" | "HIGH";
  session: Session;
  currentIndex: number;
  /** Tier-specific labels supplied by the screen. */
  labels: {
    next: string;
    finish: string;
    encourage: string;
    miss: (correct: string) => string;
    intro: string;
    /** "Activity {index} of {total}" — translated by the screen. */
    counter: (index: number, total: number) => string;
    /** Empty-session message — translated by the screen. */
    empty: string;
  };
  submitting: boolean;
  selected: string | null;
  answered: boolean;
  lastCorrect: boolean | null;
  /** Beat answer handlers — wired by the screen to the API clients. */
  onChoiceAnswer: (beat: Beat & { kind: "choice" }, answer: string) => Promise<void>;
  onMathExpression: (beat: Beat & { kind: "math-expression" }, expression: string) => Promise<void>;
  onSurfaceSubmit: (beat: Beat & { kind: "surface" }, commands: unknown) => Promise<void>;
  onTutorTurnContinue: (beat: Beat & { kind: "tutor-turn" }) => Promise<void>;
  onAdvance: () => void;
}

export function MobileStageRuntime(props: Props) {
  // `beat` may be undefined at the end of a session; every hook below must
  // still be called unconditionally to satisfy react-hooks/rules-of-hooks.
  const beat: Beat | undefined = props.session.stagePlan.beats[props.currentIndex];
  const total = props.session.stagePlan.beats.length;
  const isLast = props.currentIndex >= total - 1;
  const layout = useStageLayout();
  const styles = createStyles(props.theme);
  const { bodyFontFamily } = useA11yStyle();

  const tutorMessage = useMemo(() => {
    if (!beat) return props.labels.intro;
    if (!props.answered) return beat.prompt ?? props.labels.intro;
    if (props.lastCorrect === true) return props.labels.encourage;
    if (props.lastCorrect === false && beat.kind === "choice") {
      return props.labels.miss(beat.correctAnswer);
    }
    return props.labels.intro;
  }, [props.answered, props.lastCorrect, beat, props.labels]);

  const handleChoice = useCallback(
    (answer: string) => {
      if (!beat || beat.kind !== "choice") return;
      void props.onChoiceAnswer(beat, answer);
    },
    [beat, props],
  );

  const handleMath = useCallback(
    (expression: string) => {
      if (!beat || beat.kind !== "math-expression") return;
      void props.onMathExpression(beat, expression);
    },
    [beat, props],
  );

  const handleSurface = useCallback(
    (commands: unknown) => {
      if (!beat || beat.kind !== "surface") return;
      void props.onSurfaceSubmit(beat, commands);
    },
    [beat, props],
  );

  const handleTutorContinue = useCallback(() => {
    if (!beat || beat.kind !== "tutor-turn") return;
    void props.onTutorTurnContinue(beat);
  }, [beat, props]);

  // Hooks before any early return (rules-of-hooks). `beat` may be null on
  // the empty-session frame; the target stays disabled then.
  const advanceVisible = Boolean(beat) && (props.answered || beat?.kind === "tutor-turn") && !props.submitting;
  const advanceLabel = isLast ? props.labels.finish : props.labels.next;
  const advanceScanRef = useScanTarget({
    id: "stage-advance",
    label: advanceLabel,
    order: 90,
    onActivate: beat?.kind === "tutor-turn" ? handleTutorContinue : props.onAdvance,
    disabled: !advanceVisible,
  });

  if (!beat) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { fontFamily: bodyFontFamily }]}>{props.labels.empty}</Text>
      </View>
    );
  }

  const advanceButton = advanceVisible ? (
    <Pressable
      ref={advanceScanRef}
      style={styles.advance}
      onPress={beat.kind === "tutor-turn" ? handleTutorContinue : props.onAdvance}
      accessibilityRole="button"
      accessibilityLabel={advanceLabel}
    >
      <Text style={[styles.advanceText, { fontFamily: bodyFontFamily }]}>{advanceLabel}</Text>
    </Pressable>
  ) : null;

  const beatColumn = (
    <View style={styles.beatColumn}>
      <View style={styles.counterRow}>
        <Text style={[styles.counter, { fontFamily: bodyFontFamily }]}>
          {props.labels.counter(props.currentIndex + 1, total)}
        </Text>
      </View>
      <MobileBeatRenderer
        theme={props.theme}
        beat={beat}
        selected={props.selected}
        answered={props.answered}
        submitting={props.submitting}
        onChoice={handleChoice}
        onMathExpression={handleMath}
        onSurfaceSubmit={handleSurface}
        onTutorTurnContinue={handleTutorContinue}
      />
      {advanceButton}
    </View>
  );

  if (layout.mode === "split") {
    return (
      <View
        style={[styles.containerSplit, { maxWidth: layout.contentMaxWidth, gap: layout.splitGap }]}
      >
        <View style={{ width: layout.tutorPanelWidth }}>
          <MobileTutorPanel theme={props.theme} tier={props.tier} message={tutorMessage} />
        </View>
        {beatColumn}
      </View>
    );
  }

  return (
    <View style={[styles.container, { maxWidth: layout.contentMaxWidth }]}>
      <MobileTutorPanel theme={props.theme} tier={props.tier} message={tutorMessage} />
      {beatColumn}
    </View>
  );
}

function createStyles(theme: TierThemeMobile) {
  return StyleSheet.create({
    container: { flex: 1, gap: 8, alignSelf: "center", width: "100%" },
    containerSplit: {
      flex: 1,
      flexDirection: "row",
      alignSelf: "center",
      width: "100%",
    },
    beatColumn: { flex: 1, gap: 8 },
    counterRow: { paddingHorizontal: 16 },
    counter: { color: theme.colors.text, opacity: 0.7, fontSize: 14 },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    emptyText: { color: theme.colors.text, fontSize: 18, textAlign: "center" },
    advance: {
      alignSelf: "center",
      marginVertical: 16,
      paddingHorizontal: 28,
      paddingVertical: 12,
      borderRadius: 24,
      backgroundColor: theme.colors.primary,
    },
    advanceText: { color: theme.colors.surface, fontSize: 18, fontWeight: "700" },
  });
}

