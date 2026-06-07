import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, Button } from "@/components/ui";
import { useTranslation } from "@/hooks/useTranslation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import {
  PATTERN_DEFAULT_LENGTH,
  PATTERN_TILE_COUNT,
  generatePatternSequence,
  isPatternGuessCorrect,
} from "@/lib/calm";
import { colors, spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/** Milliseconds each tile stays highlighted during the watch phase. */
const REVEAL_MS = 800;

type Phase = "watch" | "input";
type Feedback = "none" | "wrong" | "correct";

/**
 * Pattern Focus — a low-stakes "watch then repeat" grounding activity
 * (mobile parity for the web game). No score, no timer pressure, no lose
 * state: an incorrect tap gently re-prompts. Honors reduce-motion by
 * replacing the animated reveal with a static, readable sequence.
 */
export function PatternFocus({
  onDone,
  onCancel,
}: Readonly<{
  onDone: (secondsSpent: number) => void;
  onCancel: () => void;
}>) {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const reducedMotion = useReducedMotion();
  const startedAt = useRef<number>(Date.now());
  const [sequence] = useState<number[]>(() =>
    generatePatternSequence(Math.random, PATTERN_DEFAULT_LENGTH),
  );
  const [phase, setPhase] = useState<Phase>("watch");
  const [revealIdx, setRevealIdx] = useState(0);
  const [guess, setGuess] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<Feedback>("none");

  // Per-tile accent — never the only signal: each tile also carries a number.
  // The mode-aware palette only exposes primary/accent, so the two extra
  // hues come from the static brand status colors (stable across all sensory
  // modes), giving four clearly-distinct, child-friendly tiles.
  const tileTones = [palette.primary, palette.accent, colors.success, colors.warning];

  // Animated reveal only when motion is allowed; reduced-motion learners
  // read the static sequence and start when they're ready.
  useEffect(() => {
    if (phase !== "watch" || reducedMotion) return;
    if (revealIdx >= sequence.length) {
      const id = setTimeout(() => setPhase("input"), REVEAL_MS / 2);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setRevealIdx((i) => i + 1), REVEAL_MS);
    return () => clearTimeout(id);
  }, [phase, reducedMotion, revealIdx, sequence.length]);

  const restartWatch = useCallback(() => {
    setGuess([]);
    setFeedback("none");
    setRevealIdx(0);
    setPhase("watch");
  }, []);

  const tapTile = useCallback(
    (tile: number) => {
      if (phase !== "input" || feedback === "correct") return;
      const next = [...guess, tile];
      setGuess(next);
      if (next.length < sequence.length) {
        setFeedback("none");
        return;
      }
      if (isPatternGuessCorrect(sequence, next)) {
        setFeedback("correct");
        const secs = Math.round((Date.now() - startedAt.current) / 1000);
        // Brief, gentle pause on the success message, then complete.
        setTimeout(() => onDone(secs), 900);
      } else {
        // No lose state — clear the attempt and invite another calm try.
        setFeedback("wrong");
        setGuess([]);
      }
    },
    [phase, feedback, guess, sequence, onDone],
  );

  const highlighted =
    phase === "watch" && !reducedMotion && revealIdx < sequence.length
      ? sequence[revealIdx]
      : null;

  let statusText: string;
  if (feedback === "correct") {
    statusText = t("learnerCalm.games.nice");
  } else if (feedback === "wrong") {
    statusText = t("learnerCalm.games.try_again");
  } else if (phase === "watch") {
    statusText = t("learnerCalm.games.pattern_watch");
  } else {
    statusText = t("learnerCalm.games.pattern_repeat");
  }

  return (
    <Card tone="raised" style={styles.card}>
      <Text style={[styles.title, { color: palette.ink }]}>
        {t("learnerCalm.games.pattern_title")}
      </Text>

      {phase === "watch" && reducedMotion ? (
        <Text style={[styles.body, { color: palette.inkMuted }]}>
          {t("learnerCalm.games.pattern_sequence", {
            sequence: sequence.map((n) => n + 1).join(" · "),
          })}
        </Text>
      ) : null}

      <Text
        accessibilityLiveRegion="polite"
        style={[styles.status, { color: palette.ink }]}
      >
        {statusText}
      </Text>

      <View
        style={styles.board}
        accessibilityRole="none"
        accessibilityLabel={t("learnerCalm.games.pattern_board_aria")}
      >
        {Array.from({ length: PATTERN_TILE_COUNT }, (_, tile) => {
          const isLit = highlighted === tile;
          const disabled = phase !== "input" || feedback === "correct";
          return (
            <Pressable
              key={tile}
              disabled={disabled}
              onPress={() => tapTile(tile)}
              accessibilityRole="button"
              accessibilityLabel={t("learnerCalm.games.pattern_tile", { number: tile + 1 })}
              style={[
                styles.tile,
                {
                  backgroundColor: tileTones[tile] + "33",
                  borderColor: isLit ? palette.primary : palette.border,
                  opacity: disabled ? 0.6 : 1,
                  transform: [{ scale: isLit ? 1.05 : 1 }],
                },
              ]}
            >
              <Text style={[styles.tileNum, { color: palette.ink }]}>{tile + 1}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actions}>
        {phase === "input" && feedback !== "correct" ? (
          <Button
            variant="outline"
            title={t("learnerCalm.games.watch_again")}
            onPress={restartWatch}
          />
        ) : null}
        <Button
          title={t("learnerCalm.games.done")}
          onPress={() => onDone(Math.round((Date.now() - startedAt.current) / 1000))}
        />
        <Button
          variant="outline"
          title={t("learnerCalm.games.go_back")}
          onPress={onCancel}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: { fontSize: 22, fontFamily: fontFamilies.displayBold, textAlign: "center" },
  body: { fontSize: 15, fontFamily: fontFamilies.bodyRegular, textAlign: "center" },
  status: {
    minHeight: 24,
    fontSize: 15,
    fontFamily: fontFamilies.bodyBold,
    textAlign: "center",
  },
  board: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.sm,
    maxWidth: 200,
  },
  tile: {
    width: 80,
    height: 80,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tileNum: { fontSize: 22, fontFamily: fontFamilies.bodyBold },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.sm,
  },
});
