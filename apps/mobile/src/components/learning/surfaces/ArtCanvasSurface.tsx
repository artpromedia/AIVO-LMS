/** Sprint 13 — art canvas (Sprint 9 surface, moved verbatim). */
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ScratchPad, type ScratchStroke } from "../ScratchPad";
import { createSurfaceStyles } from "./shared";
import type { SurfaceProps } from "./types";

export function ArtCanvasSurface({ theme, disabled, onSubmit }: SurfaceProps) {
  const styles = useMemo(() => createSurfaceStyles(theme), [theme]);
  const [strokes, setStrokes] = useState<ScratchStroke[]>([]);
  // The selected color is tracked for telemetry parity with the web
  // ArtCanvasSurface; ScratchPad already exposes its own swatch picker.
  const selectedColor = strokes.length > 0 ? strokes[strokes.length - 1].color : "#1B1B1B";
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.scratchHolder}>
        <ScratchPad onChange={setStrokes} compactToolbar />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => onSubmit({ kind: "art_canvas", strokes, color: selectedColor })}
        disabled={disabled || strokes.length === 0}
        style={[styles.submit, (disabled || strokes.length === 0) && styles.submitDisabled]}
      >
        <Text style={styles.submitText}>
          {strokes.length === 0 ? "Draw something first" : "Submit artwork"}
        </Text>
      </Pressable>
    </View>
  );
}
