import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Card, Button } from "@/components/ui";
import { useTranslation } from "@/hooks/useTranslation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import {
  BOX_BREATH_PHASES,
  BOX_BREATH_PHASE_SECONDS,
  boxBreathRounds,
  type BreathPhase,
} from "@/lib/calm";
import { createCalmChime, type CalmChime } from "@/lib/calm-chime";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Box breathing: 4-4-4-4 (mobile parity for the web BoxBreathing runner).
 * Honors the OS reduce-motion setting by replacing the animated orb with a
 * static cue + a manual "Next breath" affordance. Audio cues are opt-in
 * (default off) with a session-local mute that never writes a preference.
 */
export function BoxBreathing({
  audioCuesEnabled,
  onDone,
  onCancel,
}: Readonly<{
  audioCuesEnabled: boolean;
  onDone: (secondsSpent: number) => void;
  onCancel: () => void;
}>) {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const reducedMotion = useReducedMotion();
  const totalPhases = BOX_BREATH_PHASES.length * boxBreathRounds();
  const rounds = boxBreathRounds();
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [muted, setMuted] = useState(false);
  const chimeRef = useRef<CalmChime | null>(null);
  const startedAt = useRef<number>(Date.now());
  const scale = useRef(new Animated.Value(0.9)).current;

  // Build the chime once (its tones are pre-rendered). Dispose on unmount —
  // i.e. on completion, cancel, or navigating away.
  useEffect(() => {
    if (!audioCuesEnabled) return;
    chimeRef.current = createCalmChime();
    return () => {
      chimeRef.current?.dispose();
      chimeRef.current = null;
    };
  }, [audioCuesEnabled]);

  // One soft cue per phase transition (and the first phase). No autoplay:
  // the cue only sounds because the learner entered/advanced the activity.
  useEffect(() => {
    if (!audioCuesEnabled || muted) return;
    if (phaseIdx >= totalPhases) return;
    chimeRef.current?.phaseCue(BOX_BREATH_PHASES[phaseIdx % BOX_BREATH_PHASES.length]);
  }, [phaseIdx, audioCuesEnabled, muted, totalPhases]);

  // Auto-advance only when motion is allowed; reduced-motion users tap.
  useEffect(() => {
    if (reducedMotion) return;
    if (phaseIdx >= totalPhases) {
      onDone(Math.round((Date.now() - startedAt.current) / 1000));
      return;
    }
    const id = setTimeout(() => setPhaseIdx((i) => i + 1), BOX_BREATH_PHASE_SECONDS * 1000);
    return () => clearTimeout(id);
  }, [phaseIdx, reducedMotion, totalPhases, onDone]);

  const phase: BreathPhase = BOX_BREATH_PHASES[phaseIdx % BOX_BREATH_PHASES.length];
  const round = Math.floor(phaseIdx / BOX_BREATH_PHASES.length) + 1;
  const expanded = phase === "inhale" || phase === "hold_in";

  // Animate the orb to mirror the breath (grow on in/hold-in, shrink on
  // out/hold-out). Static under reduce-motion.
  useEffect(() => {
    if (reducedMotion) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, {
      toValue: expanded ? 1.1 : 0.9,
      duration: BOX_BREATH_PHASE_SECONDS * 1000,
      useNativeDriver: true,
    }).start();
  }, [expanded, reducedMotion, scale]);

  const atLastPhase = phaseIdx + 1 >= totalPhases;

  return (
    <Card tone="raised" style={styles.card}>
      <Text style={[styles.round, { color: palette.inkMuted }]}>
        {t("learnerCalm.breathing.round", { round, rounds })}
      </Text>
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.orb,
          { backgroundColor: palette.primary + "33", transform: [{ scale }] },
        ]}
      />
      <Text
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
        style={[styles.phase, { color: palette.ink }]}
      >
        {t(`learnerCalm.breathing.phase.${phase}`)}
      </Text>

      <View style={styles.actions}>
        {reducedMotion && atLastPhase ? (
          <Button
            title={t("learnerCalm.breathing.finish")}
            onPress={() => onDone(Math.round((Date.now() - startedAt.current) / 1000))}
          />
        ) : null}
        {reducedMotion && !atLastPhase ? (
          <Button
            title={t("learnerCalm.breathing.next")}
            onPress={() => setPhaseIdx((i) => i + 1)}
          />
        ) : null}
        {audioCuesEnabled ? (
          <Button
            variant="ghost"
            title={
              muted ? t("learnerCalm.audio.unmute") : t("learnerCalm.audio.mute")
            }
            onPress={() => setMuted((m) => !m)}
          />
        ) : null}
        <Button
          variant="outline"
          title={t("learnerCalm.breathing.done_early")}
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
    padding: spacing.xl,
  },
  round: { fontSize: 13, fontFamily: fontFamilies.bodyRegular },
  orb: { width: 160, height: 160, borderRadius: 80 },
  phase: { fontSize: 24, fontFamily: fontFamilies.displayBold, textAlign: "center" },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.sm,
  },
});
