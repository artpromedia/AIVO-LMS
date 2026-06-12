/**
 * Sprint 13 — music/rhythm sequencer (Sprint 8 surface, moved verbatim): a
 * grid of instrument tracks × beats; tap cells to build a rhythm. Captures
 * the pattern.
 */
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { createSurfaceStyles, readNumber } from "./shared";
import type { SurfaceProps } from "./types";

export function MusicSequencerSurface({ theme, disabled, cfg, onSubmit }: SurfaceProps) {
  const styles = useMemo(() => createSurfaceStyles(theme), [theme]);
  const tracks = (Array.isArray(cfg?.tracks) ? (cfg!.tracks as string[]) : []).filter(
    (t) => typeof t === "string",
  );
  const steps = Math.max(1, readNumber(cfg, "steps", 8));
  const [pattern, setPattern] = useState<number[][]>(() => tracks.map(() => []));

  const toggle = (ti: number, s: number) => {
    if (disabled) return;
    setPattern((prev) =>
      prev.map((t, i) =>
        i === ti ? (t.includes(s) ? t.filter((x) => x !== s) : [...t, s].sort((a, b) => a - b)) : t,
      ),
    );
  };

  const hasNotes = pattern.some((t) => t.length > 0);

  return (
    <View style={{ gap: 12 }}>
      {tracks.map((track, ti) => (
        <View key={track} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text
            style={{ width: 64, color: theme.colors.text, fontWeight: "600" }}
            numberOfLines={1}
          >
            {track}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
            {Array.from({ length: steps }, (_, s) => {
              const on = pattern[ti]?.includes(s) ?? false;
              return (
                <Pressable
                  key={s}
                  accessibilityRole="button"
                  accessibilityLabel={`${track} beat ${s + 1}`}
                  accessibilityState={{ selected: on }}
                  onPress={() => toggle(ti, s)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: on ? theme.colors.primary : theme.colors.border,
                    backgroundColor: on ? theme.colors.primary : theme.colors.surface,
                  }}
                />
              );
            })}
          </View>
        </View>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="submit rhythm"
        disabled={disabled || !hasNotes}
        onPress={() => onSubmit({ kind: "music_sequencer", pattern })}
        style={[styles.submit, (disabled || !hasNotes) && styles.submitDisabled]}
      >
        <Text style={styles.submitText}>I&apos;m done</Text>
      </Pressable>
    </View>
  );
}
