/**
 * Sprint 13 — the ink workspace shared by scratchpad (full experience) and
 * the fallback kinds (chart, unknown), moved verbatim. Grid paper turns on
 * for geometry/chart; the submitted command keys off the surface kind, with
 * `noop` for kinds the runtime doesn't ascribe ink semantics to.
 */
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ScratchPad, type ScratchStroke } from "../ScratchPad";
import { createSurfaceStyles } from "./shared";
import type { SurfaceProps } from "./types";

export function ScratchFallbackSurface({ theme, disabled, surfaceKind, onSubmit }: SurfaceProps) {
  const styles = useMemo(() => createSurfaceStyles(theme), [theme]);
  const [strokes, setStrokes] = useState<ScratchStroke[]>([]);
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.scratchHolder}>
        <ScratchPad
          gridPaper={surfaceKind === "geometry_workspace" || surfaceKind === "chart"}
          onChange={setStrokes}
          compactToolbar
        />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          if (disabled) return;
          if (surfaceKind === "geometry_workspace") {
            onSubmit({ kind: "geometry_workspace", strokes });
          } else if (surfaceKind === "chart") {
            onSubmit({ kind: "chart", strokes });
          } else if (surfaceKind === "scratchpad") {
            onSubmit({ kind: "scratchpad", strokes });
          } else {
            onSubmit({ kind: "noop", surfaceKind });
          }
        }}
        disabled={disabled}
        style={[styles.submit, disabled && styles.submitDisabled]}
      >
        <Text style={styles.submitText}>I&apos;m done</Text>
      </Pressable>
    </View>
  );
}
