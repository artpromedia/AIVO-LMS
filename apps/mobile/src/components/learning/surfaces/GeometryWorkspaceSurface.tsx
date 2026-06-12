/**
 * Sprint 13 — geometry workspace (moved verbatim): shows the figure (grid
 * paper) and lets the learner construct/measure on it, submitting the ink.
 */
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ScratchPad, type ScratchStroke } from "../ScratchPad";
import { createSurfaceStyles, readString } from "./shared";
import type { SurfaceProps } from "./types";

export function GeometryWorkspaceSurface({ theme, disabled, cfg, onSubmit }: SurfaceProps) {
  const styles = useMemo(() => createSurfaceStyles(theme), [theme]);
  const [strokes, setStrokes] = useState<ScratchStroke[]>([]);
  const prompt = readString(cfg, "prompt", "");
  return (
    <View style={{ gap: 12 }}>
      {prompt ? <Text style={styles.body}>{prompt}</Text> : null}
      <View style={styles.scratchHolder}>
        <ScratchPad gridPaper onChange={setStrokes} compactToolbar />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="submit geometry work"
        disabled={disabled}
        onPress={() => onSubmit({ kind: "geometry_workspace", strokes })}
        style={[styles.submit, disabled && styles.submitDisabled]}
      >
        <Text style={styles.submitText}>I&apos;m done</Text>
      </Pressable>
    </View>
  );
}
